#!/usr/bin/env python3
"""
Historical incident database builder.

Wraps git-history (https://github.com/simonw/git-history) to turn the `data`
branch's commit-by-commit snapshots of current/incidents.json into a SQLite
db with one row per distinct state an incident has taken on, rather than one
row per poll.

Works around a bug in git-history 0.6.1: its `file` command only finds files
that live at the repo root. iterate_file_versions() matches a commit's direct
root-tree blobs (commit.tree.blobs) against the file's full relative path, so
a nested path like current/incidents.json never matches anything and the
command silently produces an empty db - no error, exit code 0. This patches
in a version that resolves the blob at its actual path (commit.tree / path)
instead. Safe to remove if a future git-history release fixes this upstream.
"""

import argparse
import sys
from pathlib import Path

import git
import git_history.cli as ghcli


def _iterate_file_versions_fixed(
    repo_path, filepath, ref="main", commits_to_skip=None, show_progress=False
):
    import click

    relative_path = str(Path(filepath).relative_to(repo_path))
    repo = git.Repo(repo_path, odbt=git.GitDB)
    commits = reversed(list(repo.iter_commits(ref, paths=[relative_path])))
    if commits_to_skip:
        commits = [c for c in commits if c.hexsha not in commits_to_skip]
    progress_bar = None
    if show_progress:
        progress_bar = click.progressbar(commits, show_pos=True, show_percent=True)
    for commit in commits:
        if progress_bar:
            progress_bar.update(1)
        try:
            blob = commit.tree / relative_path
        except KeyError:
            # This commit doesn't have a copy of the requested file
            continue
        yield commit.committed_datetime, commit.hexsha, blob.data_stream.read()


ghcli.iterate_file_versions = _iterate_file_versions_fixed

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
    print(f"Wrote {args.db}")


if __name__ == "__main__":
    main()
