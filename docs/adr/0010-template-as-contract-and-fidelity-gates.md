# ADR-0010 — Template-as-Contract, DOCX-as-Artifact (template system + fidelity gates)

- **Status:** Proposed
- **Date:** 2026-08-16
- **Owner:** job-aggregator
- **Scope:** Define how document *style* is represented, authored, and kept honest: a template is a
  **pure config object derived from a reference DOCX**; structured data + template → DOCX (the
  canonical artifact); PDF and the live HTML preview are **projections** of the same two inputs;
  **fidelity gates** (structural XML assertions + pixel-level snapshot tests) prove every projection
  stays faithful to the DOCX. Adding a template = adding a DOCX.
- **Related:** `0004` (DOCX-first authoring + §2 fixed format), `0008` (ResumeDoc as source of truth,
  versions never store artifacts), `0009` (draft/commit state flow — this ADR's renderers consume
  whatever live document it settles), `docs/specs/E3-docx-pdf-pipeline.md` (renderer seam),
  `docs/specs/E6-frontend-studio.md` (two-tier preview), golden `~/resume-golden/cv2026-003/`.

---

## Context

Three validated problems motivate this decision:

1. **The DOCX output does not match the rendered HTML.** Mechanical inspection of
   `backend/src/services/docx-builder.ts` against the golden DOCX (`cv2026/003`) found **7 measurable
   drifts**: font (hardcoded Calibri vs Merriweather/Merriweather Light), margins (600/850 twips vs
   720 all sides), missing `ReziHeading` divider rules (top gray + bottom black border), contact line
   size/weight (sz 13 normal vs sz 12 bold), line height (1.42 vs ~1.17), no paper size, no job
   separators (golden uses empty paragraphs). Two renderers, two hand-written copies of the style,
   no shared numbers, no unit discipline, no gate — drift was invisible until eyeballed.
2. **"Style" has no home.** The golden's formatting lives only *inside* its OOXML: named styles
   (`ReziHeading` = paragraph borders; the `header` style of the clean HICV candidate = bottom
   border), `docDefaults` fonts, `sectPr` geometry, per-run half-point sizes. Nothing in the codebase
   represents that as data, so nothing can consume it twice (DOCX builder + HTML preview) or verify it.
3. **Template extension has no path.** The product intent (E6: `format` field; later templates beyond
   `compact`) needs a mechanical way to turn *a DOCX somebody hands us* into a supported template.
   Landscape research (this session) shows clean single-column resume DOCX are rare — **1 of 2,132**
   HICV templates and **~5 of ~250** other surveyed files survive a structural audit — so the audit
   must live at the door, and derivation must be scripted, not hand-built.

**Scope anchor (kept from user steering):** the DOCX is the **leading end result**. Within the app we
create the DOCX from structured data. Rendering that DOCX through PDF for the *accurate* preview is
acceptable (PDF ≡ DOCX by construction, LibreOffice converts the actual bytes) — but the flow, the
contract, and the gates all center on the DOCX.

## Decision drivers

| # | Driver | Why it matters |
|---|---|---|
| D1 | DOCX is canonical; one stored artifact (structured data) | ADR-0004/0008 invariants; never re-litigated here |
| D2 | Style defined **once**, consumed by every renderer | Eliminates the drift class by construction |
| D3 | Adding a template = dropping a DOCX + scripted derivation | Extension without re-engineering per template |
| D4 | Fidelity must be *measured*, not eyeballed | "close enough" needs a number and a failing test |
| D5 | Feature controls (font, size, line-height, spacing, auto-fit, A4) behave identically in preview and export | User-facing control only works if it's one definition applied twice |
| D6 | ATS-safety guarantees (no tables/textboxes/images, single column, fixed section order) | The no-drift contract is also an ATS-parseability guarantee |
| D7 | Local-tooling reality: LibreOffice installed; no sudo (fonts/rasterizer must not need root) | Gates must run on this box and in Docker alike |

## Options considered

### A. How the style is represented & consumed

| Option | What | Pros | Cons | Verdict |
|---|---|---|---|---|
| **A1. Template-as-data → twin projections** | `ResumeTemplate` config in `shared/`; `resolve(template, settings) → ResolvedTemplate`; DOCX builder (docx.js) and HTML preview both consume the resolved object through one unit-conversion module | Style defined once; drift impossible without failing a gate; unit discipline in exactly one place; validated at scale (Reactive Resume: `TEMPLATE_CONFIGS` + separate docx.js builder + react-pdf renderer, 15 templates; EOl law ats-engine: JSON → template_engine → renderers); additive templates = new config objects | Schema must encode the expressible subset (by design); bootstrap cost of schema + conversions; HTML↔Word layout engines still differ at wrap/pagination level (mitigated by gates) | ✅ **Chosen** |
| **A2. HTML-as-authority → HTML→DOCX conversion** | Author CSS; convert to DOCX at export (`@turbodocx/html-to-docx` MIT v1.22 active; `beautiful-docx` ISC v1.0.15 active) | Preview ≡ export by construction (DOCX derived from the CSS) | **Inverts authority**: CSS subset is lossy — source-verified: turbodocx has no letter-spacing; ATS guarantees become post-hoc checks; OOXML semantics (named styles, borders) approximated; every project that tried HTML-authority for resumes ended up rebuilding a docx generator | ❌ Rejected |
| **A3. DOCX-as-template (placeholder fill)** | Template is the .docx itself (`docxtemplater` MIT v3.69 active; python `docxtpl`) | Perfect DOCX fidelity; zero code per template; editable by non-programmers in Word | Dynamic content (N jobs, N bullets, optional sections) breaks fixed layouts — cautionary tale: `jsonresume-docx` pads columns with literal spaces ("can make or break the appearance"); HTML preview becomes a third implementation; wrong direction for structured data | ❌ Rejected |
| **A4. Pandoc `--reference-doc`** | Pandoc adopts a reference DOCX's styles/margins/page size for output | The conceptual prior art for "the DOCX **is** the template" (content ignored, styles adopted) | GPL toolchain; HTML preview is still separate; flow/content model doesn't map to our structured ResumeDoc | ❌ Concept borrowed, tool rejected |

### B. How the live preview renders

| Option | What | Pros | Cons | Verdict |
|---|---|---|---|---|
| **B1. Two-tier: HTML projection + accurate DOCX render** | Per-keystroke CSS projection of ResolvedTemplate; manual action renders the real DOCX → LibreOffice → PDF page images (E3 already built: `render-preview`) | Cheap typing surface; accurate pane ≡ export artifact; settled in ADR-0004 §4.1/E6 | Two render surfaces to keep honest (that's what the gates are for) | ✅ **Chosen** (status quo, now gated) |
| **B2. Preview = rendered artifact** | RR v5's move: generate the real output client-side (`@react-pdf/renderer`) and display it via pdfjs canvases | Identity by construction; no approximation tier | Per-keystroke cost for a heavy render; our output is DOCX not PDF (client-side DOCX render would need OfficeCLI/docxjs-class engines — new dependency + fidelity unknown) | ❌ Fallback if B1 gates prove too costly |
| **B3. Render the real DOCX in-browser per keystroke** (`docx-preview`/docxjs, or `docx-preview-sync`) | Show actual OOXML rendering live | No approximation | Verified open fidelity issues (#178 tabStops, #187 empty-paragraph heights, #195 text-indent, no live pagination; pagination fork stalled 2024); per-keystroke server round-trip for an on-demand pipeline | ❌ Rejected |

### C. How templates enter the system

| Option | What | Pros | Cons | Verdict |
|---|---|---|---|---|
| **C1. Extract: reference DOCX → candidate config + fitness audit → human slot review → acceptance gate** | Scripted OOXML parse (prototyped this session on the golden + 463 files) | Mechanical; fitness audit rejects decorative DOCX at the door (validated: 462/463 HICV files fail it); human effort limited to semantic slot mapping (~10 min for a clean DOCX); acceptance gate proves render-back fidelity | Extraction cannot judge semantics (which style = sectionHeading) — needs one review step | ✅ **Chosen** |
| **C2. Hand-code each template** | Write config + renderer tweaks by hand | Full control | Doesn't scale; reintroduces drift; contradicts D3 | ❌ Rejected |
| **C3. Runtime upload of arbitrary DOCX as template** | User uploads, we render | Maximally flexible | Arbitrary layouts break the no-drift contract + ATS guarantees; out of scope for resumes/cover letters | ❌ Rejected |

### D. How fidelity is assured

| Option | What | Pros | Cons | Verdict |
|---|---|---|---|---|
| **D1. Two-tier gates: structural (XML) + snapshot (pixels)** | G1 extracts XML from `buildDocx` output and asserts it equals the template config; G2 rasterizes DOCX→PDF→PNG and pixel-diffs against committed baselines | G1 names the *cause* (fast, deterministic, CI); G2 catches the *effect* — everything visual: colors, dividers, alignment, sizes, fonts, shading | Two mechanisms to maintain; pixel tests need baseline hygiene | ✅ **Chosen** |
| **D2. Structural only** | XML assertions | Cheap | Can't see rendering outcomes (e.g. a wrong `w:line` value is "correct" XML but wrong spacing) | ❌ Insufficient |
| **D3. Pixel only** | Snapshot tests | Catches everything visual | Can't name the cause; threshold tuning is guesswork without the structural layer | ❌ Insufficient |

## Decision

1. **Style = data.** Introduce `shared/src/resume-template/`:
   - `ResumeTemplate` — the contract object: `id`, `derivedFrom` (provenance), `page` (size + margins
     in twips), `fonts` (body/bold families + fallbacks), `slots` (name, contactLine, sectionHeading,
     roleTitle, companyLine, body, bullet — each size in half-points, weight, spacing), `decorations`
     (heading border rules — where `ReziHeading`'s top-gray/bottom-black lives), `sectionOrder`,
     `layout` (job separator, etc.). **All values DOCX-native** (half-points, twips, 240ths-of-line);
     CSS is always a derived projection.
   - `resolve(template, settings) → ResolvedTemplate` — settings (typeface, font-size scale,
     line-height, spacing, A4/Letter, auto-fit scale) are *transformations of the template*, applied
     here and nowhere else.
   - One pure **unit-conversion module** (halfPoints↔pt↔CSS-px, twips↔pt, line-240ths↔multiplier).
     The only place OOXML↔CSS translation exists.
2. **Both renderers consume the resolved object.** `buildDocx(doc, resolved) → bytes` (refactor of
   the current builder — its hardcoded values become the extracted `compact` config) and the E6
   `LivePreview` (CSS from the same resolved object). Neither owns style numbers.
3. **Template admission pipeline** (adding a template = adding a DOCX):
   1. `scripts/extract-template.ts <file.docx>` → candidate config + extraction report
      (sectPr→geometry; run props→slots; styles.xml→decorations/named styles; docDefaults→fonts).
   2. **Fitness audit (automatic gate):** no tables, no textboxes, no images/shapes, single column,
      recognizable headings + bullets + section structure. Decorative DOCX fail here with a report.
   3. **Human review** maps extracted styles to slots (~10 min for a clean DOCX); config committed.
   4. **Acceptance gate (G3):** render a fixture resume with the new template → DOCX → PDF → PNG,
      pixel-diff against the same rendering of the *original reference DOCX* within budget. A
      template ships when it provably recreates the DOCX it came from.
4. **Fidelity gates:**
   - **G1 (structural, CI, fast):** extract XML from `buildDocx` output; assert sizes/fonts/margins/
     borders/spacing/page equal the template config. Names the cause of drift.
   - **G2 (snapshot, CI + milestone):** DOCX → LibreOffice headless → PDF → rasterize @150dpi → PNG,
     pixel-diff vs committed baselines with threshold budget; red-highlight diff artifact on failure.
     **Settings-matrix sweep:** baselines per variant (default, A4, size min/max, line-height
     extremes, auto-fit applied) — every feature control proven in the artifact.
   - **G3 (template acceptance)** as above. Same machinery as G2.
5. **DOCX stays canonical.** Export streams `buildDocx` output once; PDF derives from those exact
   bytes via LibreOffice (reference renderer); accurate preview renders the same artifact (E3).
   Nothing stored (ADR-0008 O5).

## Pros

1. **Drift eliminated by construction** — style exists once; preview and export consume the same
   resolved object through one conversion module. The observed 7-property divergence becomes
   impossible without a failing gate.
2. **The DOCX remains the leading artifact end-to-end** — contract extracted from a DOCX, builder
   emitting a DOCX, gates keyed to DOCX output; PDF/HTML are projections, exactly as scoped.
3. **Extension is mechanical** — drop a DOCX, run the extractor, review slots, pass the render-back
   gate; validated components (extraction ran on the golden + 463 files; render-back demo achieved
   0% determinism / 14.6% real divergence).
4. **Fidelity is measured** — "close enough" becomes a threshold number plus a structural cause;
   colors, dividers, alignment, sizes, fonts, shading all caught by pixels, explained by XML.
5. **Feature controls provably consistent** — the settings matrix proves font/size/line-height/
   spacing/auto-fit/A4 behave identically in artifact and preview, per variant, in CI.
6. **ATS-safety preserved by the contract** — the expressible subset *is* the no-drift/ATS contract
   (single column, no tables/images/textboxes, fixed order); fitness audit enforces it at admission.
7. **Builds only on proven, permissive tooling** — docx.js (MIT), LibreOffice (MPL), PyMuPDF
   (rasterize; no sudo), pixelmatch (ISC) / odiff (MIT); no AGPL vendored.
8. **Additive, reversible steps** — each layer (schema → builder refactor → preview → gates →
   extractor) ships independently; no big-bang.

## Cons

1. **Schema encodes only the expressible subset** — two-column layouts, sidebars, photos, decorative
   elements can never be templates. Deliberate (D6), but a hard boundary; RR's open drift issues show
   exactly where complexity breaks — our single-column constraint avoids it rather than solving it.
2. **Two layout engines remain** — Word/OOXML pagination vs CSS wrapping can still differ at line
   wrap/page-break positions even with identical parameters. Mitigated (parameters asserted by G1;
   pixels by G2; accurate pane by E3), never fully eliminated. The accurate render stays the arbiter.
3. **Bootstrap cost** — schema + resolve + conversions + builder refactor + preview refactor before
   new capability is visible; interim, the builder keeps working unchanged.
4. **One human step survives** — slot mapping can't be fully automated (which named style is the
   heading). Budgeted (~10 min/template) but not zero.
5. **Determinism is load-bearing and conditional** — proven 0px cross-run here, but only while the
   same fonts are present: fonts must be pinned in the Docker image (LibreOffice substitutes
   silently), and baselines must be generated in the same environment they're asserted in.
6. **Snapshot hygiene** — baselines are committed PNGs; legitimate style changes require deliberate
   baseline review (process cost, also the safety mechanism). Settings matrix multiplies baseline
   count (bounded: one per fixture × variant).
7. **Extractor fragility at the edges** — arbitrary OOXML (theme fonts, `w:szCs`, nested styles,
   tracked changes) needs tolerant parsing; the fitness audit rejects most of that surface before it
   matters, but a hostile DOCX produces a *bad candidate*, not a crash — the review step is the guard.
8. **Live HTML remains approximate** — honest labeling required (E6 copy already does); if gate
   maintenance ever outweighs the benefit, B2 (preview = rendered artifact) is the documented escape.

## Validation & Expansion (all executed this session — facts, not assertions)

**Golden analysis (the drift evidence):** unzipped `cv2026/003`; extracted sectPr
(Letter 12240×15840, 720-twip margins), fonts (Merriweather Light default / Merriweather bold),
sizes (12/13/16/18/26 half-points), spacing (278–280/240 ≈ 1.17), `ReziHeading` style (top gray +
bottom black paragraph borders), structure (55 paragraphs, heading/bullet/company-line roles).

**Builder audit:** 7-property drift vs golden (font, margins, missing heading borders, contact-line
size/weight, line-height, no paper size, no job separators).

**Template landscape (463 DOCX mechanically audited):** HICV library 2,132 files → sampled 463;
structural fit 1/463 (decorative images/textboxes dominate — validates D6 + the fitness audit at the
door). Verified candidates kept in `~/resume-template-candidates/`: hicv-english-clean (A4, named
styles, real borders — closest golden relative), harvard-bullet-2025 (official Harvard, tab-aligned,
real bullets), Сreative (structurally clean but emoji headings — lint violation), plus 3 near-fits
(text-rule dividers; size-only headings; stacked contact lines).

**Reactive Resume source study (MIT, 28k★):** `packages/docx` = data-driven docx.js builder with
`TEMPLATE_CONFIGS` record + `ptToHalfPt`/`ptToTwips` converters + A4/Letter constants — independent
validation of A1's shape; cover letters are a section type in the same schema (scope check holds);
drift issues concentrate in two-column templates (our constraint avoids the failure zone); their v5
preview renders the real PDF client-side (B2 precedent, kept as fallback).

**Snapshot pipeline proof-of-concept (this box):** DOCX → LibreOffice headless → PDF → PyMuPDF
@150dpi → PNG → Pillow/pixel diff. Results: **0.000%** self-diff; **0 px** cross-run determinism
(same DOCX converted twice); **14.638%** golden-vs-different-template (drift caught + red-highlight
artifact produced). LibreOffice 24.2.7.2 already installed; PyMuPDF installs without sudo.

**Tool/license verification:** docx.js 9.7.1 MIT (May 2026) · LibreOffice MPL · PyMuPDF AGPL-free
library · pixelmatch 7.2 ISC · odiff-bin 4.5 MIT · @turbodocx/html-to-docx 1.22 MIT (Jun 2026,
source-verified: no letter-spacing) · beautiful-docx 1.0.15 ISC (Aug 2026) · docx-preview 0.4.0
Apache-2.0 (open fidelity issues #178/#187/#195; pagination fork stalled) · OfficeCLI v1.0.144
Apache-2.0 (docx→HTML/PNG, all-platform binaries incl. linux-x64 — candidate alternate rasterizer,
spike-gated) · diff-pdf GPL (reference only).

## Recommended build path

1. **`shared/src/resume-template/`** — schema, `resolve()`, unit conversions (pure, zero deps).
   *G1 can be written against the CURRENT builder immediately — give the in-flight E3/E6 agent an
   objective convergence target before the refactor, not after.*
2. **`scripts/extract-template.ts` + fitness audit** — DOCX → candidate config; emit the `compact`
   config from the golden; human-review + commit.
3. **Refactor `docx-builder.ts`** to `buildDocx(doc, resolved)` — hardcoded values replaced by the
   extracted `compact` config (fixes the 7 drifts). Golden test extended with G1 assertions.
4. **`LivePreview`** consumes ResolvedTemplate → CSS (E6.8), same conversions module.
5. **G2 snapshot harness** — vitest + rasterizer abstraction (PyMuPDF local / poppler or OfficeCLI in
   Docker) + committed baselines (`compact` baselined against the golden) + settings-matrix sweep.
6. **Second template end-to-end** (harvard-bullet-2025 candidate) — exercises the full admission
   pipeline; proof that "add a DOCX" works.

## Definition of Done (live proof, not green tests)

- [ ] `compact` config extracted from the golden; G1 passes asserting builder output == config.
- [ ] Exported DOCX of the golden data pixel-matches the golden's own rendering within budget (G2).
- [ ] Settings sweep: A4 + size/line-height/auto-fit variants each pass G2 with their own baselines.
- [ ] A second template admitted via the DOCX pipeline (extract → audit → review → G3 render-back).
- [ ] HTML preview and exported DOCX of identical data visually agree within the preview threshold —
      demonstrated side-by-side in the running Studio, per the user-memory live-E2E standard.

## Open items / decision register

| # | Question | Recommendation | Status |
|---|---|---|---|
| O1 | Slot schema breadth: encode tab stops / right-aligned dates (Harvard style) now? | Defer — add `alignment`/`tabStops` to a slot only when admitting a template that needs it; schema stays minimal | Deferred-with-feature |
| O2 | Cover-letter template shape | Same `ResumeTemplate` with a different slot set (letterhead/date/salutation/body/signature); same pipeline | Deferred — after resume templates proven |
| O3 | Rasterizer in Docker: poppler (needs install) vs OfficeCLI binary vs PyMuPDF container | Spike OfficeCLI first (single binary, Apache-2.0); fallback poppler; PyMuPDF stays the local default | Pending spike |
| O4 | OfficeCLI as alternate accurate-preview/second-opinion renderer | Spike only — v1.0-era; LibreOffice remains reference renderer | Pending spike |
| O5 | Where baselines live (git-tracked PNGs vs artifact store) | Git-tracked under `backend/src/services/__tests__/fixtures/snapshots/` — reviewable in PRs | Recommended default |
| O6 | Threshold budgets (G2 artifact, preview-vs-docx) | Start: artifact < 0.1% style-identical tolerance; preview-vs-docx looser (~2–3%), tuned from first real run | Pending calibration |
| O7 | Interaction with the in-flight E3/E6 agent work | Build G1 against the current builder first (objective target); coordinate builder refactor (item 3) so it lands once | **Open — coordinate** |

---
*End of ADR-0010. Builds later from the recommended path; implementation begins only after review.*
