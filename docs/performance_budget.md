# Performance Budget & Optimization Plan

## 1. Metric Targets (Core Web Vitals)
- **LCP (Largest Contentful Paint):** < 1.5s
- **FID (First Input Delay):** < 50ms
- **CLS (Cumulative Layout Shift):** < 0.1
- **INP (Interaction to Next Paint):** < 100ms
- **TTFB (Time to First Byte):** < 200ms

## 2. Resource Budgets
- **Total Initial JS Payload:** < 250KB (gzipped)
- **CSS Bundle Size:** < 50KB (gzipped)
- **Image Size Limit (Thumbnails):** < 40KB (WebP/AVIF format)
- **Hero Images:** < 150KB

## 3. Caching Strategy
- **Layer 1 (Browser/Service Worker):**
  - Static app assets (JS, CSS, fonts): Cache-First, TTL: 1 year.
  - Video catalog: Stale-While-Revalidate, TTL: 5 minutes.
  - Video progress background syncing.

- **Layer 2 (CDN):**
  - Images, streaming chunks (HLS): Edge-cached, TTL: 30 days.
  - API responses for unauthenticated resources: Stale-While-Revalidate.

- **Layer 3 (Redis):**
  - Authenticated catalog data, video stream signing keys.
  - Fast-path API token validation.
  - Application configuration.

- **Layer 4 (In-Memory/App Tier):**
  - Frequent read metadata (4-minute TTL).
  - DB connection pooling via PgBouncer.

## 4. API & Database Operations
- **Query limits:**
  - N+1 query structures eliminated in all Supabase/Postgres queries.
  - Soft-delete strategy uses indexed `deleted_at IS NULL`.
- **Response Size:**
  - Max response payload < 100KB for common reads. Pagination enforced on all APIs (Limit: 50 items).
  - Compressed via Brotli/Gzip.

## 5. Third-Party Monitoring
- Implementation of Grafana + Prometheus.
  - Slow DB queries (> 300ms) will trigger alerts.
  - High cache miss-rates (> 15%) trigger alerts.
