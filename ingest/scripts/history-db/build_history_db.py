#!/usr/bin/env python3
"""
Historical incident database builder.

Requires Python 3.10+ (see requirements-history.txt: git-history>=0.7 needs
it - earlier 0.6.1 only found files at the repo root and silently produced
an empty db for a nested path like current/incidents.json).

Wraps git-history (https://github.com/simonw/git-history) to turn the `data`
branch's commit-by-commit snapshots of current/incidents.json into a SQLite
db with one row per distinct state an incident has taken on, rather than one
row per poll. Runs with --full-versions so every item_version row carries a
complete set of column values (not just the ones that changed), which the
presence enrichment below and the by-size chart both rely on.

git-history's schema only ever records value *changes* - it never records
that an id disappeared from the tracked file (resolved incidents just stop
getting new item_version rows, indistinguishable from "unchanged"). Since
"which incidents were active at time T" needs that fact, this script adds
its own enrichment pass after git-history runs: it walks any commits not yet
processed (tracked via a cursor stored in the db itself), reads the actual
current/incidents.json content at each one directly from git, and maintains
`_first_seen_commit`/`_last_seen_commit` columns on `item`. That keeps the db
self-sufficient - anything that needs "was this incident active, and what
size, as of commit C" can answer it from the db alone, without re-parsing
JSON at query time.
"""

import argparse
import json
import sqlite3
import subprocess
import sys
from pathlib import Path

import git_history.cli as ghcli

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_REPO = REPO_ROOT / "ingest" / ".data-branch"
DEFAULT_DB = REPO_ROOT / "ingest" / "history.db"


def enrich_presence(db_path: Path, repo: Path, filepath: str, id_column: str) -> None:
    conn = sqlite3.connect(db_path)
    try:
        cols = {row[1] for row in conn.execute("PRAGMA table_info(item)")}
        if "_first_seen_commit" not in cols:
            conn.execute("ALTER TABLE item ADD COLUMN _first_seen_commit INTEGER")
        if "_last_seen_commit" not in cols:
            conn.execute("ALTER TABLE item ADD COLUMN _last_seen_commit INTEGER")

        conn.execute(
            "CREATE TABLE IF NOT EXISTS _presence_cursor "
            "(id INTEGER PRIMARY KEY CHECK (id = 1), last_commit INTEGER NOT NULL)"
        )
        conn.execute("INSERT OR IGNORE INTO _presence_cursor (id, last_commit) VALUES (1, 0)")

        conn.execute(
            "UPDATE item SET _first_seen_commit = "
            "(SELECT MIN(_commit) FROM item_version WHERE item_version._item = item._id) "
            "WHERE _first_seen_commit IS NULL"
        )

        (last_processed,) = conn.execute("SELECT last_commit FROM _presence_cursor").fetchone()

        new_commits = conn.execute(
            "SELECT id, hash FROM commits WHERE id > ? ORDER BY id", (last_processed,)
        ).fetchall()

        max_processed = last_processed
        for commit_id, commit_hash in new_commits:
            result = subprocess.run(
                ["git", "-C", str(repo), "show", f"{commit_hash}:{filepath}"],
                capture_output=True,
                text=True,
            )
            # The tracked file may not exist yet at very early commits.
            ids_present = (
                [item[id_column] for item in json.loads(result.stdout)]
                if result.returncode == 0
                else []
            )

            if ids_present:
                conn.execute("CREATE TEMP TABLE IF NOT EXISTS _seen_ids (val)")
                conn.execute("DELETE FROM _seen_ids")
                conn.executemany(
                    "INSERT INTO _seen_ids (val) VALUES (?)", [(i,) for i in ids_present]
                )
                conn.execute(
                    f"UPDATE item SET _last_seen_commit = ? "
                    f"WHERE {id_column} IN (SELECT val FROM _seen_ids)",
                    (commit_id,),
                )
            max_processed = commit_id

        conn.execute("UPDATE _presence_cursor SET last_commit = ?", (max_processed,))
        conn.commit()
    finally:
        conn.close()


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
            "--full-versions",
            # The upstream feed has occasionally (3 of ~650 commits so far,
            # all one incident) emitted multiple Markers under one
            # INCIDENTID - fetch.py merges those going forward, but already
            # -committed historical commits still have the duplicates baked
            # in. Without this, git-history raises DuplicateIdsException and
            # the whole build aborts.
            "--ignore-duplicate-ids",
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
    else:
        enrich_presence(args.db, repo, args.filepath, args.id_column)

    print(f"Wrote {args.db}")


if __name__ == "__main__":
    main()
