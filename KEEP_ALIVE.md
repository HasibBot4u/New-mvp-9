# Keep-Alive Strategy

Since Render free tier sleeps after 15 minutes of inactivity, you can use a keep-alive strategy to prevent it from sleeping during active hours.

## Method 1: Using Render Cron Jobs
If you have a Render account with access to Cron Jobs, create one that pings your `/api/ping` endpoint every 14 minutes.

- URL: `https://your-app.onrender.com/api/ping`
- Schedule: `*/14 * * * *` (Every 14 minutes)

## Method 2: Third-Party Uptime Monitors (Recommended for Free Tier)
Use a free service like UptimeRobot or cron-job.org to ping the fast `/api/ping` endpoint:

1. Sign up at https://uptimerobot.com/
2. Add a new monitor
3. Type: HTTP(s)
4. URL: `https://your-app.onrender.com/api/ping`
5. Interval: 14 minutes (if available) or 5 minutes.
6. Create Monitor.

Note: Repeated pings will consume standard Render free tier hours. Render gives 750 free hours per month, enough for 1 web service running 24/7 if you don't run any other background workers.
