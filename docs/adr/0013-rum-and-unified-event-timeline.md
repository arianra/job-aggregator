# ADR-0013 — Client RUM & Unified Event Timeline (Agent-First Observability)

- **Status:** Accepted (2026-08-16)
- **Date:** 2026-08-16
- **Owner:** Arian / platform
- **Scope:** How we record user actions (client), backend behaviour, and errors into ONE
  agent-queryable timeline — and which frameworks we use (and reject) to do it.
- **Companion:** [`docs/diagrams/telemetry-architecture.html`](../diagrams/telemetry-architecture.html) (as-is → target diagram),
  [0012](./0012-save-restore-data-integrity-and-test-gap.md) (the save/restore post-mortem is the motivating
  bug class: a silent client↔backend state divergence that logs could not reconstruct).
- **Tracking:** beads epic **job-aggregator-9qq** ("E9 — Client RUM & Unified Event Timeline"),
  tickets `8mu` (P0), `9qq.1` (P1), `9qq.2` (P2), `9qq.3` (P3) — claim/close leaf tickets only.

## Context

job-aggregator is a **single-user, locally-run** app (React 18 + Vite frontend, Express 4 + winston backend).
Today the backend logs JSONL (`logs/combined.log`, `logs/error.log`) but with **no request IDs, no request
duration/status, and no link to what the user was doing**; the frontend has **zero telemetry** — errors die in
the browser console and user actions leave no trace. When something breaks (see [0012]), debugging means
asking the user to reproduce and narrate. The primary purpose of this work is to give **the agent** (and
secondarily us) a granular, self-contained reconstruction of any incident: *user clicked X → api.request fired →
backend did Y → error Z → toast shown* — from local files, without a dashboard or SaaS.

### Decision (2026-08-16)

**Build a thin unified observability layer: rrweb (MIT) for pixel-level DOM session recording + a small
hand-rolled semantic telemetry SDK in the client + AsyncLocalStorage request-context and a structured event
ingest on the backend, all writing into one time-bucketed JSONL event timeline with a shared envelope schema.**

What we are NOT doing (deliberately):

- **Not** self-hosting any session-replay/RUM platform (OpenReplay, Highlight, PostHog, Sentry) — each needs a
  multi-GB, multi-container stack for one user, and their dashboards add nothing for an agent consumer (§Options).
- **Not** adopting OpenTelemetry now — overkill for one process + one user, and its JS stack has no first-class
  local-file exporter. The design below keeps the OTel door open (§Validation V4).
- **Not** using any SaaS (Sentry cloud, PostHog cloud, Better Stack) — local-file queryability is a hard
  requirement.

## Decision drivers

| # | Driver | Why it matters |
|---|--------|----------------|
| D1 | **Agent-first debugging** | The primary consumer greps/jq's local files; it is not a human staring at a dashboard. Granularity + correlation + stable schema beat pretty UIs. |
| D2 | **Near-zero infra** | Single-user local app; anything requiring Kafka/ClickHouse/16 GB RAM is disqualified. |
| D3 | **One timeline, not silos** | Client actions, API calls, backend logs, and errors must interleave by shared IDs or the reconstruction fails. |
| D4 | **License cleanliness** | MIT/Apache only (repo policy from [0003]: no AGPL vendoring). |
| D5 | **Small bundle, no perf tax** | Record side must stay ≲ 40 KB gz; batching must not block the UI. |
| D6 | **Reuse what exists** | winston already emits JSONL with rotation; one axios instance is the sole API seam; `@job-aggregator/shared` is the natural schema home. |

## Options considered

| Option | What it is | License | Pros | Cons |
|---|---|---|---|---|
| **A. Self-host a RUM/replay platform** (OpenReplay / Highlight / PostHog / Sentry self-hosted) | Full session-replay + error stack with UI | AGPL+ee / Apache+ee / MIT+ee / FSL-1.1 | Turnkey replay, grouping, dashboards | **Disqualified on D2/D3/D4:** OpenReplay min 2 vCPU/8 GB; Highlight 8 GB + Kafka/ClickHouse/Zookeeper; PostHog 4 vCPU/16 GB *and officially unsupported* self-hosting; Sentry 16 GB + 40+ containers. All query via their UI/API, not plain files. Highlight's React SDK unpublish...

*(full table continues below — condensed here for the file; see Validation §V1–V3 for per-platform verified facts)*

| Option | What it is | License | Pros | Cons |
|---|---|---|---|---|
| **B. OpenTelemetry-first** (browser SDK + Node SDK, OTLP) | Vendor-neutral spans/traces | Apache-2.0 | Standard correlation (`traceparent`), future-proof | No DOM replay/input capture; browser core ~13 KB gz but needs instrumentation wiring; JS has no sanctioned local-file exporter (console/OTLP only); ESM loader friction. Complements but cannot replace DOM recording. |
| **C. Unified hand-rolled layer: rrweb + semantic SDK + JSONL timeline** ← **chosen** | `@rrweb/record` (~23 KB gz) + console/network plugins + web-vitals (3 KB) + ~300-line semantic SDK; backend ingest appends to shared-envelope JSONL | MIT / Apache-2.0 | Pixel-perfect replay AND greppable semantic events; zero new infra (existing Express + files); schema we control in `shared`; agent can grep one file per day | We own ~500 lines of SDK/ingest; rrweb volume management is ours; no built-in dashboards (fine per D1) |
| **D. Backend logging only** (upgrade winston, add request IDs, no client recording) | Structured server logs only | — | Smallest change | Fails D3/D1: the client half of every incident (what the user did, what the UI showed) stays invisible. This is today's state plus IDs. |
| **E. SaaS error/RUM** (Sentry cloud, PostHog cloud, Better Stack) | Hosted ingestion | proprietary terms | Zero self-host | Leaves the machine (privacy + offline failure modes); costs; agent access only via vendor API. Fails D3. |

## Recommendation (by situation)

- **Now (single-user local app, agent-debug-first):** → **Choose Option C.** This is the default and what this
  ADR proposes to build, in the phases below.
- **If error grouping/stack-symbolication ever hurts:** add **Spotlight by Sentry** (dev-local sidecar; no DSN;
  CLI tails events as JSON/markdown and ships an MCP server for AI agents) as an optional add-on — it is the
  only surveyed error tool whose design goal is agent consumption. Do **not** graduate to self-hosted Sentry.
- **If a second service ever appears:** adopt OTel propagation (`traceparent`) — the AsyncLocalStorage +
  request-ID design below is a strict subset of it (swap the ALS store for OTel context).
- **If a human-facing analytics dashboard ever becomes genuinely needed:** migrate to OpenReplay (lightest of
  the platforms, closest in spirit) rather than building dashboards here.

## Architecture (target)

Full picture: [`docs/diagrams/telemetry-architecture.html`](../diagrams/telemetry-architecture.html).

```
BROWSER                                              BACKEND (Express :3000)                    STORE
┌─ React app ────────────────────────┐   API calls                                 ┌─ logs/events/YYYY-MM-DD.jsonl
│ Semantic SDK                       │   X-Request-Id / X-Session-Id                │  (ONE unified envelope timeline:
│  clicks·router·TanStack-Query      ├──────────────────────►  Request-context     │   client semantic events
│  action names·web-vitals·onerror   │                          middleware (ALS,    │ + api.request/response pairs
│ rrweb recorder (+console,+network) │   POST /api/telemetry   honors inbound id)   │ + backend logs as envelope
│ axios interceptor (stamps ids,     ├───── events (batched) ► zod validate ──────►│   events + errors)
│  emits api.request/response)       │   ~5s / 100ev / beacon  Structured request   ├─ logs/sessions/<id>/rrweb-*.jsonl
│ Transport: buffer → fetch/sendBeacon│                          "completed" line   │  (DOM fidelity, per session)
└────────────────────────────────────┘   GET /api/telemetry/…  winston envelope    └─ index.json manifest
                                              (replay/events)    transport ───────►   (gzip >14d, delete >90d)
CONSUMERS:  AI agent ← `events` CLI (request <id> / session <id> / around <ts> / stats) over grep+jq
            Human   ← /debug/replay?session=<id> (rrweb player, debug-only route)
```

### Shared envelope (lives in `@job-aggregator/shared`)

Every event — client or server — is one JSON line with a fixed envelope + typed payload
(PostHog-flat shape, informed by Sentry/W3C prior art; §V3):

```ts
interface EventEnvelope {
  ts: string;            // ISO 8601 UTC ms — lexicographic sort == chronological (grep/sort friendly)
  seq: number;           // monotonic per writer
  sessionId: string;     // client-generated per app session; X-Session-Id header
  requestId?: string;    // client-generated per API call; X-Request-Id header; doubles as traceId
  actor: 'user' | 'agent' | 'system';
  source: 'client' | 'server';
  type: 'click' | 'input' | 'navigation' | 'api_request' | 'api_response'
      | 'error' | 'log' | 'lifecycle';          // CLOSED enum
  name: string;          // OPEN dot-vocabulary: ui.click, api.response, error.http, job.search_triggered
  payload: object;       // type-specific, ~1 nesting level; error message at payload.message
}
```

Rules: `type` is closed (validated), `name` is open and grows; error `name` encodes the **category**
(`error.http`, `error.unhandled_rejection`) so grep-by-name stays stable; backend winston lines are re-emitted
through an envelope transport so **one** file shape covers both sides.

### Correlation model (simplified W3C)

1. Client mints `sessionId` once per app session; every request carries `X-Session-Id`.
2. Client mints `requestId` (uuid) per API call, emits `api.request` with it, sends `X-Request-Id`.
3. Backend middleware honours inbound `X-Request-Id` (else mints one), stores it in **AsyncLocalStorage**,
   echoes it in the response header; every log line + `api.response` event inside that request carries it.
4. Reconstruction = `grep '"requestId":"<id>"' logs/events/*.jsonl | sort` — or `events request <id>`.
   `requestId` doubles as trace-id; real `traceparent` is one middleware line away if OTel ever lands.

### Client SDK composition (all MIT/Apache, record-side ≈ 30–35 KB gz)

| Piece | Source | Captures |
|---|---|---|
| `@rrweb/record` | MIT, ~23 KB gz | Full DOM snapshot + mutations, clicks, input, scroll, navigation (pixel-perfect replay) |
| `@rrweb/rrweb-plugin-console-record` | MIT, 2.8 KB gz | console.* interleaved into replay |
| `@rrweb/rrweb-plugin-network-record` | MIT, 2.4 KB gz | fetch/XHR incl. bodies (with `transformRequestFn` masking) |
| `web-vitals` | Apache-2.0, 3.3 KB gz | CLS/INP/LCP/FCP/TTFB → `lifecycle` events |
| Semantic SDK (hand-rolled ~300 lines) | ours | Delegated click capture (`data-action` attrs), react-router navigations, **TanStack Query mutation keys as named app actions**, `window.onerror` + `unhandledrejection`, axios interceptor events |
| Transport (hand-rolled) | ours | In-memory buffer → batched `fetch` POST every ~5 s / 100 events; `navigator.sendBeacon` on `visibilitychange`/`pagehide`; rrweb `checkoutEveryNms` bounds buffers |

Privacy posture: single-user local app — record everything, but keep rrweb defaults (`password` inputs
masked) and mask network bodies for the upload route if resume content should stay out of rrweb chunks
(open item O2).

### Backend changes

1. **Request-context middleware** (AsyncLocalStorage; `cls-hooked` is deprecated — do not use): honour
   `X-Request-Id`, echo in response, stamp every log line (winston format reading the ALS store).
2. **Structured request-completed line** replacing the current start-of-request `info`: `{requestId,
   sessionId, method, url, route, status, durationMs, reqBytes, resBytes, errorCode?, action?}` — logged on
   response finish; errors additionally at error level with stack.
3. **`POST /api/telemetry/events`** — zod-validated batch ingest → append to day-file JSONL (+ envelope
   transport mirrors winston lines into the same file). Malformed events dropped with a warning, never 500.
4. **Replay/query endpoints** — `GET /api/telemetry/sessions`, `GET /api/telemetry/sessions/:id/events`,
   `GET /api/telemetry/sessions/:id/rrweb` (debug-only).
5. **Retention job** (on boot): day-files → gzip after 14 d → delete after 90 d; rrweb session files gzip
   after 7 d / delete after 30 d; rewrite `index.json` manifest (`{file, startTs, endTs, count, sizeBytes}`).
6. winston stays (D6); pino migration is optional, not blocking (§O1).

### Agent-consumable surface

```
events tail [--type error]                 # live
events query --since 2h [--type T] [--source client|server] [--status '>=500']
events session <sessionId>                 # unified timeline, sorted
events request <requestId>                 # THE keystone: click→request→backend→error chain
events around <iso-ts> --window 5m
events stats --by type|source|name
```

Thin wrapper over grep/jq on the JSONL files; `index.json` lets it pick files by time range without scanning.

## Consequences

- **+** Any incident reconstructable from local files with one grep; pixel-perfect replay available for human
  review at `/debug/replay`; no new services, MIT-only, record-side budget ≲ 35 KB gz.
- **+** The envelope schema in `shared` gives both halves one contract; future OTel/Spotlight adoption is
  additive, not a rewrite.
- **–** We own ~500 lines of SDK + ingest (maintenance, tests). Acceptable: it is the product of this ADR.
- **–** rrweb DOM chunks are voluminous vs semantic events — managed via per-session files + aggressive
  retention (O2); semantic timeline stays small and greppable regardless.
- **–** No dashboards/grouping out of the box — by design (D1); Spotlight is the escape hatch (O3).
- **Cost of delaying:** every future bug like [0012] costs another manual narration session instead of one
  `events request` call.

## Validation & Expansion

Research executed 2026-08-16 against primary sources (npm registry metadata, GitHub LICENSE/README/docs).

**V1 — Client recording landscape.** Every major platform's replay is built on **rrweb** (Sentry forks
`@sentry-internal/rrweb`; PostHog ships `@posthog/rrweb-*` forks; Highlight vendors it as a git submodule) —
so using rrweb directly gets the same fidelity without the platform. Verified self-host minimums:
OpenReplay **2 vCPU / 8 GB RAM / 50 GB** (AGPL default + MIT dirs + proprietary `ee/`);
Highlight **8 GB / 4 CPU / 64 GB** with zookeeper+kafka+redis+clickhouse (Apache-2.0 default; React SDK last
published **2025-08-22** — stale); PostHog **4 vCPU / 16 GB / 30 GB** and self-hosting is **officially
unsupported** (MIT + proprietary `ee/`); Sentry self-hosted **4 CPU / 16 GB + 16 GB swap / 40+ containers**
(FSL-1.1-Apache-2.0). Sources: github.com/rrweb-io/rrweb (docs/events.md, guide.md, recipes/network.md),
docs.openreplay.com/en/deployment/deploy-source, github.com/highlight/highlight (README, docker/compose.yml),
posthog.com/docs/self-host, develop.sentry.dev/self-hosted.

**V2 — Bundle facts (bundlephobia, verified).** `@rrweb/record` 23.3 KB gz; replay 58.1 KB gz (debug route
only); console plugin 2.8 KB; network plugin 2.4 KB; `web-vitals` 3.3 KB; `@opentelemetry/sdk-trace-web`
13.1 KB gz. rrweb is BYO-transport: `record({ emit })` + batched fetch is the documented canonical pattern,
with `checkoutEveryNth/Nms` bounding upload-on-error windows; `sendBeacon` for unload flush (per web-vitals
README + MDN).

**V3 — Envelope prior art.** PostHog event = flat `event + distinct_id + ISO-8601 timestamp + properties`
(`$`-prefix reserved); Sentry requires `event_id` + RFC-3339/unix `timestamp`, batches via newline-delimited
**Envelopes**, correlates via `contexts.trace.trace_id`; W3C Trace Context defines
`traceparent = version-traceid-parentid-flags` (32-hex/16-hex). Synthesis: PostHog-flat envelope + NDJSON
ingest + simplified request-id correlation. Sources: posthog.com/docs/data/events,
develop.sentry.dev/sdk/data-model/event-payloads, develop.sentry.dev/sdk/data-model/envelopes,
w3.org/TR/trace-context.

**V4 — Backend logging.** pino 10.3.1 vs winston 3.19.0: pino ~2.3× faster in its own benchmarks, NDJSON by
default, cheap child loggers, worker-thread transports — but at single-user volume the winston-vs-pino speed
delta is irrelevant; what matters is JSON-everywhere + request context, achievable in winston via an
ALS-reading format. **AsyncLocalStorage** is the 2026-standard context mechanism (cls-hooked /
continuation-local-storage are deprecated). `X-Request-Id` is the de-facto single-service convention;
`traceparent` only with OTel. OTel Node: no first-class file exporter (ConsoleSpanExporter is
diagnostics-only; OTLP needs a collector) + ESM loader friction → defer. Error tracking: Sentry self-hosted
overkill (V1); **Spotlight** (sidecar, no DSN, JSON/markdown CLI tail, **MCP server for agents**) is the one
agent-aligned optional add-on; JSONL-only is the baseline. Sources: github.com/pinojs/pino (README,
benchmarks.md), nodejs.org/api/async_context.html, github.com/getsentry/spotlight, opentelemetry.io docs.

**V5 — Store choice.** JSONL canonical (grep/jq native, append-only, crash loss ≤ last line, winston already
speaks it) vs SQLite (indexed range queries, but opaque to grep and needs WAL). Day-bucketed files +
`index.json` give range pruning without SQL; SQLite only as a *derived* mirror if agent SQL demand appears
(O4). Layout: `logs/events/YYYY-MM-DD.jsonl`, `logs/events/archive/*.jsonl.gz`, `logs/sessions/<id>/`.

**V6 — Codebase-design review + blast radius (2026-08-16).** Deep-module seams chosen so a delegated agent
gets small, testable interfaces. The five modules and their seams:
- `event-schema` (in `@job-aggregator/shared`): interface = `EventEnvelope` type + closed `EVENT_TYPES` + zod
  `eventEnvelopeSchema` + `makeEvent()` — zod is the *executable spec*, so the RED test asserts a valid
  envelope passes and a malformed one (`missing ts/type/source`) fails, from literal expectations, not recompute.
- `requestContext` middleware: interface = the express middleware + a `getRequestContext()` accessor over ALS;
  implementation = ID minting/validation + response-header echo. Deep (hides all ALS plumbing).
- `EventStore` (backend, the keystone): interface = `append(batch)`, `query(filter)`, `rotate()`; injected
  base path (accept deps, don't create) → testable against a tmp dir. Deletion test: without it, rotation,
  manifest, retention and day-bucketing leak across routes + CLI + ingest.
- `telemetry` ingest route + winston envelope transport: thin adapters over EventStore.
- client `telemetry` SDK: interface = single `initTelemetry({ api })` (small); implementation = buffering,
  flush timer, `sendBeacon` on hidden, onerror hook, click delegation, rrweb adapter. Deletion test: without
  it the capture complexity reappears across every page/component.
- axios interceptor extension: stays at the existing seam (`api` instance — 4 importers, verified via grep,
  so IDs propagate with zero call-site changes).
Blast radius verified by grep (GitNexus graph lacks ESM `.js`-suffix import edges, so grep is authoritative
here): `logger` = **24 importers** (validates the no-touch envelope-transport approach); `errorHandler` =
mounted once (index.ts, safe to extend). No `X-Request-Id`, telemetry route, rrweb/web-vitals dep,
`AsyncLocalStorage`, or CLI currently exists — the work is unbuilt and real.

## Decisions & open items

**Resolved (2026-08-16):**
- R1: Option C — rrweb + hand-rolled semantic SDK + unified JSONL timeline. No platforms, no SaaS.
- R2: Envelope schema as above; `type` closed / `name` open; schema lives in `@job-aggregator/shared`.
- R3: Correlation = client-minted `X-Request-Id` + `X-Session-Id`, AsyncLocalStorage server-side; `requestId`
      doubles as trace-id; winston retained, stamped via ALS-reading format.
- R4: Store = day-bucketed JSONL canonical + per-session rrweb files; retention 14d/90d (events), 7d/30d (rrweb).
- R5: Replay = debug-only Vite route with `@rrweb/replay`; rrweb chunks never shipped in the main bundle.

**Still open (with defaults):**
- **O1** winston→pino migration. *Default: keep winston*; revisit only if log volume/serialization shows up.
- **O2** rrweb volume & content sensitivity: checkout interval (default `checkoutEveryNms: 60_000`), and
      whether resume upload bodies are masked from network-record (default: mask `/api/profile*` bodies).
- **O3** Spotlight add-on. *Default: skip*; adopt if error grouping/symbolication starts hurting.
- **O4** SQLite derived mirror. *Default: no*; adopt if agent queries repeatedly need SQL joins.
- **O5** Action taxonomy source: default = TanStack Query mutation keys + route names + `data-action`
      attributes on high-value controls; formalise during Phase 1.
- **O6** Ingest validation failure mode: default = drop malformed event + warn-log (never 500, never block UI).

## Related / next steps

Build phases (documentation-only until accepted):

- **Phase 0 — correlation foundation:** shared envelope types; ALS request-context middleware; structured
  request-completed logging; `X-Request-Id` echo. (No client changes; immediately useful.)
- **Phase 1 — semantic timeline:** client semantic SDK + axios interceptor; ingest endpoint; day-file store +
  retention; winston envelope transport; `events` CLI (`request`/`session`/`around`).
- **Phase 2 — DOM fidelity:** rrweb recorder + plugins; per-session rrweb storage; `/debug/replay` route.
- **Phase 3 — analytics niceties:** web-vitals rollups, error frequency by `name`, `index.json` + `stats`.

Cross-links: [0012] motivates this record; the envelope's `actor: 'agent'` anticipates agent-driven UI
sessions; `docs/diagrams/telemetry-architecture.html` is the visual companion.
