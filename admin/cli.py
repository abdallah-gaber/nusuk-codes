"""Privileged operator CLI. Default is dry-run; production needs several explicit gates."""

import argparse
import json
import os
import sys
from pathlib import Path

from .model import (
    SEASON,
    STATUSES,
    canonical,
    check_review,
    code_id,
    digest,
    read_csv,
    validate_record,
)
from .publishing import (
    atomic_write,
    read_pair,
    replace_manifest,
    replacement_plan,
    stage,
    validate_inventory,
)
from .store import connect

ROOT = Path(__file__).resolve().parents[1]


def plan_import(store, candidates):
    new, duplicates = [], []
    for entry in candidates:
        old = store.get(entry["id"])
        variants = store.case_variants(entry["season"], entry["code"])
        if variants:
            raise ValueError(
                "Case-only variants in Firestore; reconcile and investigate before import"
            )
        if old:
            validate_record(old)
            duplicates.append(entry["id"])
        else:
            new.append(entry["id"])
    return dict(
        new=len(new), existing=len(duplicates), newIds=new, existingIds=duplicates
    )


def apply_import(store, candidates, batch, actor, input_hash):
    report = dict(created=0, existing=0, sourcesAdded=0, failed=[], processed=0)
    for entry in candidates:
        try:
            if store.case_variants(entry["season"], entry["code"]):
                raise ValueError(
                    "Case-only variants in Firestore; manual investigation required"
                )
            result = store.import_one(entry, batch, actor, input_hash)
            report["created" if result["created"] else "existing"] += 1
            report["sourcesAdded"] += result["sourcesAdded"]
            report["processed"] += 1
        except Exception as error:
            # Fail-stop bounds quota/network damage. Prior transactions remain valid; replay safely.
            report["failed"].append(
                dict(id=entry["id"], errorType=type(error).__name__)
            )
            break
    report["skipped"] = len(candidates) - report["processed"] - len(report["failed"])
    return report


def review_plan(raw):
    decisions = json.loads(raw)
    if not isinstance(decisions, list) or not 1 <= len(decisions) <= 250:
        raise ValueError("Review plan must contain 1–250 explicit decisions")
    ids = set()
    for d in decisions:
        if (
            not isinstance(d, dict)
            or d.get("id") in ids
            or d.get("status") not in STATUSES
            or d.get("expectedStatus") not in STATUSES
            or type(d.get("expectedRevision")) is not int
            or d["expectedRevision"] < 0
            or not isinstance(d.get("note"), str)
            or not 1 <= len(d["note"].strip()) <= 1000
            or not isinstance(d.get("code"), str)
        ):
            raise ValueError("Invalid/duplicate review decision")
        from .model import code_id, parse_code

        if d["id"] != code_id(SEASON, parse_code(d["code"])):
            raise ValueError("Review ID/code mismatch")
        if d["status"] == "published" and (
            d.get("sourceReviewed") is not True or d.get("seasonReviewed") is not True
        ):
            raise ValueError(
                "Publication requires explicit sourceReviewed and seasonReviewed"
            )
        ids.add(d["id"])
    return decisions, digest(canonical(decisions))


def reconcile(before, after):
    left = {row["id"]: row for row in before}
    right = {row["id"]: row for row in after}
    variants = {}
    for row in after:
        variants.setdefault(row["code"].lower(), []).append(row["code"])
    return dict(
        missing=sorted(left.keys() - right.keys()),
        extra=sorted(right.keys() - left.keys()),
        changed=sorted(
            k
            for k in left.keys() & right.keys()
            if canonical(left[k]) != canonical(right[k])
        ),
        noncanonical=[
            r["id"] for r in after if r["id"] != code_id(r["season"], r["code"])
        ],
        caseVariants=[v for v in variants.values() if len(set(v)) > 1],
    )


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "command",
        choices=[
            "validate",
            "import",
            "export",
            "reconcile",
            "review",
            "snapshot",
            "verify-snapshot",
            "promote",
            "rollback",
        ],
    )
    p.add_argument("--input", type=Path)
    p.add_argument("--output", type=Path)
    p.add_argument("--season", default=SEASON)
    p.add_argument(
        "--observed-at",
        help="ISO timestamp with timezone; observation, NOT publication date",
    )
    p.add_argument("--batch", help="Audit batch label; defaults to exact CSV SHA256")
    p.add_argument("--actor", default=os.environ.get("NUSUK_ADMIN_ACTOR"))
    p.add_argument("--project", default="demo-nusuk-codes")
    p.add_argument("--production", action="store_true")
    p.add_argument("--config", type=Path, default=ROOT / "admin/config.json")
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true")
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Explicit spelling of the default no-write mode",
    )
    p.add_argument("--confirm", default="")
    p.add_argument("--offset", type=int, default=0)
    p.add_argument("--limit", type=int)
    p.add_argument("--with-evidence", action="store_true")
    p.add_argument("--expect-current", default="")
    p.add_argument("--allow-removals", action="store_true")
    p.add_argument("--allow-empty", action="store_true")
    p.add_argument(
        "--report", type=Path, help="Private durable JSON report, outside public assets"
    )
    return p


def private_path(path):
    if path is None:
        raise ValueError("--input/--output is required for this command")
    public = (ROOT / "public").resolve()
    if path.resolve().is_relative_to(public):
        raise ValueError("Administrative files must stay outside public/")
    return path


def run(args):
    config = json.loads(args.config.read_text())
    if (
        config.get("projectId") != "nusuk-codes"
        or type(config.get("updatesEnabled")) is not bool
        or type(config.get("maxImportCodes")) is not int
        or not 1 <= config["maxImportCodes"] <= 250
        or type(config.get("maxExportRecords")) is not int
        or not 1 <= config["maxExportRecords"] <= 20000
    ):
        raise ValueError("Invalid administrative config; fail closed")
    if args.season != SEASON or config["season"] != SEASON:
        raise ValueError(
            "This application is configured for 2026-11; never publish another season silently"
        )
    command = args.command
    if command not in {"import", "review", "promote", "rollback"} and (
        args.apply or args.dry_run
    ):
        raise ValueError("This command does not accept --apply/--dry-run")
    if command in {"validate", "import"}:
        if not args.observed_at:
            raise ValueError(
                "--observed-at is required; never invent source publication dates"
            )
        candidates, report = read_csv(
            private_path(args.input), args.season, args.observed_at
        )
        if command == "validate":
            return report, bool(report["invalid"])
        if report["invalid"] or report["caseVariants"]:
            return dict(
                **report,
                blocked="Fix invalid rows / investigate exact-case variants before import",
            ), True
        limit = args.limit if args.limit is not None else config["maxImportCodes"]
        if not 1 <= limit <= min(config["maxImportCodes"], 250) or args.offset < 0:
            raise ValueError("Import limit is 1–250 and offset must be nonnegative")
        if not candidates or args.offset >= len(candidates):
            raise ValueError("No candidate codes at this offset")
        selected = candidates[args.offset : args.offset + limit]
        batch = args.batch or report["inputSha256"]
        if len(batch) > 128 or not batch:
            raise ValueError("Batch label must be 1–128 characters")
        token = f"IMPORT {args.project} {args.season} {report['inputSha256']} {args.offset}:{limit}"
        if args.apply:
            require_write(args, config, token)
        store = connect(args.project, args.production, args.apply, config)
        report.update(
            offset=args.offset,
            selected=len(selected),
            deferred=max(0, len(candidates) - args.offset - len(selected)),
            batch=batch,
            confirmation=token,
            dryRun=not args.apply,
        )
        if not args.apply:
            report.update(plan_import(store, selected))
        else:
            report["result"] = apply_import(
                store, selected, batch, args.actor, report["inputSha256"]
            )
        return report, bool(report.get("result", {}).get("failed"))
    if command == "verify-snapshot":
        manifest, _, _ = read_pair(private_path(args.input))
        return dict(
            valid=True,
            snapshotSha256=manifest["snapshotSha256"],
            count=manifest["codeCount"],
        ), False
    if command in {"promote", "rollback"}:
        if command == "promote" and not args.dry_run and not config["updatesEnabled"]:
            raise ValueError(
                "Updates disabled; enable only after emulator and staging verification"
            )
        if command == "promote":
            manifest, raw, data = read_pair(private_path(args.input))
            validate_inventory(private_path(args.input), manifest, data)
        else:
            path = private_path(args.input)
            manifest, raw, _ = read_pair(path.parent, path.name, ROOT / "public")
        if args.dry_run:
            return replacement_plan(
                ROOT, manifest, raw, args.expect_current, rollback=command == "rollback"
            ), False
        return replace_manifest(
            ROOT,
            manifest,
            raw,
            args.expect_current,
            args.confirm,
            rollback=command == "rollback",
            allow_removals=args.allow_removals,
            allow_empty=args.allow_empty,
        ), False
    if command == "review":
        decisions, plan_id = review_plan(private_path(args.input).read_text())
        token = f"REVIEW {args.project} {args.season} {plan_id}"
        if args.apply:
            require_write(args, config, token)
        store = connect(args.project, args.production, args.apply, config)
        report = dict(
            planId=plan_id,
            confirmation=token,
            dryRun=not args.apply,
            results=[],
            failed=[],
        )
        for decision in decisions:
            try:
                result = (
                    store.review_one(decision, plan_id, args.actor)
                    if args.apply
                    else check_review(store.get(decision["id"]), decision, plan_id)
                )
                report["results"].append(dict(id=decision["id"], result=result))
            except Exception as error:
                report["failed"].append(
                    dict(id=decision["id"], errorType=type(error).__name__)
                )
                break
        report["skipped"] = (
            len(decisions) - len(report["results"]) - len(report["failed"])
        )
        return report, bool(report["failed"])
    limit = args.limit if args.limit is not None else config["maxExportRecords"]
    if not 1 <= limit <= min(config["maxExportRecords"], 20000):
        raise ValueError("Record limit exceeds configured cap")
    if command == "snapshot" and args.production and not config["updatesEnabled"]:
        raise ValueError("Snapshot updates disabled")
    if command in {"export", "snapshot"}:
        output = private_path(args.output)
        if output.exists():
            raise ValueError("Output exists; choose a new private filename/directory")
    if command == "reconcile":
        private_path(args.input).read_bytes()
    store = connect(args.project, args.production, False, config)
    rows = store.list(args.season, limit, published=command == "snapshot")
    if command == "snapshot":
        manifest = stage(rows, private_path(args.output), args.allow_empty)
        return manifest, False
    if command == "export":
        if args.with_evidence:
            remaining_reads = 5000 - len(rows)
            for row in rows:
                for key, exporter in [
                    ("sources", store.export_sources),
                    ("audit", store.export_audit),
                ]:
                    if remaining_reads < 2:
                        raise ValueError(
                            "Evidence export read budget reached; export smaller subsets"
                        )
                    row[key] = exporter(row["id"], limit=min(100, remaining_reads - 1))
                    remaining_reads -= max(1, len(row[key]))
        path = private_path(args.output)
        if path.exists():
            raise ValueError("Export file exists; choose a new backup filename")
        data = dict(
            schemaVersion=1,
            project=args.project,
            season=args.season,
            withEvidence=args.with_evidence,
            records=rows,
        )
        atomic_write(path, (canonical(data) + "\n").encode(), exclusive=True)
        return dict(
            exported=len(rows),
            sha256=digest(canonical(data)),
            withEvidence=args.with_evidence,
        ), False
    baseline = json.loads(private_path(args.input).read_text())
    if baseline.get("season") != args.season or baseline.get("project") != args.project:
        raise ValueError("Baseline project/season mismatch")
    # Reconciliation compares code documents, not separately exported evidence collections.
    before = [
        {k: v for k, v in row.items() if k not in {"sources", "audit"}}
        for row in baseline["records"]
    ]
    result = reconcile(before, rows)
    return result, any(result.values())


def require_write(args, config, token):
    if not args.actor or not args.actor.strip() or len(args.actor) > 128:
        raise ValueError("--actor is required for audit metadata (max 128 characters)")
    if args.confirm != token:
        raise ValueError(
            f'Confirmation mismatch. Run dry-run first, then pass --confirm "{token}"'
        )
    if args.production and not config["updatesEnabled"]:
        raise ValueError("Updates disabled")


def main():
    args = parser().parse_args()
    try:
        if args.report and private_path(args.report).exists():
            raise ValueError("Report exists; choose a new audit report filename")
        report, failed = run(args)
        if args.report:
            atomic_write(
                private_path(args.report),
                (canonical(report) + "\n").encode(),
                exclusive=True,
            )
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1 if failed else 0
    except Exception as error:
        # Never dump SDK tracebacks, credentials, request bodies or exported records.
        message = (
            str(error)
            if isinstance(error, (ValueError, FileNotFoundError, FileExistsError))
            else type(error).__name__
        )
        print(
            json.dumps(dict(error=message, changedLiveDataset=False)), file=sys.stderr
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
