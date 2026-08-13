# Free Monitoring Stack ($0 Budget)

Modern SaaS requires monitoring, but enterprise tools like **Sentry** or **Google Analytics** can become expensive fast or overkill for small-to-medium Telegram-based apps.

The NexusEdu platform strips those dependencies specifically to allow 100% free operation using alternative systems:

## 1. Error Tracking (Sentry Alternative)

Instead of using Sentry (`@sentry/react` or `sentry-sdk` for Python), the platform relies on **Telegram Alarms**.

- The `backend/bot_manager.py` defines critical handlers.
- When an exception occurs or upload fails, the python backend connects directly to `@BotFather` and pushes an alert directly to your `ADMIN_CHAT_ID` via Telegram message.
- This gives push notifications to your phone at no cost and without an extra dashboard.

## 2. Analytics (Google Analytics Alternative)

To measure active users, instead of dropping Google Analytics cookies on the clients:
- We rely strictly on **Supabase** logs + our unified Dashboard queries.
- When a user logs in, auth metrics show up in Supabase Dashboard.
- Our customized Admin panel queries the `profiles`, `watch_history`, and `activity_logs` table (using `get_admin_stats` function in DB) to show you daily usage stats inside the web app.

## 3. Uptime Monitoring

- Instead of paid Uptime monitors, you can use `.github/workflows/keep-alive.yml`. The free tier of Github Actions automatically pings the server via cron.
- The Render free tier forces an app to sleep after 15 minutes of inactivity. Github Actions keeps the backend warm during peak hours. Note to reduce usage limits, keep-alive workflow should be paused during off-hours or limited to every 14 minutes.
