#!/usr/bin/env python3
"""
Historical incident database builder.

Requires Python 3.10+ (see requirements-history.txt: git-history>=0.7 needs
it - earlier 0.6.1 only found files at the repo root and silently produced
an empty db for a nested path like current/incidents.json).

Wraps git-history (https://github.com/simonw/git-history) to turn the `data`
branch's commit-by-commit snapshots of current/incidents.json into a SQLite
db with one row per distinct state an incident has taken on, rather than one
row per poll.
"""

import argparse
import sqlite3
import sys
from pathlib import Path

import git_history.cli as ghcli

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REPO = REPO_ROOT / "ingest" / ".data-branch"
DEFAULT_DB = REPO_ROOT / "ingest" / "history.db"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help="Output SQLite file")
    parser.add_argument(
        "--repo", type=Path, default=DEFAULT_REPO, help="Path to the data-branch checkout/worktree"
    )
    parser.add_argument("--branch", default="data", help="Git branch to walk")
    parser.add_argument(
        "--filepath",
        default="current/incidents.json",
        help="File to track, relative to --repo",
    )
    parser.add_argument("--id", dest="id_column", default="id", help="Column to use as item ID")
    args = parser.parse_args()

    repo = args.repo.resolve()
    filepath = repo / args.filepath
    if not filepath.exists():
        sys.exit(f"{filepath} does not exist - is --repo a checkout of the data branch?")

    ghcli.cli.main(
        args=[
            "file",
            str(args.db),
            str(filepath),
            "--repo",
            str(repo),
            "--branch",
            args.branch,
            "--id",
            args.id_column,
        ],
        prog_name="git-history",
        standalone_mode=False,
    )

    # git-history exits 0 and writes a db with no `item` table at all if
    # --branch/--filepath don't match any commits - e.g. a typo'd branch
    # name. Catch that here rather than silently producing a useless db.
    conn = sqlite3.connect(args.db)
    row = conn.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='item'"
    ).fetchone()
    item_count = conn.execute("SELECT COUNT(*) FROM item").fetchone()[0] if row[0] else 0
    conn.close()
    if item_count == 0:
        print(
            f"Warning: {args.db} has 0 rows in `item` - check --repo/--branch/--filepath",
            file=sys.stderr,
        )

    print(f"Wrote {args.db}")


if __name__ == "__main__":
    main()
