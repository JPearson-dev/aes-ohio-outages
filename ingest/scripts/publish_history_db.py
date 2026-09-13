#!/usr/bin/env python3
"""
Publishes a built history.db into site/public as an immutable, uniquely-named
file plus a history-latest.json pointer.

Why not just overwrite one fixed history.db in place: the file's bytes aren't
stable across builds (SQLite page layout can shift even for unrelated rows),
so a browser tab mid-session (datasette, or a future direct-SQL feature) could
get torn reads if the file underneath it changes. Publishing each build under
its own name and pointing a small JSON file at the current one means an
already-open tab just keeps talking to the (still-present) file it started
with. See docs/site.md's "Handling a version-swap..." section.
"""

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = REPO_ROOT / "ingest" / "history.db"
DEFAULT_OUT_DIR = REPO_ROOT / "site" / "public"
DEFAULT_DATA_REPO = REPO_ROOT / "ingest" / ".data-branch"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help="Built db to publish")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR, help="Site public dir")
    parser.add_argument(
        "--data-repo",
        type=Path,
        default=DEFAULT_DATA_REPO,
        help="Data-branch checkout, used to derive the build id from its HEAD commit",
    )
    parser.add_argument(
        "--build-id",
        help="Override the build id (default: short SHA of --data-repo's HEAD)",
    )
    args = parser.parse_args()

    if not args.db.exists():
        sys.exit(f"{args.db} does not exist - run build_history_db.py first")

    build_id = args.build_id or subprocess.run(
        ["git", "-C", str(args.data_repo), "rev-parse", "--short", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"history.{build_id}.db"
    shutil.copyfile(args.db, args.out_dir / filename)

    pointer = {
        "file": filename,
        "built_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_commit": build_id,
    }
    pointer_path = args.out_dir / "history-latest.json"
    pointer_path.write_text(json.dumps(pointer, indent=2) + "\n")

    print(f"Published {args.out_dir / filename}, pointer updated at {pointer_path}")


if __name__ == "__main__":
    main()
