# NexusEdu 🎓
### তোমার শিক্ষার নতুন দিগন্ত

HSC Physics, Chemistry & Higher Math — Online Video Streaming Platform

## Setup Instructions

The easiest way to set up the project locally is using the interactive setup script.

### One-Command Setup

⚠️ **Warning:** The setup script can run database migrations and modify your database. Ensure you run it against a staging Supabase project first.

Run the following command in your terminal:
```bash
python3 scripts/setup.py
```
Or use the Makefile:
```bash
make setup
```

The script will automatically:
1. Verify Python and Node.js versions
2. Install frontend (`npm`) and backend (`pip`) dependencies
3. Validate your `.env` variables
4. Run Supabase Database Migrations
5. Ask to start the development servers concurrently

### Manual Setup

If you prefer to start them manually:

1. Copy `.env.example` to `.env` and fill in your values.
2. In one terminal, start the frontend:
   ```bash
   npm install && npm run dev
   ```
3. In another terminal, start the Python backend (from the **repo root**):
   ```bash
   pip install -r backend/requirements.txt
   uvicorn backend.main:app --reload --port 8000
   ```

> 📖 **New to the project or reviving it?** Read
> [`docs/PROJECT_REVIVAL_GUIDE.md`](docs/PROJECT_REVIVAL_GUIDE.md) — the
> single authoritative operational guide (architecture, accounts, env,
> database, Telegram, deployment, disaster recovery, troubleshooting).

### Required Environment Variables
Please consult the `docs/ENVIRONMENT_VARIABLES.md` file or `.env.example` for the complete list of required environment variables for both frontend and backend.

> **Note:** All database schema changes must go through `supabase/migrations/`. Do NOT use standalone SQL scripts. Applied migration files are never edited; changes go in a new timestamped file.
