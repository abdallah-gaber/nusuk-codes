"""Stage, verify, promote and roll back static assets. Never deploy or touch Firebase."""

import gzip
import json
import os
import re
import tempfile
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from .model import (
    SEASON,
    VERIFICATION,
    canonical,
    code_id,
    digest,
    timestamp,
    validate_record,
)

PUBLIC_SEASON = "nov-2026"


def atomic_write(path, raw, exclusive=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix=".stage-")
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        if exclusive:
            os.link(temporary, path)
        else:
            os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def checked_pair(manifest, raw):
    if (
        type(manifest.get("schemaVersion")) is not int
        or manifest.get("schemaVersion") != 1
        or type(manifest.get("codeCount")) is not int
        or not 0 <= manifest["codeCount"] <= 20000
        or type(manifest.get("maintenance")) is not bool
        or manifest.get("season") != PUBLIC_SEASON
        or not re.fullmatch(
            r"/data/codes\.[a-f0-9]{16}\.json", manifest.get("snapshotUrl", "")
        )
        or not re.fullmatch(r"[a-f0-9]{64}", manifest.get("snapshotSha256", ""))
        or manifest.get("readOnly") is not True
        or manifest.get("submissionsEnabled") is not False
        or manifest.get("candidatePreview") is not True
    ):
        raise ValueError("Unsafe manifest")
    timestamp(manifest["generatedAt"])
    if (
        digest(raw) != manifest["snapshotSha256"]
        or manifest["snapshotUrl"] != f"/data/codes.{digest(raw)[:16]}.json"
    ):
        raise ValueError("Snapshot checksum/path mismatch")
    if len(raw) > 4_000_000 or len(gzip.compress(raw, mtime=0)) > 250_000:
        raise ValueError("Snapshot exceeds public byte budget")
    data = json.loads(raw)
    codes = data.get("codes")
    if (
        type(data.get("schemaVersion")) is not int
        or data.get("schemaVersion") != 1
        or data.get("season") != PUBLIC_SEASON
        or not isinstance(codes, list)
    ):
        raise ValueError("Invalid snapshot schema/season")
    if len(codes) != manifest["codeCount"] or len(codes) > 20000:
        raise ValueError("Snapshot count mismatch/limit")
    seen = set()
    for entry in codes:
        if (
            set(entry) != {"code", "status", "source", "observedAt"}
            or not re.fullmatch(r"NG-[A-Za-z0-9]{8}", entry["code"])
            or entry["code"] in seen
            or entry["status"] != VERIFICATION
            or entry["source"] not in {"facebook.com", "services.nusuk.sa"}
            or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", entry["observedAt"])
        ):
            raise ValueError("Invalid, duplicate or private public entry")
        timestamp(entry["observedAt"] + "T00:00:00Z")
        seen.add(entry["code"])
    return data


def read_pair(folder, manifest_name="manifest.json", public_root=None):
    manifest = json.loads((folder / manifest_name).read_text())
    name = Path(manifest["snapshotUrl"]).name
    raw = ((public_root / "data" if public_root else folder) / name).read_bytes()
    return manifest, raw, checked_pair(manifest, raw)


def stage(records, output, allow_empty=False):
    if output.exists():
        raise ValueError(
            "Staging output must be a new directory; never overwrite a prior stage"
        )
    if not records and not allow_empty:
        raise ValueError(
            "No published records; current preview must not be replaced with an empty feed"
        )
    entries, times, inventory = [], [], []
    for record in sorted(records, key=lambda r: r["code"]):
        validate_record(record)
        if (
            record["status"] != "published"
            or record.get("sourceReviewed") is not True
            or record.get("seasonReviewed") is not True
            or not record.get("reviewNote")
            or not record.get("reviewedBy")
            or not record.get("reviewPlanId")
            or not isinstance(record.get("revision"), int)
            or record["revision"] < 1
        ):
            raise ValueError("Published record lacks explicit source/season review")
        reviewed = timestamp(record["reviewedAt"])
        observed = timestamp(record["discoveredAt"])
        domain = urlparse(record["sourceUrl"]).hostname.removeprefix("www.")
        entries.append(
            dict(
                code=record["code"],
                status=VERIFICATION,
                source=domain,
                observedAt=observed[:10],
            )
        )
        times.extend([reviewed, observed])
        inventory.append(
            dict(id=code_id(SEASON, record["code"]), revision=record["revision"])
        )
    payload = dict(schemaVersion=1, season=PUBLIC_SEASON, codes=entries)
    raw = canonical(payload).encode()
    sha = digest(raw)
    manifest = dict(
        schemaVersion=1,
        season=PUBLIC_SEASON,
        codeCount=len(entries),
        generatedAt=max(
            times,
            key=lambda value: datetime.fromisoformat(value.replace("Z", "+00:00")),
        )
        if times
        else "2026-11-01T00:00:00Z",
        snapshotUrl=f"/data/codes.{sha[:16]}.json",
        snapshotSha256=sha,
        readOnly=True,
        submissionsEnabled=False,
        candidatePreview=True,
        maintenance=False,
    )
    checked_pair(manifest, raw)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(dir=output.parent, prefix=".snapshot-"))
    try:
        (temporary / Path(manifest["snapshotUrl"]).name).write_bytes(raw)
        (temporary / "manifest.json").write_text(canonical(manifest) + "\n")
        (temporary / "publication.json").write_text(
            canonical(dict(records=inventory, snapshotSha256=sha)) + "\n"
        )
        os.rename(temporary, output)
    finally:
        if temporary.exists():
            import shutil

            shutil.rmtree(temporary)
    return manifest


@contextmanager
def publish_lock(root):
    folder = root / ".admin-work"
    folder.mkdir(exist_ok=True)
    path = folder / "publishing.lock"
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        yield
    finally:
        os.close(fd)
        path.unlink()


def replace_manifest(
    root,
    manifest,
    raw,
    expected,
    confirm,
    rollback=False,
    allow_removals=False,
    allow_empty=False,
):
    new_data = checked_pair(manifest, raw)
    operation = "ROLLBACK" if rollback else "PUBLISH"
    if confirm != f"{operation} {manifest['snapshotSha256']}":
        raise ValueError(
            f"Explicit confirmation required: {operation} <full snapshot SHA256>"
        )
    with publish_lock(root):
        current, old_raw, old_data = read_pair(root / "public/data")
        if current["snapshotSha256"] != expected:
            raise ValueError("Live manifest changed since review; no files replaced")
        removed = sorted(
            {c["code"] for c in old_data["codes"]}
            - {c["code"] for c in new_data["codes"]}
        )
        if not rollback and (
            (removed and not allow_removals)
            or (not new_data["codes"] and not allow_empty)
        ):
            raise ValueError(
                f"Replacement removes {len(removed)} codes or empties the feed; require --allow-removals / --allow-empty explicitly"
            )
        # Validation completes before mutation. Data first, manifest last. Prior asset retained.
        destination = root / "public/data" / Path(manifest["snapshotUrl"]).name
        if destination.exists() and destination.read_bytes() != raw:
            raise ValueError("Immutable snapshot filename collision")
        backup = (
            root / "snapshots/history" / f"{digest(canonical(current))}.manifest.json"
        )
        atomic_write(backup, (canonical(current) + "\n").encode())
        if not destination.exists():
            atomic_write(destination, raw)
        atomic_write(
            root / "public/data/manifest.json", (canonical(manifest) + "\n").encode()
        )
        return dict(
            snapshotSha256=manifest["snapshotSha256"],
            previousSnapshot=current["snapshotSha256"],
            removed=len(removed),
            backup=str(backup.relative_to(root)),
            deployed=False,
        )


def replacement_plan(root, manifest, raw, expected="", rollback=False):
    new_data = checked_pair(manifest, raw)
    current, _, old_data = read_pair(root / "public/data")
    if expected and current["snapshotSha256"] != expected:
        raise ValueError("Current snapshot differs from expected SHA")
    old_codes = {entry["code"] for entry in old_data["codes"]}
    new_codes = {entry["code"] for entry in new_data["codes"]}
    return dict(
        dryRun=True,
        snapshotSha256=manifest["snapshotSha256"],
        currentSnapshotSha256=current["snapshotSha256"],
        added=sorted(new_codes - old_codes),
        removed=sorted(old_codes - new_codes),
        codeCount=len(new_codes),
        confirmation=f"{'ROLLBACK' if rollback else 'PUBLISH'} {manifest['snapshotSha256']}",
    )


def validate_inventory(folder, manifest, data):
    inventory = json.loads((folder / "publication.json").read_text())
    records = inventory.get("records")
    expected = {code_id(SEASON, entry["code"]) for entry in data["codes"]}
    if (
        inventory.get("snapshotSha256") != manifest["snapshotSha256"]
        or not isinstance(records, list)
        or len(records) != len(expected)
        or any(
            not isinstance(row, dict)
            or type(row.get("revision")) is not int
            or row["revision"] < 1
            for row in records
        )
        or {row.get("id") for row in records} != expected
    ):
        raise ValueError(
            "Missing/mismatched reviewed publication inventory; do not promote an unreviewed fixture"
        )
    return inventory
