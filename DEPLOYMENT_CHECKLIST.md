# Deployment Checklist

## Environment Variables (Netlify)
[ ] VITE_SUPABASE_URL
[ ] VITE_SUPABASE_ANON_KEY
[ ] VITE_API_BASE_URL (points to Render URL)
[ ] VITE_SENTRY_DSN

## Environment Variables (Render)
[ ] PYTHON_VERSION = 3.11.11
[ ] TELEGRAM_API_ID
[ ] TELEGRAM_API_HASH
[ ] PYROGRAM_SESSION_STRING
[ ] SUPABASE_URL
[ ] SUPABASE_ANON_KEY
[ ] ALLOWED_ORIGINS (e.g., https://nexusedu.netlify.app)
[ ] PORT (usually self-managed, default 8080 or 0.0.0.0/$PORT)

## Database Setup & Auth
[ ] Email & Password Authentication enabled in Supabase options
[ ] Profile triggers created (handle_new_user)
[ ] Database migrations run
[ ] Supabase RLS policies applied
[ ] RPC functions created (e.g., admin_generate_chapter_code, check_chapter_access)

## Monitoring & CI/CD
[ ] GitHub Actions workflows enabled
[ ] UptimeRobot monitoring active

## Frontend & SEO
[ ] Check `og-image.png` is populated properly for share card preview (WhatsApp share shows correct preview)
[ ] Google Search Console can crawl
[ ] Sitemap accessible at /sitemap.xml
[ ] All routes verified
[ ] CSP and necessary security headers added
[ ] Responsive design tested on mobile viewport (Bottom nav has all icons, Video player controls work, No horizontal scrolling, Touch targets are min 44px)
[ ] Performance verified (Lighthouse > 80, FCP < 2s, No layout shift)

Congratulations! Your platform is production-ready!
