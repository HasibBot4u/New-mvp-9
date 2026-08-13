# ADR-002: Telegram as an Integration Boundary

- **Status:** Accepted (Stage 16)
- **Date:** 2026-08-11

## Context
Telegram serves two distinct roles that were previously tangled into `main.py`:
1. **Storage/CDN via MTProto (Pyrogram)** — private channels hold video files;
   the backend resolves channels, caches messages and streams byte ranges.
2. **Admin Bot via Bot API (python-telegram-bot)** — webhook commands
   (`/status`, `/stats`, `/notify`, `/scan`).

Business logic (catalog, enrollment authz, progress) should not know about
Pyrogram client objects, session strings, or reconnection details.

## Decision
- `backend/integrations/telegram_client.py` is the **only** module that
  imports Pyrogram. It exposes a small surface: `get_active_client()`,
  `ensure_connected()`, `resolve_channel()`, `get_message()`,
  `stream_range()`, `get_thumbnail_bytes()`, lifecycle `start_clients/stop_clients/watchdog`.
- `backend/integrations/telegram_bot.py` owns the Bot API webhook application
  and command handlers. It imports only `backend.state` and
  `telegram_client` for read access — never `backend.main`.
- The rest of the app depends on those functions/interfaces, so Telegram can
  be disabled (missing credentials) or replaced without touching domains.

## Consequences
- Telegram outages degrade streaming/thumbnails (503/placeholder) but cannot
  crash catalog or auth logic.
- The MTProto and Bot clients remain independently testable.
- No abstract "storage provider" interface was added preemptively; YAGNI —
  the integration module itself is the replaceable seam.
