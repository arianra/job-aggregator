# Domain Docs — Obsidian Atlas (Karpathy LLM-wiki)

Durable domain knowledge for this repo lives in an **Obsidian vault** as an interlinked markdown
KB — a Karpathy-style **LLM-wiki** (compile knowledge once, cross-link it, keep it current; no
re-derivation per query). ADRs and code-coupled decisions stay in the repo.

## Vault (the doc layout is the Atlas)

- **Vault root** = the *inner* of a nested folder:
  `C:\Users\aria\iCloudDrive\Documents\obsidian\massiveboi\massiveboi`
  (the outer `massiveboi/` is just a wrapper). `OBSIDIAN_VAULT_PATH` is set in the Hermes `.env`.
  Atlas root = `<vault>/Atlas/`. It's on **iCloud Drive** → prefer `cp` + `rm` over `mv` for moves.
- **Glossary / shared language** — the Atlas domain/glossary page. Read `Atlas/_ontology.md`,
  `Atlas/_index.md`, and `Atlas/_journey.md` first. Agents use the glossary's vocabulary exactly.
- **Research findings & durable lessons/decisions** — filed in the vault as interlinked pages
  (`[[wikilinks]]`, YAML frontmatter; added to `Atlas/_index.md` + `Atlas/_journey.md`). Use the
  `atlas-ontology` skill for the file → cross-link → index → log routine.
- **ADRs / hard-to-reverse decisions** — **repo** `docs/adr/` (code-coupled, machine-synced).
- **Repo pointer** — the `## Agent skills` block in `AGENTS.md` points agents at the vault glossary
  so vocab is discoverable without opening the vault.

## Before exploring, read these

- The vault glossary / domain page: resolve `OBSIDIAN_VAULT_PATH`, read `Atlas/_ontology.md` +
  `Atlas/_index.md`. (Load the `atlas-ontology` skill.)
- `docs/adr/` in the repo (ADRs stay repo-side even in the Atlas layout).

## Filing durable knowledge

When this repo's layout is the Atlas, `research` / `domain-modeling` / `grill-with-docs` / `handoff`
file durable output — shared terms, findings, decisions, lessons — into the vault as **interlinked
pages**: frontmatter + `[[wikilinks]]` to ≥2 existing pages, added to the index and the activity log.
Do **not** file transient/one-off notes. Keep ADRs in `docs/adr/`.

## Use the glossary's vocabulary

Name domain concepts (issue titles, refactor proposals, hypotheses, test names) using the vault
glossary's terms. If a concept isn't glossed yet, that's a signal — inventing language the project
doesn't use (reconsider) or a real gap (note it for `/domain-modeling`).