"""Offline reconciliation and publication planning from a fresh read-only export.

Never connects to Firestore and never changes public/. Projected inventories are
non-promotable. Explicit approval and a fresh server-derived stage are required.
"""

import argparse
import copy
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from .cli import review_plan
from .model import (
    COMMUNITY_POLICY,
    SEASON,
    VERIFICATION,
    canonical,
    digest,
    read_csv,
    timestamp,
    validate_record,
)
from .publishing import atomic_write, read_pair, replacement_plan, stage

ROOT = Path(__file__).resolve().parents[1]


def require_private_output(output):
    output = output.resolve()
    if output.is_relative_to((ROOT / "public").resolve()) or output == ROOT.resolve():
        raise ValueError(
            "Planning artifacts must stay outside public/ and the repository root"
        )
    if output.exists():
        raise ValueError(
            "Choose a fresh planning directory; do not replace an earlier plan"
        )


def prepare(
    live_export,
    new_csv,
    sightings_csv,
    input_report,
    output,
    observed_at,
    prepared_at,
    actor="owner",
    root=ROOT,
):
    require_private_output(output)
    observed_at, prepared_at = timestamp(observed_at), timestamp(prepared_at)
    live = json.loads(live_export.read_text())
    if (
        live.get("schemaVersion") != 1
        or live.get("project") != "nusuk-codes"
        or live.get("season") != SEASON
        or live.get("withEvidence") is not True
        or not isinstance(live.get("records"), list)
    ):
        raise ValueError(
            "Need a complete production current-season export with evidence"
        )
    records = live["records"]
    if len({r["id"] for r in records}) != len(records) or len(
        {r["code"] for r in records}
    ) != len(records):
        raise ValueError(
            "Duplicate production identities/codes; stop for reconciliation"
        )
    for row in records:
        validate_record(row)
        if type(row.get("revision")) is not int or row["revision"] < 0:
            raise ValueError("Invalid production revision")
        if (
            not isinstance(row.get("sources"), list)
            or not row["sources"]
            or not isinstance(row.get("audit"), list)
        ):
            raise ValueError("Incomplete production source/audit export")
        for source in row["sources"]:
            evidence = {
                key: source[key]
                for key in ["sourceUrl", "discoveredAt", "sourcePublishedAt"]
            }
            if source["id"] != digest(canonical(evidence)):
                raise ValueError("Source evidence identity mismatch")
    additions, new_report = read_csv(new_csv, SEASON, observed_at)
    sightings, sightings_report = read_csv(sightings_csv, SEASON, observed_at)
    supplied = json.loads(input_report.read_text())
    for report in [new_report, sightings_report]:
        if report["invalid"] or report["duplicates"] or report["caseVariants"]:
            raise ValueError("Invalid/duplicate/case-variant input; no plan generated")
    live_by_id = {r["id"]: r for r in records}
    live_codes = {r["code"] for r in records}
    new_codes = {r["code"] for r in additions}
    sighting_codes = {r["code"] for r in sightings}
    if new_codes & sighting_codes:
        raise ValueError("Split input files overlap; investigate the input bundle")
    missing = [r for r in additions if r["id"] not in live_by_id]
    existing_new = sorted(new_codes & live_codes)
    missing_sightings = sorted(sighting_codes - live_codes)
    union = live_codes | new_codes | sighting_codes
    folded = {}
    for code in union:
        folded.setdefault(code.lower(), []).append(code)
    variants = [sorted(codes) for codes in folded.values() if len(codes) > 1]
    new_source_count, existing_source_count = 0, 0
    for candidate in additions + sightings:
        existing_sources = {
            s["id"] for s in live_by_id.get(candidate["id"], {}).get("sources", [])
        }
        for evidence in candidate["sources"]:
            if digest(canonical(evidence)) in existing_sources:
                existing_source_count += 1
            else:
                new_source_count += 1
    expected = {
        "liveCodes": 1132,
        "newInputCodes": 408,
        "sightingInputCodes": 43,
        "trulyMissingCodes": 408,
        "projectedUniqueCodes": 1540,
    }
    actual = {
        "liveCodes": len(records),
        "newInputCodes": len(additions),
        "sightingInputCodes": len(sightings),
        "trulyMissingCodes": len(missing),
        "projectedUniqueCodes": len(union),
    }
    differences = {
        key: {"expected": value, "actual": actual[key]}
        for key, value in expected.items()
        if value != actual[key]
    }
    declared = {
        "original_existing_codes": 1132,
        "input_rows": 451,
        "input_unique_codes": 451,
        "invalid_format": 0,
        "input_duplicates": 0,
        "already_existing": 43,
        "new_codes": 408,
        "combined_unique": 1540,
        "source_count": 1,
    }
    for key, value in declared.items():
        if supplied.get(key) != value:
            differences["inputReport." + key] = {
                "expected": value,
                "actual": supplied.get(key),
            }
    blocked_records = sorted(
        r["id"] for r in records if r["status"] in {"hidden", "invalid"}
    )
    source_urls = {s["sourceUrl"] for c in additions + sightings for s in c["sources"]}
    if len(source_urls) != 1:
        differences["inputSources"] = {"expected": 1, "actual": len(source_urls)}
    report = dict(
        schemaVersion=1,
        project="nusuk-codes",
        season=SEASON,
        planningOnly=True,
        preparedAt=prepared_at,
        observedAt=observed_at,
        observationPrecision="day marker supplied by folder date",
        expected=expected,
        actual=actual,
        differences=differences,
        expectedTotalDifference=len(union) - 1540,
        productionStatuses=dict(Counter(r["status"] for r in records)),
        existingNewInputCodes=existing_new,
        missingSightingCodes=missing_sightings,
        caseVariants=variants,
        blockedModerationIds=blocked_records,
        documentCreates=len(missing),
        sourceCreates=new_source_count,
        sourceAlreadyPresent=existing_source_count,
        liveExportSha256=digest(live_export.read_bytes()),
        liveStateSha256=digest(canonical(sorted(records, key=lambda r: r["id"]))),
        inputs={
            "new": new_report["inputSha256"],
            "sightings": sightings_report["inputSha256"],
            "report": digest(input_report.read_bytes()),
            "reportedOriginal451Sha256": supplied.get("input_sha256"),
            "original451FingerprintVerified": False,
        },
        publicationPolicy=COMMUNITY_POLICY,
        redemptionVerified=False,
        caveats=[
            "The original 451-row file was not supplied; its reported binary fingerprint cannot be independently checked.",
            "451 matches do not prove all Facebook comments were loaded.",
            "Season attribution is supplied by the owner/import context, not independent eligibility or redemption verification.",
        ],
    )
    report["blocked"] = bool(
        differences or existing_new or missing_sightings or variants or blocked_records
    )
    output.mkdir(parents=True)
    atomic_write(
        output / "reconciliation.json",
        (canonical(report) + "\n").encode(),
        exclusive=True,
    )
    if report["blocked"]:
        return report
    # Expected future documents, never written to a server. Keep live originals intact.
    projected = copy.deepcopy(records)
    for candidate in missing:
        projected.append(
            dict(
                id=candidate["id"],
                code=candidate["code"],
                season=SEASON,
                **candidate["sources"][0],
                status="pending",
                verification=VERIFICATION,
                redemptionVerified=False,
                revision=0,
            )
        )
    # Import plans stay separate from moderation decisions. Existing records/sources are not overwritten.
    imports = []
    for label, candidates, file_report in [
        ("new", additions, new_report),
        ("sightings", sightings, sightings_report),
    ]:
        for offset in range(0, len(candidates), 250):
            selected = candidates[offset : offset + 250]
            batch = dict(
                kind=label,
                inputSha256=file_report["inputSha256"],
                offset=offset,
                limit=250,
                selected=len(selected),
                codeIds=[c["id"] for c in selected],
                expectedCodeCreates=sum(c["id"] not in live_by_id for c in selected),
                expectedSourceCreates=sum(
                    digest(canonical(s))
                    not in {
                        x["id"] for x in live_by_id.get(c["id"], {}).get("sources", [])
                    }
                    for c in selected
                    for s in c["sources"]
                ),
            )
            imports.append(batch)
    atomic_write(
        output / "import-plan.json",
        (canonical(dict(planningOnly=True, batches=imports)) + "\n").encode(),
        exclusive=True,
    )
    approvals = []
    before = {}
    for row in sorted(projected, key=lambda r: r["id"]):
        # Do not silently restore hidden/invalid decisions; they blocked the plan above.
        decision = dict(
            id=row["id"],
            code=row["code"],
            expectedStatus=row["status"],
            expectedRevision=row["revision"],
            status="published",
            publicationPolicy=COMMUNITY_POLICY,
            syntaxChecked=True,
            seasonAttributed=True,
            sourceReviewed=row.get("sourceReviewed") is True,
            seasonReviewed=row.get("seasonReviewed") is True,
            note="Owner policy: display syntactically valid community codes attributed to 2026-11; source/eligibility and redemption remain unverified.",
        )
        approvals.append(decision)
        before[row["id"]] = dict(status=row["status"], revision=row["revision"])
    batches = []
    for number, offset in enumerate(range(0, len(approvals), 250), 1):
        decisions = approvals[offset : offset + 250]
        _, plan_hash = review_plan(canonical(decisions))
        filename = f"review-{number:02d}.json"
        atomic_write(
            output / filename, (canonical(decisions) + "\n").encode(), exclusive=True
        )
        batches.append(
            dict(
                file=filename,
                count=len(decisions),
                planSha256=plan_hash,
                confirmation=f"REVIEW nusuk-codes {SEASON} {plan_hash}",
            )
        )
        for decision in decisions:
            row = next(r for r in projected if r["id"] == decision["id"])
            row.update(
                status="published",
                publicationPolicy=COMMUNITY_POLICY,
                syntaxChecked=True,
                seasonAttributed=True,
                sourceReviewed=decision["sourceReviewed"],
                seasonReviewed=decision["seasonReviewed"],
                reviewNote=decision["note"],
                reviewedAt=prepared_at,
                reviewedBy=actor,
                reviewPlanId=plan_hash,
                revision=row["revision"] + 1,
            )
    atomic_write(
        output / "review-plan.json",
        (canonical(dict(planningOnly=True, batches=batches)) + "\n").encode(),
        exclusive=True,
    )
    atomic_write(
        output / "pre-publication-state.json",
        (canonical(dict(planningOnly=True, before=before)) + "\n").encode(),
        exclusive=True,
    )
    manifest = stage(projected, output / "snapshot", planning_only=True)
    _, raw, _ = read_pair(output / "snapshot")
    delta = replacement_plan(root, manifest, raw)
    old_manifest, old_raw, _ = read_pair(root / "public/data")
    rollback = output / "rollback"
    rollback.mkdir()
    atomic_write(
        rollback / "manifest.json",
        (canonical(old_manifest) + "\n").encode(),
        exclusive=True,
    )
    atomic_write(
        rollback / Path(old_manifest["snapshotUrl"]).name, old_raw, exclusive=True
    )
    atomic_write(
        output / "snapshot-diff.json",
        (canonical(delta) + "\n").encode(),
        exclusive=True,
    )
    report.update(
        publicationApprovals=len(approvals),
        reviewBatches=batches,
        projectedSources=sum(len(r["sources"]) for r in records) + new_source_count,
        snapshot=manifest,
        snapshotAdded=len(delta["added"]),
        snapshotRemoved=len(delta["removed"]),
        estimatedWrites=dict(
            imports=len(missing) + new_source_count,
            publication=2 * len(approvals),
            total=len(missing) + new_source_count + 2 * len(approvals),
        ),
        rollbackSnapshotSha256=old_manifest["snapshotSha256"],
    )
    atomic_write(output / "reconciliation.json", (canonical(report) + "\n").encode())
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live-export", type=Path, required=True)
    parser.add_argument("--new-csv", type=Path, required=True)
    parser.add_argument("--sightings-csv", type=Path, required=True)
    parser.add_argument("--input-report", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--observed-at", required=True)
    parser.add_argument("--prepared-at", default=datetime.now(timezone.utc).isoformat())
    args = parser.parse_args()
    result = prepare(
        args.live_export,
        args.new_csv,
        args.sightings_csv,
        args.input_report,
        args.output,
        args.observed_at,
        args.prepared_at,
    )
    print(
        json.dumps(
            {
                k: result[k]
                for k in [
                    "blocked",
                    "expected",
                    "actual",
                    "differences",
                    "documentCreates",
                    "sourceCreates",
                    "expectedTotalDifference",
                ]
            },
            indent=2,
        )
    )
    return 1 if result["blocked"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
