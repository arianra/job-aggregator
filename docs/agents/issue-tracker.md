# Issue tracker: Beads

Issues and specs for this repo live in the local **Beads** database (`.beads/`),
synced to the git remote (`git+ssh://git@github.com/arianra/job-aggregator.git`) with
`bd dolt push/pull`. Use the **`bd`** CLI for all operations. `bd` auto-discovers the
database when run from inside the checkout (must run inside **WSL** — the embedded Dolt
DB needs real ext4 locks and fails on the `\\wsl.localhost` mount).

## Conventions

- **Create an issue / spec**: `bd create "Title" -d "description"`. For multi-line bodies
  use a heredoc, `-d "$(cat <<'EOF' … EOF)"`, or `--body-file -` (read from stdin).
  Batch a whole plan: `bd create --file plan.md` creates one issue per `##` heading.
- **Read an issue**: `bd show <id>` (alias `bd view`). `--long`/`--json` for more fields;
  `--include-comments` streams the full comment bodies.
- **List / query issues**: `bd list` with `--state` / `--label` / `--type` filters; `bd search <text>`
  for full-text; `bd ready` for the blocker-aware working set; `bd status` for a database overview.
- **Add a comment**: `bd comment <id> "text"` (also `--file notes.txt` or `--stdin`).
- **Apply / remove labels**: `bd label add <id> <label>` / `bd label remove <id> <label>`;
  or `bd update <id> --add-label "a,b" --remove-label "c"`. `--set-labels "a,b"` replaces all.
- **Assign / claim**: `bd update <id> --claim` — atomic claim that sets you as assignee and
  status to `in_progress` (idempotent if you already hold it). Or `bd assign <id> @me`.
- **Close**: `bd close <id>` (alias `bd done`), with `-r/--reason` for a closing reason. **`bd close`
  does NOT take a positional message** — use `-r/--reason`.
- **Issue identity**: ids look like `<repo-prefix>-<token>` (e.g. `job-aggregator-abc`);
  the prefix comes from the repo/dir on `bd init`. Copy ids exactly from `bd ready` / `bd create --json`.

## Dependencies — get the direction right

Beads' edge primitives are directional. The **wayfinder/tickets convention** is: *a ticket lists
the tickets that block **it***. To say "ticket X is blocked by blocker B":

```
bd link X B                  # id2 blocks id1  =>  B blocks X
bd dep B --blocks X          # equivalent      =>  B blocks X
```

⚠️ **Pitfall:** `bd create ... --deps 'blocks:<id>'` creates the **reverse** — the *new* issue
blocks `<id>`. (Verified live against real beads.) Do not express a ticket's own blockers that way.

## Pull requests as a triage surface

**PRs as a request surface: no.** Beads tracks issues only; if this repo receives external
PRs those live on GitHub and are out of this tracker's scope.

## When a skill says "publish to the issue tracker"

Create a bead: `bd create "Title" -d "..."`. For a batch, `bd create --file plan.md`.

## When a skill says "fetch the relevant ticket"

Run `bd show <id>` (alias `bd view`). For the full conversation, `bd show <id> --include-comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a bead; each **child** ticket is a flat bead (a sub-issue, not
a `--parent` subtree, so children stay queryable by `bd ready`), associated to the map and linked
to each other by blocking edges.

- **Map**: create a flat bead for the effort and label it, e.g.
  `bd create "Wayfinder: <effort>" -l wayfinder:map`.
- **Child ticket**: `bd create "<the question/decision>" -l wayfinder:<research|prototype|grilling|task> -d "<body>"`.
  Associate it to the map with `bd link <child> <map> --type parent-child` (keeps `bd graph` grouping
  without making it a subtree). Wayfinder's ticket *type* rides the `wayfinder:<type>` label — beads'
  default `--type` values are `bug|feature|task|epic|chore|decision`, so don't try to store
  `research/prototype/grilling` as the issue type.
- **Blocking**: a child is unblocked only when every ticket that blocks **it** is closed. Wire each
  blocker with `bd link <child> <blocker>` (or `bd dep <blocker> --blocks <child>`).
- **Frontier**: `bd ready` — open issues with no open blockers (excludes `in_progress`/`blocked`/`deferred`).
- **Claim**: `bd update <id> --claim`.
- **Resolve**: `bd comment <id> "<answer>"`, then `bd close <id> -r "resolved: <summary>"`.