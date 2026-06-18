# NexusEdu - Project Rules (OpenCode reads this automatically every session)

## What this is
Education platform. Students browse courses + watch video lessons. ALL user-facing text in BENGALI.

## Repo / branches
- GitHub: HasibBot4u/New-mvp-9
- Work on `dev`. `main` auto-deploys to Render (backend) + Netlify (frontend) - NEVER push main unless I say "deploy".

## Tech stack (do not introduce new frameworks without asking)
- Frontend: React 18 + TypeScript (strict) + Vite + Tailwind only. (see src/)
- Backend: FastAPI + Python + Pyrogram, port 8000 local / Render in prod. (see backend/)
- Auth/DB: Supabase = AUTH ONLY. Column names must match the schema EXACTLY.

## HARD RULES (never break - they keep the product working)
1. Video is served THROUGH the backend API. The client NEVER streams from Telegram directly.
2. GZipMiddleware was REMOVED on purpose (it corrupts stream bytes). NEVER add it back.
3. Stream endpoints return signed, short-lived tokens (never raw/permanent URLs).
4. Backend dual Telegram session failover: SESSION_STRING -> SESSION_STRING_2. Keep it intact.

## How to work
- Use Plan mode (Tab) for anything touching auth, the video/stream pipeline, the DB schema, payments, or 3+ files. Show me the plan; I approve; then Build.
- After any edit: say WHAT changed, WHICH file, WHY. Never edit silently.
- For UI: build -> check it -> fix spacing/overflow -> then show me. Bengali text must not overflow cards.
- Never hardcode or print secrets. Read config from env only.
- Only work inside this project folder. Commit format: type(scope): description.

## Session habits
- Start: read this file + HANDOFF.md + recent CHANGELOG.md lines.
- End (when I say save/handoff): update HANDOFF.md, add one line to CHANGELOG.md ([yyyy-mm-dd] action: desc), then commit + push to dev.
