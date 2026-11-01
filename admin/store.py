"""Bounded Firestore adapter. One operation at a time; no bulk writer/delete API."""

import json
import os
from datetime import datetime, timezone
from urllib.parse import urlparse

from .model import (
    VERIFICATION,
    canonical,
    check_review,
    code_id,
    digest,
    validate_record,
)


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def connect(project, production, write, config):
    emulator = os.environ.get("FIRESTORE_EMULATOR_HOST")
    if emulator:
        parsed = urlparse("http://" + emulator)
        if (
            production
            or project != "demo-nusuk-codes"
            or parsed.hostname not in ("localhost", "127.0.0.1", "::1")
        ):
            raise ValueError(
                "Emulator requires loopback host and demo-nusuk-codes; never production"
            )
    else:
        if not production or project != config["projectId"] or project != "nusuk-codes":
            raise ValueError("Production requires --production --project nusuk-codes")
        if os.environ.get("NUSUK_ENABLE_PRODUCTION") != "nusuk-codes":
            raise ValueError(
                "Set NUSUK_ENABLE_PRODUCTION=nusuk-codes explicitly; no automatic production access"
            )
        if not (
            os.environ.get("NUSUK_FIREBASE_CREDENTIALS_JSON")
            or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        ):
            raise ValueError(
                "Supply NUSUK_FIREBASE_CREDENTIALS_JSON in the local environment or an explicit GOOGLE_APPLICATION_CREDENTIALS path; no implicit credential fallback"
            )
        if write and not config["updatesEnabled"]:
            raise ValueError("Updates are disabled in admin/config.json")
    # Lazy imports let CSV validation and pure tests run without any SDK/credentials.
    from google.cloud import firestore

    if emulator:
        from google.auth.credentials import AnonymousCredentials

        client = firestore.Client(project=project, credentials=AnonymousCredentials())
    else:
        import firebase_admin
        from firebase_admin import firestore as admin_firestore

        inline = os.environ.get("NUSUK_FIREBASE_CREDENTIALS_JSON")
        try:
            if inline:
                from firebase_admin import credentials

                payload = json.loads(inline)
                if payload.get("project_id") != project:
                    raise ValueError("Credential project mismatch")
                credential = credentials.Certificate(payload)
                app = firebase_admin.initialize_app(
                    credential, options={"projectId": project}
                )
            else:
                app = firebase_admin.initialize_app(options={"projectId": project})
        except Exception:
            raise ValueError(
                "Administrative credentials could not be initialized; details redacted"
            ) from None
        client = admin_firestore.client(app)
    return FirestoreStore(client)


class FirestoreStore:
    def __init__(self, client):
        self.client = client

    def get(self, identity):
        result = (
            self.client.collection("codes")
            .document(identity)
            .get(retry=None, timeout=20)
        )
        return dict(result.to_dict(), id=result.id) if result.exists else None

    def list(self, season, limit, published=False):
        from google.cloud.firestore_v1.base_query import FieldFilter

        query = self.client.collection("codes").where(
            filter=FieldFilter("season", "==", season)
        )
        if published:
            query = query.where(filter=FieldFilter("status", "==", "published"))
        rows = [
            dict(doc.to_dict(), id=doc.id)
            for doc in query.limit(limit + 1).stream(retry=None, timeout=30)
        ]
        if len(rows) > limit:
            raise ValueError(
                "Export limit exceeded; no truncated export/snapshot will be written"
            )
        return sorted(rows, key=lambda row: row["id"])

    def case_variants(self, season, code):
        from google.cloud.firestore_v1.base_query import FieldFilter

        exact = (
            self.client.collection("codes")
            .where(filter=FieldFilter("season", "==", season))
            .where(filter=FieldFilter("code", "==", code))
            .limit(2)
        )
        matches = list(exact.stream(retry=None, timeout=20))
        if len(matches) > 1 or any(doc.id != code_id(season, code) for doc in matches):
            raise ValueError(
                "Legacy/noncanonical exact duplicate exists; reconcile before import"
            )
        query = (
            self.client.collection("codes")
            .where(filter=FieldFilter("season", "==", season))
            .where(filter=FieldFilter("normalizedLookup", "==", code.lower()))
            .limit(3)
        )
        return [
            doc.id
            for doc in query.stream(retry=None, timeout=20)
            if doc.to_dict()["code"] != code
        ]

    def import_one(self, candidate, batch, actor, input_hash):
        from google.cloud import firestore

        ref = self.client.collection("codes").document(candidate["id"])
        sightings = []
        for source in candidate["sources"]:
            identity = digest(canonical(source))
            sightings.append((ref.collection("sources").document(identity), source))

        @firestore.transactional
        def operation(tx):
            existing = ref.get(transaction=tx, retry=None, timeout=20)
            source_docs = [
                (
                    source_ref,
                    source,
                    source_ref.get(transaction=tx, retry=None, timeout=20),
                )
                for source_ref, source in sightings
            ]
            if existing.exists:
                validate_record(dict(existing.to_dict(), id=existing.id))
            else:
                source = candidate["sources"][0]
                tx.create(
                    ref,
                    dict(
                        code=candidate["code"],
                        season=candidate["season"],
                        **source,
                        status="pending",
                        verification=VERIFICATION,
                        redemptionVerified=False,
                        importBatch=batch,
                        inputSha256=input_hash,
                        createdAt=now(),
                        createdBy=actor,
                        normalizedLookup=candidate["code"].lower(),
                        revision=0,
                    ),
                )
            added = 0
            for source_ref, source, doc in source_docs:
                if not doc.exists:
                    tx.create(
                        source_ref,
                        dict(
                            **source,
                            importBatch=batch,
                            inputSha256=input_hash,
                            recordedAt=now(),
                            recordedBy=actor,
                        ),
                    )
                    added += 1
            return dict(created=not existing.exists, sourcesAdded=added)

        # SDK transaction retries are bounded. An ambiguous commit is safe to replay.
        return operation(self.client.transaction(max_attempts=3))

    def review_one(self, decision, plan_id, actor):
        from google.cloud import firestore

        ref = self.client.collection("codes").document(decision["id"])

        @firestore.transactional
        def operation(tx):
            doc = ref.get(transaction=tx, retry=None, timeout=20)
            record = dict(doc.to_dict(), id=doc.id) if doc.exists else None
            if check_review(record, decision, plan_id) == "alreadyApplied":
                return "alreadyApplied"
            changes = dict(
                status=decision["status"],
                reviewedAt=now(),
                reviewedBy=actor,
                reviewNote=decision["note"],
                sourceReviewed=decision.get("sourceReviewed", False),
                seasonReviewed=decision.get("seasonReviewed", False),
                reviewPlanId=plan_id,
                revision=record["revision"] + 1,
            )
            tx.create(
                ref.collection("audit").document(plan_id),
                dict(**changes, previousStatus=record["status"]),
            )
            tx.update(ref, changes)
            return "updated"

        return operation(self.client.transaction(max_attempts=3))

    def export_sources(self, identity, limit=100):
        docs = list(
            self.client.collection("codes")
            .document(identity)
            .collection("sources")
            .limit(limit + 1)
            .stream(retry=None, timeout=20)
        )
        if len(docs) > limit:
            raise ValueError("Source export limit exceeded; no incomplete backup")
        return [dict(doc.to_dict(), id=doc.id) for doc in docs]

    def export_audit(self, identity, limit=100):
        docs = list(
            self.client.collection("codes")
            .document(identity)
            .collection("audit")
            .limit(limit + 1)
            .stream(retry=None, timeout=20)
        )
        if len(docs) > limit:
            raise ValueError("Audit export limit exceeded; no incomplete backup")
        return [dict(doc.to_dict(), id=doc.id) for doc in docs]
