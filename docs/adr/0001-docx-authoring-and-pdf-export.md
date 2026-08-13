# ADR-0001 — WYSIWYG DOCX Authoring & PDF Export in the Client

- **Status:** Proposed (documentation only — discovery, no code)
- **Date:** 2026-08-13
- **Owner:** job-aggregator
- **Scope:** How the web client edits an uploaded `.docx`, and how we produce a PDF from
  that (possibly edited) original `.docx`.
- **Companion:** `docs/ats-linting-engine.md` is the ATS-lint baseline; this record is the
  authoring/export half that lets a user edit the resume in place.

---

## Context

The app ingests resumes as **PDF / DOCX / TXT**. Today it extracts text (mammoth), views a
stored PDF (pdf.js), and lets the user edit **plain parsed text** — not the original document.
We want to raise this so a user can:

1. **Edit the original `.docx` in the browser** with a real WYSIWYG document surface (Word-like),
2. **Produce a PDF from that (original/edited) `.docx`** that preserves layout.

The motivating use case is the resume: layout-sensitive, needs to survive an ATS and look
professional when submitted. Fidelity matters more here than in generic document editing.

**Stack context:** Vite + React frontend, Node/Express backend, Docker available,
`mammoth` (DOCX→HTML/Markdown extract) + `pdf.js` (view) already present, Qwen client present.

---

## Decision drivers

| # | Driver | Why it matters |
|---|--------|----------------|
| D1 | **Faithful DOCX fidelity** | A resume must round-trip (open → edit → save/export) without losing layout, tables, bullets, spacing. |
| D2 | **True "edit the original `.docx`"** | We want the editable source of truth to remain DOCX (not HTML/text with a bolted-on export). |
| D3 | **PDF from the original `.docx`** | Export must not be a lossy DOCX→screen→print cheat where layout drifts. |
| D4 | **Weight vs. app size** | A resume tool shouldn't drag in a full office-server until it's warranted. |
| D5 | **License compatibility** | Must be legally embeddable in this product (personal tool today, possibly a product later). |
| D6 | **Fits the existing stack** | React/Vite + Node + Docker; no platform rewrite. |

---

## Options considered

### A. Full self-hosted office suites (max fidelity, native PDF export, heavy)
| | **ONLYOFFICE DocumentServer** | **Collabora Online (CODE)** |
|---|---|---|
| What | Word-grade WYSIWYG; open/save real `.docx`; **native save-as-PDF**; iframe embed + `@onlyoffice/document-editor-react` | LibreOffice-based; same role; WOPI; **native PDF export** |
| License | AGPL-3.0 | AGPL / MPL |
| Weight | **Heavy** — Docker DocumentServer (separate backend; RabbitMQ/Postgres in prod; ~GBs) | **Heavy** — Docker service |
| Edit original .docx | Yes | Yes |
| Built-in DOCX→PDF | **Yes** | **Yes** |
| Fit to this app | Overkill unless complex/arbitrary documents are the core need | Same |

### B. Browser-native DOCX editors (embed straight into React, lighter)
| | **theRealestAEP/wordinweb** | **JSv4/Docxodus** | **CasualOffice/docs** |
|---|---|---|---|
| What | One React component `<DocxView editable>`; parse/render real DOCX in-browser; edit + toolbar; save-back to `.docx` bytes; pure client | Structure-aware OOXML **engine** (render HTML, in-browser **block editor**, native tracked-changes diff, LLM/agent-friendly markdown); .NET/WASM-in-browser/npm | A one-Docker-container **self-hosted web app**: ribbon toolbar, paginated WYSIWYG, real-time co-editing (Yjs), **built-in Print/Export-as-PDF** |
| License | MIT | MIT | Apache-2.0 |
| Edit original .docx | Yes (bytes in → edited bytes out) | Yes (engine; you build the UI or use its block editor) | Yes |
| Native DOCX→PDF | No (external path) | No (external path) | **Yes** (built-in export) |
| Fit to this app | **Closest drop-in** for React | Great engine; more integration work; overlaps with ATS/agents ambition | Full app; embed-as-whole (not a component); needs its Docker + Node collab server |

### C. Preview / generate only (not true WYSIWYG editing)
- **dolbomir/docx-preview** (Apache-2.0) — render `.docx`→HTML for **preview**, no editing. (We already get similar via `mammoth`.)
- **dolanmiu/docx / docx.js** (MIT) — programmatically **generate/modify** `.docx` from JS; not a WYSIWYG for editing an existing upload.
- **CKEditor 5 / TinyMCE** — Word-flavored editing, but DOCX import/export + PDF export are **commercial premium** (`@ckeditor/ckeditor5-export-word`, `-import-word`, `-export-pdf`); not open-source. **PSPDFKit/Nutrient** likewise closed/commercial.

### D. PDF-export paths (editor-agnostic)
| Path | Fidelity | Where it runs | Notes |
|---|---|---|---|
| **LibreOffice headless** (`soffice --headless --convert-to pdf`) | **Highest** for real DOCX→PDF | Server (Node spawns it; Docker image available) | Works with **any** editor; converts the actual `.docx`. Recommended default. |
| Suite-native export (OnlyOffice/Collabora/CasualDocs) | High | In those suites | Only if you adopt those suites. |
| Browser print (render DOCX→HTML via docx-preview → print/save-as-PDF) | **Lowest** | Client | Layout drifts; last resort. |

---

## Recommendation (by situation)

> These are **recommendations to validate**, not finalized decisions — see §Validation.

- **Situation 1 — Lightweight, stays in the React app, no heavy server, high-fidelity PDF.**
  **→ Use `wordinweb` (MIT) for in-browser editing + server-side LibreOffice headless for
  DOCX→PDF.** Best fidelity-per-weight; pure-client editor; PDF done right on the server.
  *(Likely best default for this resume app.)*

- **Situation 2 — Want a full Word-like surface + collaboration + PDF in one self-hosted unit.**
  **→ Use `CasualOffice/docs` (Apache-2.0, one Docker container).** Native Export-as-PDF,
  real-time co-editing. Trade-off: it's a whole app you embed, not a React component.

- **Situation 3 — Need maximum fidelity on arbitrary/complex DOCX and will run a real server.**
  **→ Use ONLYOFFICE DocumentServer (AGPL) or Collabora (AGPL/MPL).** Native PDF; the heavy
  option. Watch AGPL implications if this ever becomes a distributed commercial product.

- **Situation 4 — Editor-agnostic "guaranteed PDF from the original .docx."**
  **→ Server-side LibreOffice headless (`soffice`)** as the resilient default; pair with any editor.

- **Situation 5 — We only preview uploaded DOCX (no editing) for now.**
  **→ docx-preview (Apache-2.0) or the existing mammoth extraction** for rendering; defer editing.

---

## Consequences

- **Adopting wordinweb** gives a clean React-embedded editor and keeps the app light, but
  PDF export must be implemented separately (LibreOffice headless) — two moving parts, and
  `wordinweb` is early (v0.2.x) → needs a spike/live test before committing.
- **Adopting CasualDocs** buys Word-fidelity + PDF in one box but adds a Docker/Node service
  and an app-shaped surface (less control over UX; not a drop-in component).
- **Adopting ONLYOFFICE/Collabora** guarantees fidelity/export but is disproportionate weight
  for a resume tool and carries AGPL considerations for a future commercial deployment.
- **Server-side LibreOffice** is the reliability anchor for PDF in every scenario; its cost is
  a server dependency + image size (~hundreds of MB), acceptable here since Docker is already used.
- **Avoid** the LLM-wrapper / commercial-premium route (CKEditor export plugins, PSPDFKit);
  not needed and licensing-heavy for this feature.

---

## Validation & Expansion (research pass 2 — Aug 13 2026)

Additional information gathered per scenario to validate the recommendations above.
Sources: npm registry metadata + repo root files + raw READMEs, Aug 13 2026.

### Overall finding-by-option validation

| Option | Validated fact | Impact on recommendation |
|---|---|---|
| `wordinweb@0.2.5` | React **>=18** peer ✓ matches our Vite/React. But deps: `three`, `@google/model-viewer`, `emf-converter`, `fflate`, `wmf` → **WebGL + Metafile rendering deps**; pre-1.0 (repo pkg 0.1.0). | Still best *drop-in* for React, but **not "lightweight"** as assumed — bundle includes three.js/WebGL. **Must spike + measure** before committing. Edits real DOCX bytes; PDF still external. |
| npm `docxodus@9.8.0` | **Name collision:** the `docxodus` package on npm is an *unrelated* project (react>=16.8, `@atlaskit/pragmatic-drag-and-drop`). **JSv4/Docxodus has no repo-root package.json** (engine ships .NET lib + WASM-in-browser + separate surfaces). | **JSv4/Docxodus is not `npm i docxodus`.** Adopting it requires locating its real npm/WASM artifact → **higher discovery/integration cost.** Great engine; treat as a build-your-own-surface path, not a drop-in. |
| `docx-preview@0.4.0` | Only dep `jszip`; clean browser renderer. | Solid, light choice for **Situation 5 (view-only)**. |
| `libreoffice-convert@1.8.2` | Thin wrapper on `soffice` binary (deps `async`,`tmp`) — **you must have LibreOffice installed**. | For Situation 4/1: install `libreoffice-writer-nogui` in a Docker (Debian) node image, or use a LibreOffice-based service image, then call `soffice --headless --convert-to pdf`. |
| `docx2pdf@0.0.4`, `docx-pdf@0.0.1` | `docx2pdf` uses **chrome/puppeteer** (browser render); `docx-pdf` uses **html-pdf+mammoth** (HTML render). | Both are **lower-fidelity** than LibreOffice headless for real DOCX→PDF. Record but prefer LibreOffice. |
| `@onlyoffice/document-editor-react@2.2.0` | React `^16.9–19` peer ✓; official wrapper exists. | Confirms ONLYOFFICE is embeddable in modern React — but still needs the heavy DocumentServer backend. |
| `@ckeditor/ckeditor5-export-word@48.4.0` | Depends on CKEditor **commercial** packages (cloud-services, track-changes, comments, merge-fields). | Confirms DOCX/PDF export in CKEditor is **premium/commercial** — avoid for this feature. |
| `CasualOffice/docs` | No repo-root package.json → it is a **self-hosted app** (WebContainer/Docker + Node collab server), embedded via its **WOPI/JWT-API host interface**, not a React component. | Situation 2 is real but it's "embed a whole app as a pane," not "drop in a component." More integration ceremony. |

### Per-scenario additional information

- **Situation 1 (wordinweb + LibreOffice headless):** `wordinweb` accepts `<DocxView source editable onReady>` where `source` is bytes/Blob/URL, and exposes an imperative `api` + `<DocxToolbar>` — clean React integration. Caveat: WebGL/metafile deps → verify it builds under Vite without SSR issues and measure bundle/startup. PDF done server-side: in a Debian Docker image add `libreoffice-writer-nogui && soffice --headless --convert-to pdf file.docx`, or call via `libreoffice-convert`. Keep the stored original `.docx` as the editable source of truth.
- **Situation 2 (CasualOffice):** one Docker container; editing is app-hosted and embedded through the host (WOPI/JWT-API) interface; stateless backend, persistence delegated to the host — so the host (our backend) owns file storage. Native Export-as-PDF. Best when you want Word-fidelity + co-editing without running a full office suite.
- **Situation 3 (ONLYOFFICE / Collabora):** official React wrapper (`@onlyoffice/document-editor-react`, React 18/19 OK); requires self-hosting DocumentServer (its own service + queues). Use **only** when arbitrary/complex DOCX fidelity is the core requirement. AGPL: fine for internal/personal use; revisit for a future distributed commercial product.
- **Situation 4 (editor-agnostic PDF):** server-side `soffice --headless --convert-to pdf` is the fidelity anchor for every path. Avoid `docx2pdf` (puppeteer) / `docx-pdf` (html-pdf) for layout-sensitive resumes.
- **Situation 5 (view-only today):** `docx-preview` (Apache-2.0, jszip-only) is a clean, light renderer; we already have `mammoth` extraction if HTML is acceptable.

### Refined take-away

The core recommendation (Situation 1) still stands **contingent on a wordinweb bundle/perf spike**, and the LibreOffice-headless PDF path is validated as the reliability anchor. Docxodus is promising but **not a drop-in** (package/discovery gap). ONLYOFFICE/Collabora remain the heavyweight-but-guaranteed options.

## Open validation items (spikes before committing)

- [ ] **Spike:** does `wordinweb` build under Vite and render/edit an uploaded resume `.docx`? Measure bundle + startup + fidelity.
- [ ] **Spike:** LibreOffice headless `soffice --headless --convert-to pdf` inside this repo's Docker (Debian node image) → verify PDF fidelity vs the original.
- [ ] **Discover:** the actual JSv4/Docxodus npm/WASM artifact + integration cost, if the engine path is preferred.
- [ ] **Assess:** CasualOffice WOPI/JWT-API host integration effort if Situation 2 is pursued.
- [ ] Join the decision back into the **ATS lint roadmap** (Phase 3 UI / Phase 4 advice surface).