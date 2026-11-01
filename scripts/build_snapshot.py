"""Offline Phase 1 candidate fixture exporter. Does NOT approve or validate redemption."""
import csv, hashlib, json, pathlib, gzip, re
from urllib.parse import urlparse
root = pathlib.Path(__file__).resolve().parents[1]
rows = list(csv.DictReader((root / 'data/current_season_codes.csv').open(encoding='utf-8-sig')))
assert len(rows) == 1132 and len({r['code'] for r in rows}) == 1132
assert all(r['season'] == '2026-11' and r['status'] == 'community_submitted_unverified' for r in rows)
assert all(re.fullmatch(r'NG-[A-Za-z0-9]{8}', r['code']) for r in rows)
assert all(urlparse(r['source_url']).scheme == 'https' and urlparse(r['source_url']).hostname in {'www.facebook.com', 'services.nusuk.sa'} for r in rows)
# Full private provenance stays in data/; public fixture exposes domains only.
payload = {'schemaVersion': 1, 'season': 'nov-2026', 'codes': [
    {'code': r['code'], 'status': r['status'], 'source': 'services.nusuk.sa' if 'services.nusuk.sa' in r['source_url'] else 'facebook.com', 'observedAt': '2026-11-01'} for r in rows]}
raw = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode()
digest = hashlib.sha256(raw).hexdigest()
folder = root / 'public/data'
folder.mkdir(parents=True, exist_ok=True)
(folder / f'codes.{digest[:16]}.json').write_bytes(raw)
manifest = dict(schemaVersion=1, season='nov-2026', generatedAt='2026-11-01T00:00:00Z', codeCount=len(rows), snapshotUrl=f'/data/codes.{digest[:16]}.json', snapshotSha256=digest, readOnly=True, submissionsEnabled=False, candidatePreview=True, maintenance=False)
(folder / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'{len(rows)} candidates; {len(raw)} bytes / {len(gzip.compress(raw))} gzip bytes. No redemption verification.')
