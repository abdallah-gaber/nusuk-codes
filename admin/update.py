"""One-confirmation incremental import and local snapshot/PR preparation."""

import argparse
import json
import os
import sys
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from .incremental import (
    MAX_INCOMING,
    UpdateStopped,
    execute_update,
    plan_update,
    save,
    summarize,
)
from .incremental_store import IncrementalStore
from .model import MAX_BYTES, MAX_PUBLICATION_RECORDS, SEASON, digest, read_csv, timestamp
from .publishing import atomic_write, read_pair
from .store import connect, now

ROOT = Path(__file__).resolve().parents[1]


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--file", type=Path, required=True)
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    p.add_argument(
        "--confirm",
        help="Exact UPDATE token from the current dry-run; otherwise prompt",
    )
    p.add_argument(
        "--observed-at",
        help="CSV observation fallback; defaults to first local receipt time",
    )
    p.add_argument("--actor", default=os.environ.get("NUSUK_ADMIN_ACTOR"))
    p.add_argument("--production", action="store_true")
    p.add_argument("--project")
    p.add_argument(
        "--quota-headroom",
        default=os.environ.get("NUSUK_QUOTA_HEADROOM"),
        type=Path,
        help="Fresh owner-attested Spark usage JSON; required for production apply",
    )
    p.add_argument(
        "--prepare-only",
        action="store_true",
        help="Prepare local snapshot/rollback without Git push or PR creation",
    )
    return p


def quota_attestation(path, at=None):
    if path is None:
        raise UpdateStopped(
            "Production apply requires --quota-headroom from the Firebase Usage console"
        )
    q = json.loads(path.read_text())
    age = (
        (at or datetime.now(timezone.utc))
        - datetime.fromisoformat(timestamp(q["checkedAt"]))
    ).total_seconds()
    if (
        q.get("project") != "nusuk-codes"
        or q.get("billingEnabled") is not False
        or not -300 <= age <= 3600
    ):
        raise UpdateStopped(
            "Quota attestation must confirm no billing and be less than one hour old"
        )
    for key, cap in [("readsRemaining", 50000), ("writesRemaining", 20000)]:
        if type(q.get(key)) is not int or not 0 <= q[key] <= cap:
            raise UpdateStopped("Invalid Spark remaining-quota attestation")
    return q


def check_headroom(plan, quota):
    operations = plan["estimatedOperations"]
    if (
        quota["readsRemaining"] < operations["requiredReadHeadroom"]
        or quota["writesRemaining"] < operations["requiredWriteHeadroom"]
    ):
        raise UpdateStopped(
            "Insufficient quota headroom including 20% margin; wait for quota reset"
        )


@contextmanager
def update_lock(root):
    folder = root / ".admin-work"
    folder.mkdir(exist_ok=True)
    path = folder / "quick-import.lock"
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        yield
    finally:
        os.close(fd)
        path.unlink()


def session(root, source, observed_at):
    if source.stat().st_size > MAX_BYTES:
        raise UpdateStopped("CSV exceeds 5 MB")
    raw = source.read_bytes()
    folder = root / ".admin-work/quick-import" / digest(raw)
    folder.mkdir(parents=True, exist_ok=True)
    meta_path = folder / "input.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text())
        if meta.get("season") != SEASON or meta.get("inputSha256") != digest(raw):
            raise UpdateStopped("Saved session identity/season mismatch")
        if (folder / "input.csv").read_bytes() != raw:
            raise UpdateStopped(
                "Saved input mismatch; do not overwrite operator evidence"
            )
        if observed_at and timestamp(observed_at) != meta["observedAt"]:
            raise UpdateStopped(
                "Observation time changed for identical input; reuse the saved session"
            )
    else:
        meta = dict(
            inputSha256=digest(raw),
            season=SEASON,
            observedAt=timestamp(observed_at) if observed_at else now(),
            observationPolicy="CSV discovered_at first; fallback is supplied observation time or first local receipt, never source publication time",
        )
        atomic_write(folder / "input.csv", raw, exclusive=True)
        save(meta_path, meta)
    count = len(list(folder.glob("attempt-*")))
    attempt = folder / f"attempt-{count + 1:04d}"
    attempt.mkdir()
    return folder / "input.csv", meta, attempt


def run(args, root=ROOT, factory=connect, input_fn=input):
    config = json.loads((root / "admin/config.json").read_text())
    if (
        config.get("projectId") != "nusuk-codes"
        or config.get("season") != SEASON
        or type(config.get("maxExportRecords")) is not int
        or not 1 <= config["maxExportRecords"] <= MAX_PUBLICATION_RECORDS
    ):
        raise UpdateStopped("Invalid quick-import configuration")
    production = (
        args.production or os.environ.get("NUSUK_ENABLE_PRODUCTION") == "nusuk-codes"
    )
    project = args.project or ("nusuk-codes" if production else "demo-nusuk-codes")
    quota = (
        quota_attestation(args.quota_headroom) if args.apply and production else None
    )
    if args.apply and (
        (
            config.get("quickImportEnabled") is not True
            and os.environ.get("NUSUK_ENABLE_QUICK_IMPORT") != project
        )
        or os.environ.get("NUSUK_DISABLE_ADMIN_UPDATES") == "1"
    ):
        raise UpdateStopped(
            "Quick imports disabled; configure the owner-only NUSUK_ENABLE_QUICK_IMPORT opt-in or reviewed quickImportEnabled flag"
        )
    if args.apply and (not args.actor or not 1 <= len(args.actor.strip()) <= 100):
        raise UpdateStopped("Apply requires an administrative actor")
    with update_lock(root):
        source, meta, output = session(root, args.file, args.observed_at)
        candidates, csv_report = read_csv(source, SEASON, meta["observedAt"])
        if len(candidates) > MAX_INCOMING:
            raise UpdateStopped(
                "Quick imports accept at most 2000 distinct incoming codes"
            )
        current, _, _ = read_pair(root / "public/data")
        # Authentication does not write. The existing production/ADC/impersonation
        # gates still apply; the ephemeral write gate never changes config.json.
        local_config = dict(config, updatesEnabled=args.apply)
        store = IncrementalStore(factory(project, production, args.apply, local_config))
        plan, old = plan_update(
            store,
            candidates,
            csv_report,
            current,
            meta["observedAt"],
            config["maxExportRecords"],
        )
        save(output / "plan.json", plan)
        print(json.dumps(summarize(plan), indent=2), flush=True)
        print(f"Private report: {output / 'plan.json'}", flush=True)
        if plan["blocked"]:
            return 1
        if not args.apply:
            return 0
        if quota:
            check_headroom(plan, quota)
        release_base = None
        if production and not args.prepare_only and plan["snapshotRequired"]:
            from .release import check_release_base

            release_base = check_release_base(root)
        answer = args.confirm
        if answer is None:
            if not sys.stdin.isatty() and input_fn is input:
                raise UpdateStopped(
                    "Noninteractive apply requires the exact --confirm token"
                )
            answer = input_fn(
                f"Type exactly {plan['confirmation']} to import and prepare publication: "
            )
        if answer != plan["confirmation"]:
            raise UpdateStopped("Confirmation mismatch; zero writes performed")
        if quota:
            check_headroom(plan, quota_attestation(args.quota_headroom))
        result = execute_update(
            store,
            candidates,
            plan,
            old,
            root,
            output,
            args.actor,
            now(),
            capacity=config["maxExportRecords"],
        )
        if production and not args.prepare_only and result.get("promotion"):
            from .release import create_pr

            try:
                result["pullRequest"] = create_pr(
                    root, plan, result, output, release_base
                )
                save(output / "result.json", result)
            except Exception as error:
                result.update(
                    status="local-ready-pr-failed", errorType=type(error).__name__
                )
                save(output / "result.json", result)
                raise
        print(json.dumps(result, indent=2))
        return 0


def main():
    try:
        return run(parser().parse_args())
    except (Exception, KeyboardInterrupt) as error:
        # Never print SDK exception text, credentials, URLs or request bodies.
        print(
            json.dumps(
                dict(
                    status="stopped",
                    errorType=type(error).__name__,
                    reason=str(error)
                    if isinstance(error, UpdateStopped)
                    else "SDK/network/input error; details redacted",
                    action="Inspect private plan/result; reconcile touched IDs before retry. No automatic deploy or billing change.",
                )
            ),
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
