"""One read-only CDN integrity check after an owner-approved deployment; no Firestore."""

import json
from pathlib import Path

from .publishing import checked_pair


def main():
    import requests

    root = Path(__file__).resolve().parents[1]
    expected = json.loads((root / "public/data/manifest.json").read_text())
    base = "https://nusuk.abdallahgaber.dev"
    response = requests.get(
        base + "/data/manifest.json", headers={"Cache-Control": "no-cache"}, timeout=30
    )
    response.raise_for_status()
    manifest = response.json()
    if manifest != expected:
        raise ValueError(
            "Production manifest differs from reviewed release; stop, do not republish"
        )
    response = requests.get(base + expected["snapshotUrl"], timeout=30)
    response.raise_for_status()
    data = checked_pair(manifest, response.content)
    print(
        json.dumps(
            dict(
                codeCount=len(data["codes"]),
                snapshotSha256=manifest["snapshotSha256"],
                valid=True,
            )
        )
    )


if __name__ == "__main__":
    main()
