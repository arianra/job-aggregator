# Spec E5 — Scoring Re-wire (Profile → ScoringSource from Primary Resume)

**Beads epic:** E5 · **Depends on:** E1 · **Blocks:** E6 (profile/dashboard behavior)
**References:** ADR-0008 N1–N3 (resolved) · overview §W6 · seams §6 (scoring seam approved)

## Problem Statement

`scoreJob(profile, job)` reads skills/experience straight off the Profile — fields that no longer
exist after E1. All four consumers (jobs, profile, applications, dashboard routers via
`hydrateProfile`) break until scoring is retargeted at the primary resume.

## Solution

Rewrite `scoreJob` big-bang to take a slim **ScoringSource** `{skills, experience, location,
preferences}` built from the **primary resume's latest saved ResumeVersion.data** plus person-level
`Profile.location`/`preferences`. No primary resume → scoring cannot run → jobs list shows unscored
(matches absent) and the UI surfaces the create-a-resume empty state. Existing Match rows were wiped
in E1's migration; fresh scoring starts clean.

## User Stories

1. As a user with a primary resume, I want jobs scored against my primary resume's latest saved data, so that scores reflect what I'd actually submit.
2. As a user, I want unsaved in-flight edits to NOT affect scoring, so that only deliberate Saves change my matches.
3. As a user without any resume, I want to see a clear "create your first resume to start scoring" state instead of broken/zero scores, so that I know what to do.
4. As a user, I want my person-level location + preferences (salary, remote, seniority intent) to keep feeding the geo/salary/preference dimensions, so that person intent stays person-level.
5. As a user, I want scoring behavior (dimensions, weights, reasons, flags) to work exactly as before, so that nothing about match quality regresses during the re-wire.
6. As a developer, I want `scoreJob(source: ScoringSource, job: Job)` decoupled from the resume doc model, so that the scorer never depends on editor internals.
7. As a developer, I want the ScoringSource builder to be a pure function, so that the Profile→Resume→Source pipeline is unit-testable end to end.

## Implementation Decisions

- **`ScoringSource` type (shared):** `{skills: Skill[], experience: Experience[], location: Location, preferences: ProfilePreferences}` — exactly the four inputs the six dimension scorers consume. This is the slim-group resolution of N1.
- **Pure builder:** `buildScoringSource(primaryResumeVersionData, profile) → ScoringSource | null` (null when no primary resume or no saved version). Mapping: `data.skills` categories flattened to `Skill[]`; `data.experience[]` → Experience[]; location from `profile.location` (N3); preferences from `profile.preferences`.
- **`scoreJob` signature change:** big-bang — all call sites updated in the same change. `scoreJobs` gains source resolution upstream (hydration fetches primary resume + latest version once per request batch, not per job).
- **Hydration re-target:** `hydrateProfile` split — identity/preferences hydrate stays; resume-derived inputs come through the new resume storage path. All 4 routers (jobs/profile/applications/dashboard) compile against the new shape.
- **No-primary behavior:** scoring skipped gracefully; routes return jobs without match dimensions; frontend (E6) shows the empty state.
- **Weights/dimensions:** UNCHANGED (skills .35, experience .2, location .15, salary .15, preferences .1, recency .05). Scoring expansions (ATS-informed, embeddings) are explicitly later work — out of this epic.

## Testing Decisions

- **Seam:** scoring seam (approved) — existing `scorer.test.ts` rewritten for the new signature: same dimension expectations, input via ScoringSource fixtures. New unit tests for `buildScoringSource` (flattening, null cases, person-level passthrough).
- Route-level: jobs endpoint returns unscored jobs when no primary resume (MockStorage); scored when primary + saved version exist.
- Prior art: `scorer.test.ts`, `jobs.test.ts`.

## Out of Scope

- Per-job targeting / "which resume for this job" (A3/U2 deferred). New scoring dimensions or weight changes. Frontend empty-state UI (E6).

## Further Notes

- GitNexus flags `hydrateProfile` as the highest-blast-radius symbol in the repo — this epic's definition of done is every consumer green with no behavior regression in dimension output.
