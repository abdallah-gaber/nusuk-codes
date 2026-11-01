"""Pure validation/planning. A syntax match is never redemption verification."""

import csv
import hashlib
import io
import json
import re
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse

STATUSES = {"pending", "published", "hidden", "invalid"}
VERIFICATION = "community_submitted_unverified"
SEASON = "2026-11"
COMMUNITY_POLICY = "community-current-season-v1"
MAX_ROWS = 10000
MAX_BYTES = 5_000_000


def digest(value):
    return hashlib.sha256(
        value.encode() if isinstance(value, str) else value
    ).hexdigest()


def code_id(season, code):
    return digest(f"{season}\0{code}")


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError("Expected ISO timestamp")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Timestamp must include timezone")
    return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def safe_source(value):
    if (
        not isinstance(value, str)
        or len(value) > 2048
        or any(ord(c) < 32 for c in value)
    ):
        raise ValueError("Invalid source URL")
    url = urlparse(value)
    if (
        url.scheme != "https"
        or url.hostname not in {"www.facebook.com", "facebook.com", "services.nusuk.sa"}
        or url.username
        or url.password
        or url.port not in (None, 443)
        or url.fragment
    ):
        raise ValueError("Source must be an allowlisted HTTPS public URL")
    return value


def parse_code(value):
    value = value.strip().strip(".,;،؛()[]{}<>\"'")
    if value.startswith("https://"):
        url = urlparse(value)
        if (
            url.scheme != "https"
            or url.netloc != "services.nusuk.sa"
            or url.path != "/app"
            or url.fragment
            or len(parse_qs(url.query).get("id", [])) != 1
        ):
            raise ValueError("Unrecognized referral link")
        value = parse_qs(url.query)["id"][0]
    if not re.fullmatch(r"NG-[A-Za-z0-9]{8}", value):
        raise ValueError("Unknown provisional code syntax; needs manual investigation")
    return value


def read_csv(path, season, observed_at):
    if not re.fullmatch(r"\d{4}-\d{2}", season):
        raise ValueError("Season must use YYYY-MM")
    observed_at = timestamp(observed_at)
    raw = path.read_bytes()
    if len(raw) > MAX_BYTES:
        raise ValueError("CSV exceeds 5 MB")
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")), strict=True)
    if not reader.fieldnames or not {"code", "source_url"}.issubset(reader.fieldnames):
        raise ValueError(
            "Required columns: code,source_url; optional season,discovered_at,source_date"
        )
    if len(set(reader.fieldnames)) != len(reader.fieldnames):
        raise ValueError("Duplicate CSV headers")
    candidates = {}
    report = dict(
        rows=0,
        unique=0,
        duplicates=0,
        invalid=[],
        caseVariants=[],
        inputSha256=digest(raw),
    )
    for number, row in enumerate(reader, 2):
        report["rows"] += 1
        if report["rows"] > MAX_ROWS:
            raise ValueError("CSV exceeds 10,000 rows; split it offline")
        try:
            if None in row or any(value is None for value in row.values()):
                raise ValueError("Malformed CSV row/column count")
            code = parse_code(row["code"])
            if row.get("season") and row["season"] != season:
                raise ValueError("Row belongs to a different season")
            source = safe_source(row["source_url"].strip())
            discovered = timestamp(row.get("discovered_at") or observed_at)
            published = row.get("source_date", "").strip()
            if published:
                datetime.strptime(published, "%Y-%m-%d")
            evidence = dict(
                sourceUrl=source,
                discoveredAt=discovered,
                sourcePublishedAt=published or None,
            )
            entry = candidates.setdefault(
                code,
                dict(id=code_id(season, code), code=code, season=season, sources=[]),
            )
            if entry["sources"]:
                report["duplicates"] += 1
            if evidence not in entry["sources"]:
                entry["sources"].append(evidence)
            if len(entry["sources"]) > 20:
                raise ValueError("More than 20 source sightings per code in one import")
        except (ValueError, KeyError) as error:
            report["invalid"].append(dict(row=number, reason=str(error)))
    lower = {}
    for code in candidates:
        lower.setdefault(code.lower(), []).append(code)
    report["caseVariants"] = [values for values in lower.values() if len(values) > 1]
    report["unique"] = len(candidates)
    return sorted(candidates.values(), key=lambda c: c["code"]), report


def validate_record(record):
    if (
        not isinstance(record, dict)
        or record.get("season") != SEASON
        or parse_code(record["code"]) != record["code"]
        or record.get("id") != code_id(record["season"], record["code"])
        or record.get("status") not in STATUSES
        or record.get("verification") != VERIFICATION
        or record.get("redemptionVerified") is not False
    ):
        raise ValueError(
            "Invalid administrative record identity, season, status or verification"
        )
    safe_source(record["sourceUrl"])
    timestamp(record["discoveredAt"])
    return record


def check_review(record, decision, plan_id):
    if record is None:
        raise ValueError("Review record missing")
    validate_record(record)
    if decision.get("status") == "published" and not display_approved(decision):
        raise ValueError("Publication decision lacks display-policy approval")
    if record.get("reviewPlanId") == plan_id and record["status"] == decision["status"]:
        return "alreadyApplied"
    if (
        record.get("revision") != decision["expectedRevision"]
        or record["status"] != decision["expectedStatus"]
    ):
        raise ValueError("Review conflict; export and review a fresh plan")
    if record["code"] != decision["code"]:
        raise ValueError("Review code mismatch")
    return "ready"


def display_approved(value):
    """Display eligibility is distinct from redemption or independent source verification."""
    policy = value.get("publicationPolicy")
    if policy is not None:
        return (
            policy == COMMUNITY_POLICY
            and value.get("syntaxChecked") is True
            and value.get("seasonAttributed") is True
        )
    return value.get("sourceReviewed") is True and value.get("seasonReviewed") is True
