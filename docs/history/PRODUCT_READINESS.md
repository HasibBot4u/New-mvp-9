# Stage 10 — Product Readiness (UX · A11y · SEO · Analytics)

## UX audit (current state, evidence-based)
- **Consistency:** single design system (shadcn/Tailwind tokens), Bengali-first copy, dark glass theme. Two toast systems still mounted (sonner + radix toaster) — cosmetic duplication; both used by different pages (low priority).
- **States:** loading (PageLoader/skeletons), empty (EmptyState), error (ErrorMessage + player error classification 403/404/network) all present.
- **Mobile:** bottom nav, swipe/double-tap player (Stage-3: tap zones no longer cover controls), PWA install/update toasts. Stage-3 removed 10s-progress toast spam.
- **Destructive actions:** confirm() dialogs on deletes; user deletion requires typed `DELETE-{id}` + HMAC. Enrollment approval/rejection lacks a confirm tap — acceptable (reversible-ish via re-approve 409 guard).
- **Onboarding:** signup → dashboard directly; enrollment flow explained in Bengali inline. Gap: no first-run tour (optional).

## Accessibility (beyond Stage-1 baseline)
Skip link, live region, focus-visible, aria on toasts — present. Remaining concrete gaps (from code, not assumed): quality-selector hover-only control (AdaptivePlayer) if used; `lang="bn"` correct; form labels present on auth/enrollment forms; video lacks captions (content problem, not code).

## SEO
- SPA: public pages client-rendered; meta+JSON-LD+OG in index.html; canonical → nexusedu.netlify.app; robots.txt + generated sitemap (postbuild).
- Claims in JSON-LD/meta ("10,000+ students", 7 subjects) do not match catalog reality (3 subjects) — Stage-1 B-027; recommend editing index.html to match truth before caring about crawlers.
- Auth-gated content isn't indexable anyway — fine for this product.

## Analytics
Backend-only event log (`activity_logs`): page_view/video_played/enrollment/web_vital etc. Stage-2 fixed delivery (JWT keepalive). No funnels/attribution — sufficient for MVP decisions (what plays, who enrolls, errors). Suggested KPI queries live in admin dashboard + `get_admin_stats`.
