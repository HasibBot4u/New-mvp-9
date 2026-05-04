# Performance Optimization Matrix

## 1. Metric Targets (Core Web Vitals)
- **LCP**: < 1.5s
- **FID**: < 50ms
- **CLS**: < 0.1
- **INP**: < 100ms
- **TTFB**: < 200ms

## 2. Resource Budgets
- **Total Initial JS Payload:** < 250KB (gzipped)
- **CSS Bundle Size:** < 50KB (gzipped)
- **Image Size Limit (Thumbnails):** < 40KB (WebP/AVIF format)

## 3. Caching Strategy
- **Layer 1 (Browser/Service Worker):** Static app assets (JS, CSS, fonts). TTL: 1 year. Video progress background syncing.
- **Layer 2 (CDN):** Images, streaming chunks (HLS). API responses for unauthenticated resources.
- **Layer 3 (Redis):** Authenticated catalog data, video stream signing keys. Fast-path API token validation.
- **Layer 4 (In-Memory/App Tier):** Frequent read metadata (4-minute TTL). DB connection pooling.

## 4. API & Database Operations
- **Query limits:** N+1 query structures eliminated in all Supabase/Postgres queries.
- **Response Size:** Max response payload < 100KB for common reads. Pagination enforced on all APIs.

## 5. Third-Party Monitoring
- Implementation of Grafana + Prometheus.
- Alerting on high error rates and slow API response times > 2s.
