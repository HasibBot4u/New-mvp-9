# Environment Variables Guide

Understanding environment variables is crucial for local development and deploying your software to production environments like Render or Netlify.

## Core Concepts

1. **`.env` files are FOR LOCAL DEVELOPMENT ONLY.** You create a `.env` file on your own computer. You must **NEVER** push this file to GitHub, as it contains secret keys that hackers will steal.
2. **Production servers don't use `.env` files.** When you deploy to Render or Netlify, those platforms read environment variables directly from their dashboards (their secure systems).
3. **`VITE_` variables are special.** In our React frontend, any variable starting with `VITE_` can be read by the browser. If it doesn't start with `VITE_`, the browser cannot see it.
4. **Vite bakes variables at build time.** When Netlify builds the website, it "hardcodes" the values of `VITE_` variables into the HTML/JS. If you change a frontend variable in Netlify later, you **MUST rebuild/redeploy** the site for the change to take effect.

---

## Where to Set Them

### 1. Local Development
- Copy the `.env.example` file and rename the copy to `.env`.
- Fill in actual values in `.env`.
- Note: `.gitignore` is already configured to ignore `.env` so it won't be pushed.

### 2. Render.com Dashboard (Backend)
- Go to your Web Service in the Render dashboard.
- Click **Environment** in the side navigation.
- Under **Environment Variables**, click **Add Environment Variable**.
- Add all the backend variables (`SUPABASE_URL`, `TELEGRAM_API_ID`, etc.).

### 3. Netlify Dashboard (Frontend)
- Go to your Site configuration in Netlify.
- Go to **Site settings > Environment variables**.
- Add the three `VITE_` variables here.
- **Remember:** Trigger a new "Clear cache and deploy" if you change these.

### 4. GitHub Secrets (CI/CD)
- If you use GitHub Actions (e.g., our `deploy.yml` or `backend-deploy.yml`), you must add secrets to GitHub so the actions can run or build your app using those vars.
- Go to your GitHub Repository -> Settings -> Secrets and variables -> Actions.
- Click "New repository secret".

---

## The Variables You Need

**Required for the Frontend:**
- `VITE_SUPABASE_URL`: Get from Supabase Dashboard -> Project Settings -> API -> Project URL
- `VITE_SUPABASE_ANON_KEY`: Get from Supabase -> Project Settings -> API -> Project API Keys -> `anon` `public`
- `VITE_API_BASE_URL`: The URL of your rendered backend, e.g. `https://your-app.onrender.com`

**Required for the Backend:**
- `SUPABASE_URL`: (Same as above)
- `SUPABASE_SERVICE_KEY`: Supabase -> Project Settings -> API -> `service_role` `secret`. **WARNING: DO NOT EXPOSE TO FRONTEND!**
- `SUPABASE_ANON_KEY`: (Same as above)
- `TELEGRAM_API_ID`: Get from `https://my.telegram.org` -> API development tools. MUST be a number.
- `TELEGRAM_API_HASH`: Get from `https://my.telegram.org` -> API development tools.
- `PYROGRAM_SESSION_STRING`: Get by running a local pyrogram generator script.
- `TELEGRAM_BOT_TOKEN`: Get from Telegram via `@BotFather`.
- `ADMIN_CHAT_ID`: Your personal Telegram User ID (or a group ID) where bot sends alerts.
- `THUMBNAIL_CHANNEL_ID`: Channel ID starting with `-100...` where video thumbnails are kept.
- `WEBHOOK_URL`: Your back-end URL `https://your-app.onrender.com/api/bot_webhook`
- `ADMIN_TOKEN`: A completely random password you invent for backend protected endpoints.
- `ALLOWED_ORIGINS`: URLs allowed to talk to the backend, e.g. `https://your-site.netlify.app,http://localhost:5173`.
