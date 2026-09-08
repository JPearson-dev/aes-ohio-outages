#!/usr/bin/env bash
#
# update-data.sh: Local runner that fetches latest AES Ohio outage data
# and updates the local data worktree.
#
# Usage:
#   ./ingest/scripts/update-data.sh          # Fetches & updates files locally (no git commit)
#   ./ingest/scripts/update-data.sh --commit # Fetches, updates, and commits to git
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INGEST_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$INGEST_DIR/.data-branch"
DO_COMMIT=false

for arg in "$@"; do
    case "$arg" in
        --commit)
            DO_COMMIT=true
            ;;
        *)
            DATA_DIR="$arg"
            ;;
    esac
done

if [ ! -d "$DATA_DIR" ]; then
    echo "Error: Data directory '$DATA_DIR' not found."
    echo "Make sure the git worktree exists: git worktree add ingest/.data-branch data"
    exit 1
fi

echo "==> Fetching latest AES Ohio data into $DATA_DIR..."
python3 "$SCRIPT_DIR/fetch.py" --out-dir "$DATA_DIR"

cd "$DATA_DIR"
git add -A current/ heartbeat.csv README.md

if [ "$DO_COMMIT" = true ]; then
    if git diff --cached --quiet; then
        echo "==> No changes detected. Working tree clean."
    else
        TIMESTAMP=$(date -u +'%Y-%m-%d %H:%M UTC')
        git commit -m "Auto-update: $TIMESTAMP"
        echo "==> Committed snapshot: $TIMESTAMP"
    fi
else
    if ! git diff --cached --quiet; then
        echo "==> Files updated in $DATA_DIR. (Pass --commit to commit these changes)"
    else
        echo "==> No changes detected."
    fi
fi
