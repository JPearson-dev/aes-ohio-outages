# Local Development

## Site (`site/`)

* **Node:** `^20.19.0 || >=22.12.0` (Vite 8's requirement).
* Setup: `cd site && npm install`
* Run: `npm run dev` (Vite dev server)
* Build: `npm run build` (`tsc -b && vite build`) — plain `tsc --noEmit` silently no-ops here because of the project's [composite tsconfig](https://www.typescriptlang.org/docs/handbook/project-references.html) setup; use `tsc -b --noEmit` (or just `npm run build`) to actually typecheck.
* Lint: `npm run lint` (oxlint)

## Ingest (`ingest/`)

* **Python:** 3.9+ covers `fetch.py` and `update-data.sh` (stdlib only). Building the historical db additionally needs **Python 3.10+** (see below).
* **Shell:** bash (for `update-data.sh`).

### Fetching data locally

`update-data.sh` writes into a git worktree of the `data` branch, kept at `ingest/.data-branch` so it doesn't disturb your `main` checkout:

```bash
git worktree add ingest/.data-branch data   # one-time setup
./ingest/scripts/update-data.sh              # fetch + update files, no commit
./ingest/scripts/update-data.sh --commit     # fetch + update + commit to data branch
```

### Building the historical incident db (`history.db`)

`build_history_db.py` wraps [`git-history`](https://github.com/simonw/git-history) to turn the `data` branch's commit history of `current/incidents.json` into a queryable SQLite db (see [site.md](site.md) for why). It requires **Python 3.10+** — `git-history` 0.6.1 (the version older Python resolves to) has a bug where it never finds files in subfolders and silently produces an empty db.

```bash
python3.10 -m venv .venv-history        # any 3.10+ interpreter; a disposable env is fine
source .venv-history/bin/activate
pip install -r ingest/scripts/requirements-history.txt
python ingest/scripts/build_history_db.py   # writes ingest/history.db by default
```

Requires the `ingest/.data-branch` worktree (above) to already exist. The script prints a warning (without failing) if the resulting db has zero rows — usually a sign `--repo`/`--branch`/`--filepath` don't match what you expect.

Not yet wired into CI — see the README roadmap for the planned GitHub Action + `actions/cache` version.
