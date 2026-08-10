# Stage 6 — Performance & Scalability Engineering

## A. What was measured/changed in this pass (evidence)
1. **Bundle diet (done):** removed dead three.js/@react-three/react-window/embla/resizable stack — `npm install` reported **71 packages removed**; the ~600KB `three` chunk no longer exists (verified via build before/after chunk list).
2. **Catalog HTTP cache (done):** `/api/catalog` now sends `Cache-Control: public, max-age=60` (public data) — cuts repeated full-catalog egress.
3. **Auth-path connection reuse (done, Stage 2):** shared httpx client for token/admin checks.
4. **Metric cardinality bounded (done):** templated Prometheus paths.
5. **No more mid-play reloads (done):** ticket effect regression fix removes wasted media reloads.
Remaining large chunks (build output): pdf ~463KB (lazy — ResourcesPage only), radix ~300KB, recharts (admin-only lazy route). Acceptable for an MVP; further splits listed below.

## B. Hot-path latency anatomy (stream)
Request → token verify (cached ≤300s; miss = 1 GoTrue RTT ~50–150ms) → blocked check (60s cache) → rate limit (Redis or memory) → chapter check (free: 0 DB calls; paid: 1 PostgREST RTT) → Telegram `get_message` (LRU 1h) → MTProto chunks. **Steady-state per-chunk cost ≈ Telegram bandwidth only.** First-byte for a cold video ≈ GoTrue miss + message fetch (≈200–400ms BD→SG).

## C. Bottleneck ranking (what actually constrains this system)
1. **Single uvicorn worker / one event loop** — all MTProto bytes funnel through it. CPU is fine (I/O-bound) but one process = one Telegram connection pool + per-process in-memory state.
2. **Telegram FloodWait** — account-level; one abusive burst stalls every stream (mitigation: secondary session `PYROGRAM_SESSION_STRING_2` failover exists).
3. **Render free tier sleep + 750h quota** — solved by paid tier or keep-alive.
4. **No CDN** — every byte re-proxied; thumbnails re-fetched from Telegram (private 7d cache helps browsers).
5. In-memory state (catalog/video_map/counters) blocks horizontal scaling.

## D. 10× / 100× projection
- **10× current (≈hundreds concurrent):** single worker holds IF ranges stay small and Telegram doesn't FloodWait; recommended NOW: paid Render (≥2 instances impossible until state externalized) — pragmatic step: stay single-instance but size up; enable Redis (already optional) so rate limits survive restarts.
- **100×:** architecture change required: (a) move token/blocked/chapter caches to Redis; (b) externalize `concurrent_user_streams` (Redis INCR/EXPIRE per user); (c) N uvicorn workers behind Render LB — becomes possible once (a,b) land; (d) real CDN or HLS variants (schema `video_variants` exists; pipeline stubbed) to stop proxying every byte; (e) Supabase connection pooler already default.
- **First bottleneck at growth:** Telegram FloodWait/bandwidth through one session, then single-worker RAM (message LRU 300 items × message objects).

## E. Frontend performance budget
Targets (mobile 4G): LCP < 3.5s on dashboard, player TTFB < 1s warm. Current aids: route-level lazy, IDB offline catalog, SW caches, preconnect to Supabase/Render. Watch: `AdminDashboardPage` fires ~8 parallel queries (bounded, fine); `activity_logs` growth → add retention (R7 below).

## F. Remaining actions (reason-tagged per Stage-7 rule)
| ID | Action | Reason | Priority |
|---|---|---|---|
| P1 | Redis-backed stream counter + token cache | scalability | before 2nd instance |
| P2 | Finish HLS/variant pipeline (or adopt R2/S3 when budget allows) | performance+cost | medium |
| P3 | `activity_logs` monthly partition/retention job | DB health | medium |
| P4 | Add `loading="lazy"`+`decoding="async"` to thumbnail imgs | mobile LCP | low |
