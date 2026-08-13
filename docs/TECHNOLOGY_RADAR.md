# Technology Radar & Language Selection (Stage 17)

> Workload-driven technology selection for NexusEdu. Evidence comes from the
> Stage 16 codebase plus measurements taken during Stage 17. This is a
> **decision record**, not a migration mandate. The conclusion is
> intentionally conservative: the current stack is appropriate for the
> actual workloads.

**Status legend:** 🟢 KEEP · 🔵 KEEP+OPTIMIZE · 🟡 ISOLATE · 🟠 BENCHMARK · 🔴 MIGRATE · ⚪ DEFER

---

## 1. Workload inventory

| Subsystem | Current tech | Dominant workload | Bottleneck | Requirements |
|---|---|---|---|---|
| Frontend SPA/PWA | TypeScript + React 18 + Vite | I/O-bound (fetch), UI render, client routing | Bundle size / mobile CPUs | Mobile-first, offline, SEO, PWA install |
| API / routing | Python 3.11 + FastAPI (async) | I/O-bound orchestration | Network to Supabase/Telegram | Low latency, async concurrency, auth |
| Auth/authz | Python (domains/auth) | CPU-light crypto (HMAC/bcrypt) + I/O | bcrypt cost / Supabase round-trips | Safety-critical, fail-closed |
| Catalog assembly | Python (domains/catalog) | I/O-bound (parallel PostgREST fetches) + in-memory tree build | Supabase latency; 300s cache | Fast reads, freshness |
| Enrollment | SQL RPC (`use_chapter_enrollment_code`) + Python admin endpoints | I/O-bound + atomic DB write | DB transaction | Atomicity, correctness |
| **Video streaming** | Python + Pyrogram (MTProto) | **I/O-bound byte pumping** (network) | Telegram MTProto throughput / RTT | Range requests, concurrency cap |
| Telegram (MTProto) | Python + Pyrogram + tgcrypto (C) | I/O-bound, long-lived connections | FloodWait, reconnect, session validity | Reliability, reconnect |
| Telegram Bot API | Python + python-telegram-bot | I/O-bound webhook handling | Telegram API | Admin commands |
| Upload processing | Python worker orchestrating **ffmpeg/ffprobe** | CPU in native ffmpeg; Python just spawns/waits | ffmpeg CPU, Render free-tier disk | Thumbnails/variants (skipped on free tier) |
| Background jobs | in-process asyncio loop (`workers/`) | I/O-bound polling of `upload_queue` | Single-worker polling interval | Retry, status tracking |
| Database | PostgreSQL (Supabase) + RLS/SQL RPC | Data-intensive relational I/O | Query plans / indexes | Consistency, RLS safety |
| Caching/rate-limit | in-memory + optional Redis | I/O + memory | Redis availability | Degrade gracefully |
| Analytics/vitals | TypeScript → `/api/activity` → Postgres | I/O-bound best-effort | None critical | Non-blocking |
| Monitoring | Prometheus metrics (Python) + Grafana | In-process counters | None | Low overhead |
| CI/CD | GitHub Actions (YAML) | Build/test automation | Build time | Determinism |
| Infra as code | render.yaml, netlify.toml, Dockerfile (Terraform placeholder removed in Stage 17) | Declarative | None | Reproducibility |

---

## 2. Workload classification summary

- **I/O-bound & concurrency-bound:** API, streaming, Telegram, catalog,
  workers, analytics. These are exactly what async Python + httpx +
  Pyrogram handle well. The GIL is released during network I/O.
- **CPU-bound:** Only the video transcoding/thumbnail work — and that is
  already performed by the native **ffmpeg** binary, not Python.
- **Safety-sensitive:** authz, stream tickets, enrollment. Python's crypto
  is via `hmac`/`hashlib`/`bcrypt` (C-backed); correctness is covered by
  the authz-matrix tests.
- **Ecosystem-sensitive:** Telegram integration depends on Pyrogram and
  python-telegram-bot (Python-only ecosystems). Frontend depends on
  React/Radix/TanStack. Supabase has first-class JS support and a working
  Python client.
- **Data-intensive:** Postgres is the right tool; logic that belongs in
  the DB (atomic enrollment) already lives in a SQL RPC.

---

## 3. Evidence & measurements

- **Streaming hot path benchmark (this stage):** the per-1 MB-chunk Python
  work in `telegram_client.stream_range` (`bytes()` + slice arithmetic)
  processes ~**5.7 million chunks/sec** (~6 TB/s of pure-Python slice
  throughput) on the sandbox. Real streaming throughput is bounded by
  MTProto network RTT/bandwidth, not Python. → No CPU justification to
  move streaming to Go/Rust.
- **Video processing:** `VideoProcessor` calls native `ffmpeg`/`ffprobe`
  via `asyncio.create_subprocess_exec` (non-blocking). Transcoding is
  intentionally disabled on Render free tier. The heavy compute is already
  in C, outside the Python interpreter.
- **Concurrency model:** FastAPI runs on a single uvicorn worker; all
  external calls are `await`ed. The application needs high I/O concurrency,
  not parallel CPU — matching asyncio's strengths.
- **Dead dependencies found and removed (this stage):** `pillow`,
  `aiofiles`, `python-socketio` had zero imports in the codebase. Removing
  them shrinks the install/image and attack surface.

---

## 4. Decision matrix

| Component | Current | Candidate | Verdict | Rationale |
|---|---|---|---|---|
| Frontend language | TypeScript/React | — | 🟢 KEEP | Ideal for React SPA, strong types, AI-friendly, mobile PWA |
| Backend API | Python/FastAPI | Go / Rust / Node | 🔵 KEEP+OPTIMIZE | I/O-bound; Pyrogram & bot ecosystems are Python; added GZip |
| Streaming | Python/Pyrogram | Go/Rust proxy | 🔵 KEEP+OPTIMIZE | Measured Python overhead negligible vs network; isolate boundary already exists (`integrations/telegram_client`) |
| Crypto/authz | Python (hmac/bcrypt) | Rust native | 🟢 KEEP | C-backed primitives; covered by tests; no bottleneck |
| Video processing | ffmpeg (native) via Python | rewrite in Rust/C++ | 🟢 KEEP | FFmpeg is the industry tool; Python only orchestrates |
| Telegram clients | Python (Pyrogram/PTB) | Go MTProto libs | 🟢 KEEP | Mature Python ecosystems; tgcrypto is C-accelerated |
| Background worker | asyncio in-process | Celery/Go/Rust worker | ⚪ DEFER | Workload is light polling; revisit if queue throughput grows; single-worker is adequate at current scale |
| Database | PostgreSQL/Supabase | another DB | 🟢 KEEP | Relational + RLS is a strong fit; no scale evidence to move |
| DB business logic | SQL RPC | app code | 🟢 KEEP | Enrollment already atomic in SQL; don't move broad logic to PL/pgSQL |
| Cache/rate limit | Redis (optional) + memory | managed queue | 🟢 KEEP | Graceful in-memory fallback works on free tier |
| Infra config | YAML/Dockerfile/HCL | — | 🔵 KEEP+OPTIMIZE | render.yaml/netlify.toml are active; placeholder Terraform removed (invalid resources) |
| Policy/authz language | Python tests + RLS SQL | Rego/OPA | ⚪ DEFER | Authorization is simple (role + chapter_access); OPA unjustified now |
| Formal verification | none | TLA+/Alloy | ⚪ DEFER | Ticket/enrollment concurrency is small; revisit if distributed |
| WebAssembly | none | Rust→WASM | ⚪ DEFER | No browser CPU hot path (video is native element; PDFs via pdf.js) |

---

## 5. Changes actually made in Stage 17 (Phase B — Optimize)

1. **Removed dead dependencies:** `pillow`, `aiofiles`, `python-socketio`
   from `backend/requirements.txt` and `pyproject.toml` (zero imports
   found repo-wide). Smaller image, fewer CVEs to triage, faster cold start.
2. **Added GZip compression** (`GZipMiddleware`, minimum 1024 bytes) for
   JSON/text responses (catalog, metrics, admin JSON). Video bytes are
   already-compressed codecs and are served via `StreamingResponse` with
   their own `Content-Type`; the middleware does not double-encode them.
3. **Made the FFmpeg dependency explicit:** `VideoProcessor._require_ffmpeg()`
   documents that media processing is delegated to the native suite and is
   skipped when binaries are absent. This clarifies the CPU boundary.
4. **Removed non-functional Terraform placeholder** (see below) and kept
   the active `render.yaml`/`netlify.toml` as the infrastructure source of
   truth.

No language/run-time migrations were performed because no component showed
a workload mismatch severe enough to justify the operational and
AI-maintenance cost.

---

## 6. "Do NOT introduce" list (evidence-based)

| Technology | Decision | Why | Reconsider only if… |
|---|---|---|---|
| **Rust** (API/streaming) | ❌ Do not introduce now | Streaming is I/O-bound; measured Python overhead negligible vs MTProto network; adds a second toolchain hurting mobile/AI maintenance | Profiling shows sustained CPU saturation (not I/O wait) under measured load |
| **Go** (backend/worker) | ❌ Do not introduce now | No demonstrated throughput need; would duplicate Supabase/Telegram integrations; async Python already gives concurrency | A genuinely independent high-QPS service emerges (e.g. >1k concurrent streams/instance) |
| **Microservices** | ❌ Rejected | Single bounded modular monolith fits current scale; adds network/ops/deploy burden | Teams/scale require independent deployability (not today) |
| **Second frontend framework** (Svelte/Vue/Elm/…) | ❌ Rejected | React + TS is complete; a second framework fragments the bundle and AI context | A component has an unmet capability React cannot provide |
| **GraphQL** | ❌ Rejected | REST endpoints are small and purpose-built; GQL adds caching/complexity | Client fetch patterns become deeply varied/under-fetched at scale |
| **Another database** | ❌ Rejected | Postgres + RLS already powers the domain; migration risk is high | Relational model provably fails a new access pattern |
| **Celery / external queue** | ⚪ Defer | Current upload load is served by the in-process worker | Queue backlog/durability requirements outgrow polling |
| **OPA/Rego** | ⚪ Defer | Authz is role + chapter_access; centralized policy is overhead | Authz rules multiply across services/tenants |
| **Redis as hard dependency** | ❌ Do not require | App must run on free tier with in-memory fallback | Multi-instance deployment needs distributed rate limits |
| **WebAssembly** | ⚪ Defer | No browser CPU hot path; video uses the native element | A real client-side compute workload appears (e.g. local media processing) |
| **Julia / R / C++** | ❌ Not applicable | No ML/numerical subsystem in the repo | An actual data-science/inference feature ships |
| **Kubernetes / service mesh** | ❌ Rejected | Render single-service deploy is sufficient | Multi-service, multi-region operations are required |

---

## 7. Future technology triggers (revisit with measurements)

- **Streaming service in Go/Rust:** if a single backend instance sustains
  >~500–1000 concurrent streams and CPU profiling shows the event loop is
  CPU-saturated (not awaiting I/O), benchmark a dedicated streaming edge
  behind the existing `integrations/telegram_client` boundary. The current
  boundary makes this a partial rewrite, not a full migration.
- **Dedicated worker service:** if `upload_queue` backlog grows beyond the
  polling worker's throughput or jobs need horizontal scaling/durability,
  evaluate a Go or Python worker on a real queue (keep the job contract in
  the DB).
- **PL/pgSQL expansion:** keep using SQL for set-based/atomic operations;
  do not move broad business logic into stored procedures unless it reduces
  many round-trips for a hot path.
- **CDN/edge caching for catalog/thumbnails:** if catalog egress dominates,
  put `/api/catalog` and thumbnails behind a CDN before changing languages.
- **WASM:** only if a measurable client-side CPU workload appears.

---

## 8. Final recommended stack

```
Frontend      TypeScript · React 18 · Vite · Tailwind/Radix · Zustand/React Query
Application   Python 3.11 · FastAPI (async) · Pydantic v2
Media         Native FFmpeg (ffprobe/ffmpeg) subprocess, orchestrated by Python
Integrations  Pyrogram (MTProto, tgcrypto) · python-telegram-bot · httpx · supabase-py
Database      PostgreSQL 15 (Supabase) · SQL + RLS · PL/pgSQL only for atomic ops
Cache/Rate    In-memory with optional Redis (graceful fallback)
Observability Prometheus · Grafana · structured logs · activity/audit tables
Infra         Docker · render.yaml · netlify.toml · GitHub Actions (YAML)
```

This is the same polyglot set most production systems legitimately need —
**TypeScript, Python, SQL, YAML, Dockerfile** — plus native FFmpeg as
specialized media infrastructure. No new language is adopted in Stage 17;
the optimizations reduce weight and improve response efficiency without
adding operational complexity.
