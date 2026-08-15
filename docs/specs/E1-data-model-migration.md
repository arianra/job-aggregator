# Spec E1 — Data Model & Migration (Profile → Resume → ResumeVersion)

**Beads epic:** E1 · **Depends on:** — · **Blocks:** E2, E3, E4, E5
**References:** ADR-0008 · `docs/resume-implementation-overview.md` §W1 · confirmed seams §6

## Problem Statement

The current `Profile` is simultaneously the person and the holder of resume content
(`skills/experience/education/certifications/resume` as Json columns). A person has ONE profile
but must author MANY versioned resumes. The model cannot express "many documents per person" and
carries two sources of truth for the same facts.

## Solution

Refactor to **Profile (person) → Resume (document, many) → ResumeVersion (immutable snapshots,
manual Save only)** per ADR-0008. Big-bang: one-time data migration seeds each existing profile's
resume data into one Resume + one ResumeVersion, drops the legacy columns, wipes existing Match
rows, and retargets every reader in the same change-set. No compatibility shim.

## User Stories

1. As a user, I want my existing profile data to become my first resume automatically, so that nothing I entered is lost.
2. As a user, I want my identity fields (name, email, phone, location) to stay on my profile, so that they are not duplicated per document.
3. As a user, I want my preferences (salary, remote, seniority intent) to stay on my profile, so that job intent is person-level.
4. As a developer, I want `Resume` to carry `title`, `format`, `status (NEW|SAVED)`, `original_raw_text?`, and `primary`, so that document metadata lives with the document.
5. As a developer, I want `ResumeVersion` to carry `revision (Int, additive)`, `created_at`, and `data (Json)`, so that each manual Save is an immutable dated snapshot.
6. As a developer, I want exactly one primary Resume enforced per Profile, so that scoring has a single deterministic source.
7. As a developer, I want the legacy Profile columns dropped after migration, so that there is no dead schema or dual source of truth.
8. As a developer, I want the migration to be re-runnable/safe (idempotent seed: skip if the profile already has resumes), so that dev resets don't corrupt data.
9. As a developer, I want `docs/ontology.md` and `docs/database-schema.md` updated to the new model, so that the written docs match reality.

## Implementation Decisions

- **Schema (Prisma):** new `Resume { id, profile_id FK, title, format String @default("compact"), status String @default("NEW"), primary Boolean @default(false), original_raw_text String?, created_at, updated_at, versions ResumeVersion[] }`; new `ResumeVersion { id, resume_id FK onDelete Cascade, revision Int, created_at, data Json, @@unique([resume_id, revision]) }`. `Profile` drops `experience, education, certifications, skills, resume`; keeps `name, email?, phone?, location?, preferences, search_queries` + relations.
- **`status` enum is exactly `NEW | SAVED | ARCHIVED`** (ADR-0008 defines NEW/SAVED; ARCHIVED covers the archive lifecycle). NOTE: the prototype seed shows `status:'live'` — that is DISPLAY vocabulary (Live = not archived), NOT the stored enum. Do not copy it.
- **`settings` canonical shape is LONG-NAMED and CSS-free:** `{fontSize:number(pt), lineHeight:number, spacing:number, typeface:'serif'|'sans', paperA4:boolean}`. NOTE: the prototype stores shorthand `{fs, lh, spacing, typeface:'var(--serif)'}` — the shorthand is display-only; `var(--serif)` is a CSS token and must be stored as the plain token name (`serif`).
- **`data` blob shape** (the `ResumeDoc`): exactly the ADR-0004 §6.5 document shape as embodied by the prototype — `contact {name,email,phone,linkedin,country,state,city}` + per-field visibility, `summary`, `experience[] {role,company,dates,location,bullets[]}`, `education[] {degree,school,location,year}`, `skills {category:[...]}` ordered, `certifications[] {title,issuer,year}`, `sections {order[],visibility{}}`, `settings {fontSize,lineHeight,spacing,typeface,paperA4}`. Shared workspace exports this as the `ResumeDoc` type.
- **Migration:** Prisma migrate + a data-seeding step: for each Profile, create one Resume (title = "My resume", primary = true, status = "SAVED", original_raw_text = old `resume.parsed_text`, format = "compact") + one ResumeVersion (revision 0, data built from old `skills/experience/education/certifications` mapped into ResumeDoc shape). Then **delete all Match rows** (B11). Then drop the legacy columns.
- **Field mapping (old → data blob):** `Profile.skills[] {name,...}` → `skills.Development[]` (names only); `Profile.experience[]` → `experience[]` (title→role, description→bullets split by newlines); `Profile.education[]` → `education[]`; `Profile.certifications[]` → `certifications[]`; contact from `name/email/phone/location`.
- **Primary enforcement:** a single storage-layer function guarantees ≤1 primary per profile (setting primary on one clears others) — pure at the adapter level, not scattered in routes.
- **Functional discipline:** mapping old→new is a pure function `legacyProfileToResumeDoc(profile) → ResumeDoc` — unit-testable without a database. All side effects live in the migration runner + storage adapter.
- **Storage seam:** the `Storage` interface (shared) gains resume methods; `MockStorage` gets a resume implementation FIRST (test-first), then `PrismaStorage`.

## Testing Decisions

- **Seams used:** Storage-adapter seam via MockStorage (resume CRUD, version append, primary enforcement) + pure `legacyProfileToResumeDoc` unit tests. HTTP seam for this epic is E2's job — E1 ships the model + adapter.
- Prior art: `mock-storage.test.ts`, `prisma-storage.test.ts` (collocated vitest).
- Good test = behavior through the Storage interface: "saving resume data appends version with next revision number", "setting primary on resume B clears primary on resume A".
- Migration tested against the seeded sample profile (docker Postgres) + an idempotency test (run twice, no duplicates).

## Out of Scope

- Resume CRUD HTTP routes (E2). DOCX/PDF (E3). ATS (E4). Scorer re-wire (E5). Frontend (E6).
- Any read-compat shim for legacy Profile fields (explicitly rejected: big-bang).

## Further Notes

- The migration is the riskiest change in the whole program (GitNexus: `hydrateProfile` HIGH risk, 8 consumers across 4 routers). Every router touching profile must compile and pass after the drop — that is part of this epic's definition of done.
- `status` semantics: NEW rows exist pre-first-save so refresh survives; validations skip NEW rows.
