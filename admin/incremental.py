"""Pure incremental planning and fail-stop execution, reusable with the emulator."""

import math
from collections import Counter

from .model import (
    COMMUNITY_POLICY,
    SEASON,
    VERIFICATION,
    canonical,
    code_id,
    digest,
    validate_record,
)
from .publishing import (
    atomic_write,
    read_pair,
    replace_manifest,
    stage,
    validate_inventory,
)


class UpdateStopped(ValueError):
    """Safe operator-facing reason, never a raw SDK exception."""


MAX_INCOMING = 2000


def save(path, value):
    atomic_write(path, (canonical(value) + "\n").encode())


def summarize(plan):
    return {
        k: plan[k]
        for k in [
            "inputSha256",
            "season",
            "new",
            "existing",
            "existingStatuses",
            "invalid",
            "crossSeasonConflicts",
            "caseVariants",
            "duplicates",
            "expectedFinalCount",
            "expectedPublishedCount",
            "snapshotRequired",
            "estimatedOperations",
            "blocked",
            "confirmation",
        ]
    }


def plan_update(store, candidates, csv_report, current, observed_at, cap):
    old = store.get_many([c["id"] for c in candidates])
    matches, lookup_reads = store.conflicts(candidates)
    total, published = store.count(SEASON), store.count(SEASON, published=True)
    if not 0 <= published <= total <= cap:
        raise UpdateStopped(
            "Unexpected database count/cap; use emergency reconciliation"
        )
    by_code = {c["code"]: c for c in candidates}
    folded = {c["code"].lower() for c in candidates}
    cross, variants, legacy = [], list(csv_report["caseVariants"]), []
    for row in matches:
        code = row["code"]
        if code in by_code:
            if row["season"] != SEASON:
                cross.append(row["id"])
            elif row["id"] != code_id(SEASON, code):
                legacy.append(row["id"])
            elif old.get(row["id"]) is None:
                raise UpdateStopped(
                    "Record appeared during lookup; re-plan before applying"
                )
        elif row["season"] == SEASON and code.lower() in folded:
            variants.append([code])
    for row in old.values():
        if row:
            validate_record(row)
            if type(row.get("revision")) is not int or row["revision"] < 0:
                raise UpdateStopped("Invalid existing revision")
    new = [c for c in candidates if old[c["id"]] is None]
    existing = [r for r in old.values() if r is not None]
    wrong_season_rows = [
        r for r in csv_report["invalid"] if "different season" in r["reason"]
    ]
    invalid = len(csv_report["invalid"]) - len(wrong_season_rows)
    writes = sum(2 + len(c["sources"]) for c in new)
    # Count aggregations charge per 1000 index entries (minimum one). Include
    # preflight, one touched-record verification, one post-count and one snapshot.
    snapshot_required = bool(new) or published != current["codeCount"]
    preflight_reads = (
        len(candidates)
        + lookup_reads
        + max(1, math.ceil(total / 1000))
        + max(1, math.ceil(published / 1000))
    )
    reads = preflight_reads + (
        len(candidates)
        + max(1, math.ceil((total + len(new)) / 1000))
        + max(1, published + len(new))
        if snapshot_required
        else 0
    )
    checkpoint = [
        dict(
            id=i,
            exists=r is not None,
            revision=r["revision"] if r else None,
            status=r["status"] if r else None,
            recordSha256=digest(canonical(r)) if r else None,
        )
        for i, r in sorted(old.items())
    ]
    plan = dict(
        schemaVersion=1,
        season=SEASON,
        inputSha256=csv_report["inputSha256"],
        observedAt=observed_at,
        currentSnapshotSha256=current["snapshotSha256"],
        new=len(new),
        existing=len(existing),
        existingStatuses=dict(Counter(r["status"] for r in existing)),
        invalid=invalid,
        invalidSamples=csv_report["invalid"][:5],
        crossSeasonConflicts=len(cross) + len(wrong_season_rows),
        crossSeasonIds=sorted(cross),
        caseVariants=len(variants),
        caseVariantSamples=variants[:5],
        legacyIds=sorted(legacy),
        duplicates=csv_report["duplicates"],
        expectedFinalCount=total + len(new),
        expectedPublishedCount=published + len(new),
        snapshotRequired=snapshot_required,
        checkpoint=checkpoint,
        estimatedOperations=dict(
            reads=reads,
            writes=writes,
            requiredReadHeadroom=math.ceil(reads * 1.2),
            requiredWriteHeadroom=math.ceil(writes * 1.2),
        ),
        blocked=bool(
            invalid
            or cross
            or wrong_season_rows
            or variants
            or legacy
            or not candidates
            or len(candidates) > MAX_INCOMING
            or total + len(new) > cap
        ),
    )
    plan["planId"] = digest(canonical(plan))
    plan["confirmation"] = f"UPDATE {SEASON} {plan['planId']}"
    return plan, old


def new_record(candidate, input_hash, actor, applied_at, approval_plan_id=None):
    plan_id = approval_plan_id or digest("quick-display\0" + input_hash)
    return dict(
        id=candidate["id"],
        code=candidate["code"],
        season=SEASON,
        **candidate["sources"][0],
        status="published",
        verification=VERIFICATION,
        redemptionVerified=False,
        importBatch=input_hash,
        inputSha256=input_hash,
        createdAt=applied_at,
        createdBy=actor,
        normalizedLookup=candidate["code"].lower(),
        revision=1,
        publicationPolicy=COMMUNITY_POLICY,
        syntaxChecked=True,
        seasonAttributed=True,
        sourceReviewed=False,
        seasonReviewed=False,
        reviewedAt=applied_at,
        reviewedBy=actor,
        reviewPlanId=plan_id,
        reviewNote="Owner-approved routine community display policy; redemption and independent source/season verification remain unverified.",
    )


def write_groups(items):
    group, cost = [], 0
    for item in items:
        item_cost = 2 + len(item[1])
        if group and cost + item_cost > 250:
            yield group
            group, cost = [], 0
        group.append(item)
        cost += item_cost
    if group:
        yield group


def execute_update(store, candidates, plan, old, root, output, actor, applied_at):
    if plan["blocked"]:
        raise UpdateStopped("Blocked plan cannot be applied")
    # Persist before the first write, not after it. No full evidence backup here.
    save(
        output / "checkpoint.json",
        dict(planId=plan["planId"], affected=plan["checkpoint"]),
    )
    items = [
        (
            new_record(c, plan["inputSha256"], actor, applied_at, plan["planId"]),
            c["sources"],
        )
        for c in candidates
        if old[c["id"]] is None
    ]
    expected = dict(old) | {r["id"]: r for r, _ in items}
    result = dict(
        planId=plan["planId"],
        status="importing",
        confirmedCreated=0,
        completedBatches=0,
        uncertainBatchIds=[],
        deployed=False,
    )
    save(output / "result.json", result)
    try:
        if not plan["snapshotRequired"]:
            current, _, _ = read_pair(root / "public/data")
            if current["snapshotSha256"] != plan["currentSnapshotSha256"]:
                raise UpdateStopped("Local manifest changed during no-op planning")
            result.update(
                status="no-changes",
                codeCount=current["codeCount"],
                snapshotSha256=current["snapshotSha256"],
            )
            save(output / "result.json", result)
            return result
        for group in write_groups(items):
            result["uncertainBatchIds"] = [r["id"] for r, _ in group]
            save(output / "result.json", result)
            store.create_batch(group, plan["inputSha256"], actor, plan["inputSha256"])
            result["confirmedCreated"] += len(group)
            result["completedBatches"] += 1
            result["uncertainBatchIds"] = []
            save(output / "result.json", result)
        result["status"] = "verifying"
        touched = store.get_many(sorted(expected))
        if touched != expected:
            raise UpdateStopped(
                "Touched records differ from approved checkpoint/creates"
            )
        if store.count(SEASON) != plan["expectedFinalCount"]:
            raise UpdateStopped("Unexpected final document count; CDN unchanged")
        records = store.published(SEASON, 5000)
        if len(records) != plan["expectedPublishedCount"]:
            raise UpdateStopped("Unexpected published count; CDN unchanged")
        manifest = stage(records, output / "snapshot")
        _, raw, data = read_pair(output / "snapshot")
        validate_inventory(output / "snapshot", manifest, data)
        current, _, previous = read_pair(root / "public/data")
        if current["snapshotSha256"] != plan["currentSnapshotSha256"]:
            raise UpdateStopped("Local manifest changed during import")
        entries = {e["code"]: e for e in data["codes"]}
        if any(entries.get(e["code"]) != e for e in previous["codes"]):
            raise UpdateStopped(
                "Routine updates cannot remove/change CDN entries; use separate moderation publishing"
            )
        result["status"] = "promoting-local"
        if manifest["snapshotSha256"] != current["snapshotSha256"]:
            result["promotion"] = replace_manifest(
                root,
                manifest,
                raw,
                current["snapshotSha256"],
                f"PUBLISH {manifest['snapshotSha256']}",
            )
        result.update(
            status="ready-for-pr",
            snapshotSha256=manifest["snapshotSha256"],
            codeCount=manifest["codeCount"],
        )
        save(output / "result.json", result)
        return result
    except BaseException as error:
        result.update(
            status="stopped-reconcile-before-retry", errorType=type(error).__name__
        )
        save(output / "result.json", result)
        raise
