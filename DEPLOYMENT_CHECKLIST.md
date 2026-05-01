# Deployment Checklist

## Environment Variables (Netlify)
[ ] VITE_SUPABASE_URL
[ ] VITE_SUPABASE_ANON_KEY
[ ] VITE_API_BASE_URL (points to Render URL)
[ ] VITE_ADMIN_TOKEN (optional, if your backend auth flow uses it for explicit bypass)

## Environment Variables (Render)
[ ] PYTHON_VERSION = 3.11.11
[ ] TELEGRAM_API_ID
[ ] TELEGRAM_API_HASH
[ ] PYROGRAM_SESSION_STRING
[ ] SUPABASE_URL
[ ] SUPABASE_ANON_KEY
[ ] ALLOWED_ORIGINS (e.g., https://nexusedu.netlify.app)
[ ] PORT (usually self-managed, default 8080 or 0.0.0.0/$PORT)

## Scripts & Configs
[ ] backend/requirements.txt exists and is complete
[ ] backend/runtime.txt (Python version pinned)
[ ] render.yaml config is checked in (optional but recommended)
[ ] Github actions .github/workflows check out and have the correct keep-alive ping URL

## Database Setup & Auth
[ ] Email & Password Authentication enabled in Supabase options
[ ] Profile triggers created (handle_new_user)
[ ] RLS policies enable correct read/write constraints across tables (videos, chapters, watch history, profile)
[ ] Database schema updated via `supabase db push` / migrations
[ ] RPC functions created (e.g., admin_generate_chapter_code, check_chapter_access)

## Frontend & SEO
[ ] Check `og-image.png` is populated properly for share card previews
[ ] Ensure sitemap.xml exists and has the correct canonical URL
[ ] CSP and necessary security headers added to `index.html`
[ ] Responsive design tested on mobile viewport

Congratulations! Your platform is production-ready!
