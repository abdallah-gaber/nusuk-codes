"""Optional reviewed Git handoff. No merge, deployment or Firebase credentials in CI."""

from .incremental import UpdateStopped

import subprocess
from pathlib import Path

REPO = "abdallah-gaber/nusuk-codes"


def git(root, *args):
    return subprocess.run(
        ["git", *args], cwd=root, text=True, check=True, capture_output=True, timeout=60
    ).stdout.strip()


def check_release_base(root):
    if (
        git(root, "status", "--porcelain")
        or git(root, "branch", "--show-current") != "main"
    ):
        raise UpdateStopped("Automatic PR preparation requires a clean main checkout")
    remote = git(root, "remote", "get-url", "origin")
    if remote not in [f"https://github.com/{REPO}.git", f"git@github.com:{REPO}.git"]:
        raise UpdateStopped("Unexpected publication repository")
    git(root, "fetch", "origin", "main")
    base = git(root, "rev-parse", "HEAD")
    if base != git(root, "rev-parse", "origin/main"):
        raise UpdateStopped(
            "Update clean main before importing; no automatic reset/merge"
        )
    subprocess.run(
        ["gh", "auth", "status"], cwd=root, capture_output=True, check=True, timeout=30
    )
    return base


def create_pr(root, plan, result, output, expected_base):
    if (
        git(root, "branch", "--show-current") != "main"
        or git(root, "rev-parse", "HEAD") != expected_base
        or git(root, "diff", "--cached", "--name-only")
    ):
        raise UpdateStopped(
            "Git base/index changed during import; finish the PR manually"
        )
    manifest = result["promotion"]
    asset = f"public/data/codes.{result['snapshotSha256'][:16]}.json"
    paths = ["public/data/manifest.json", asset, manifest["backup"]]
    # No -A: never stage inputs, exports, credentials, operator reports or code.
    changed = set(git(root, "diff", "--name-only").splitlines())
    untracked = set(
        git(root, "ls-files", "--others", "--exclude-standard").splitlines()
    )
    if not (changed | untracked).issubset(paths):
        raise UpdateStopped(
            "Unrelated files changed; prepare PR manually without staging them"
        )
    branch = f"codes/{plan['season']}-{plan['planId'][:16]}"
    git(root, "switch", "-c", branch)
    git(root, "add", "--", *paths)
    if not set(git(root, "diff", "--cached", "--name-only").splitlines()).issubset(
        paths
    ):
        raise UpdateStopped("Unrelated staged files; refuse to commit private data")
    git(root, "diff", "--cached", "--check")
    git(
        root,
        "commit",
        "-m",
        f"Publish {result['codeCount']} unverified community codes",
    )
    git(root, "push", "-u", "origin", branch)
    body = output / "pr.md"
    body.write_text(
        f"Routine incremental update: {plan['new']} new codes; {plan['existing']} existing records untouched.\n\n"
        f"Complete published-only snapshot: {result['codeCount']} codes, SHA-256 `{result['snapshotSha256']}`. "
        "Touched records/counts verified. Schema, checksum, public fields and additive-only preservation passed. "
        f"Previous manifest: `{manifest['backup']}`; old immutable assets retained.\n\n"
        "All codes remain community-unverified; no redemption claim. No private operator data or credentials included. "
        "Await owner review and existing CI. Do not merge/deploy automatically. "
        "After approved deployment, run `npm run codes:verify-live` exactly once.\n"
    )
    return subprocess.run(
        [
            "gh",
            "pr",
            "create",
            "--repo",
            REPO,
            "--base",
            "main",
            "--head",
            branch,
            "--title",
            f"Publish {result['codeCount']} unverified community codes",
            "--body-file",
            str(Path(body).resolve()),
        ],
        cwd=root,
        text=True,
        check=True,
        capture_output=True,
        timeout=60,
    ).stdout.strip()
