"""Targeted batch RPCs for quick imports; no evidence scans or permission changes."""

from .incremental import UpdateStopped

from .model import canonical, digest


def chunks(values, size):
    for offset in range(0, len(values), size):
        yield values[offset : offset + size]


class IncrementalStore:
    def __init__(self, store):
        self.store = store
        self.client = store.client

    def get_many(self, identities):
        records = {}
        for group in chunks(sorted(set(identities)), 100):
            refs = [self.client.collection("codes").document(i) for i in group]
            docs = list(self.client.get_all(refs, retry=None, timeout=30))
            if {d.id for d in docs} != set(group):
                raise UpdateStopped(
                    "Incomplete batch lookup; stop rather than infer absence"
                )
            for doc in docs:
                records[doc.id] = dict(doc.to_dict(), id=doc.id) if doc.exists else None
        return records

    def conflicts(self, candidates):
        from google.cloud.firestore_v1.base_query import FieldFilter

        matches, reads = {}, 0
        # Exact lookup also catches legacy IDs. Normalized lookup only flags case
        # variants; it NEVER identifies or merges a code. Both are input-scoped.
        for field, values in [
            ("code", sorted({r["code"] for r in candidates})),
            ("normalizedLookup", sorted({r["code"].lower() for r in candidates})),
        ]:
            for group in chunks(values, 30):
                query = (
                    self.client.collection("codes")
                    .where(filter=FieldFilter(field, "in", group))
                    .select(["code", "season", "status", "revision"])
                    .limit(101)
                )
                docs = list(query.stream(retry=None, timeout=30))
                if len(docs) > 100:
                    raise UpdateStopped("Input-scoped conflict query cap exceeded")
                reads += max(1, len(docs))
                for doc in docs:
                    matches[doc.id] = dict(doc.to_dict(), id=doc.id)
        return sorted(matches.values(), key=lambda r: r["id"]), reads

    def count(self, season, published=False):
        from google.cloud.firestore_v1.base_query import FieldFilter

        query = self.client.collection("codes").where(
            filter=FieldFilter("season", "==", season)
        )
        if published:
            query = query.where(filter=FieldFilter("status", "==", "published"))
        return int(query.count(alias="total").get(retry=None, timeout=30)[0][0].value)

    def published(self, season, limit):
        # One complete published-only query. No source/audit subcollections.
        from google.cloud.firestore_v1.base_query import FieldFilter

        fields = [
            "code",
            "season",
            "status",
            "verification",
            "redemptionVerified",
            "sourceUrl",
            "discoveredAt",
            "publicationPolicy",
            "syntaxChecked",
            "seasonAttributed",
            "sourceReviewed",
            "seasonReviewed",
            "reviewNote",
            "reviewedBy",
            "reviewPlanId",
            "revision",
            "reviewedAt",
        ]
        query = (
            self.client.collection("codes")
            .where(filter=FieldFilter("season", "==", season))
            .where(filter=FieldFilter("status", "==", "published"))
            .select(fields)
            .limit(limit + 1)
        )
        rows = [
            dict(doc.to_dict(), id=doc.id)
            for doc in query.stream(retry=None, timeout=30)
        ]
        if len(rows) > limit:
            raise UpdateStopped("Published snapshot cap exceeded; never truncate")
        return sorted(rows, key=lambda r: r["id"])

    def create_batch(self, records, batch_id, actor, input_hash):
        batch = self.client.batch()
        writes = 0
        for record, sources in records:
            identity = record["id"]
            ref = self.client.collection("codes").document(identity)
            batch.create(ref, {k: v for k, v in record.items() if k != "id"})
            writes += 1
            for source in sources:
                batch.create(
                    ref.collection("sources").document(digest(canonical(source))),
                    dict(
                        **source,
                        importBatch=batch_id,
                        inputSha256=input_hash,
                        recordedBy=actor,
                        recordedAt=record["createdAt"],
                    ),
                )
                writes += 1
            batch.create(
                ref.collection("audit").document(record["reviewPlanId"]),
                {
                    k: record[k]
                    for k in [
                        "status",
                        "revision",
                        "reviewedAt",
                        "reviewedBy",
                        "reviewNote",
                        "publicationPolicy",
                        "syntaxChecked",
                        "seasonAttributed",
                        "redemptionVerified",
                    ]
                }
                | {"previousStatus": None},
            )
            writes += 1
        if not 1 <= writes <= 250:
            raise UpdateStopped("Write batch exceeds 250 operations")
        # create() supplies exists=false preconditions for EVERY write. A conflict
        # fails the entire atomic batch. Ambiguous commits stop; replay re-plans.
        batch.commit(retry=None, timeout=30)
