#!/usr/bin/env python3
import os
import sys
import platform
import subprocess
import json
import time

def run_cmd(cmd, error_msg):
    try:
        subprocess.run(cmd, check=True, shell=True)
    except subprocess.CalledProcessError:
        print(f"❌ {error_msg}")
        sys.exit(1)

def get_cmd_output(cmd):
    try:
        return subprocess.check_output(cmd, shell=True, text=True).strip()
    except subprocess.CalledProcessError:
        return None

def check_python_version():
    print("⏳ Checking Python version...")
    version = sys.version_info
    if version.major == 3 and 11 <= version.minor <= 13:
        print(f"✅ Python {version.major}.{version.minor}.{version.micro} detected.")
    else:
        print(f"❌ Python 3.11 - 3.13 is required. Found: {sys.version.split(' ')[0]}")
        sys.exit(1)

def check_node_version():
    print("⏳ Checking Node.js version...")
    node_v = get_cmd_output("node -v")
    if not node_v:
        print("❌ Node.js is not installed.")
        sys.exit(1)
    
    major = int(node_v.lstrip('v').split('.')[0])
    if major >= 18:
        print(f"✅ Node.js {node_v} detected.")
    else:
        print(f"❌ Node.js 18+ is required. Found: {node_v}")
        sys.exit(1)

def install_backend_dependencies():
    print("⏳ Installing backend dependencies...")
    run_cmd("pip install -r backend/requirements.txt", "Failed to install Python dependencies.")
    print("✅ Backend dependencies installed.")

def install_frontend_dependencies():
    print("⏳ Installing frontend dependencies...")
    run_cmd("npm install", "Failed to install Node.js dependencies.")
    print("✅ Frontend dependencies installed.")

def run_db_migrations(skip_migrations: bool = False):
    if os.environ.get("NEXUSEDU_ENV") == "production":
        print("❌ Cannot run database migrations in production environment (NEXUSEDU_ENV=production).")
        sys.exit(1)

    if skip_migrations or "--skip-migrations" in sys.argv:
        print("⏭️ Skipping database migrations (--skip-migrations flag provided).")
        return

    print("⏳ Checking Supabase CLI for database migrations...")
    supabase_v = get_cmd_output("npx supabase --version")
    if supabase_v:
        print("✅ Supabase CLI detected.")
        status_output = get_cmd_output("npx supabase status")
        print(f"Linked Supabase project status:\n{status_output if status_output else 'Unable to determine project status'}")

        confirm = input("⚠️ WARNING: This will push migrations to your database. Type 'PUSH' to proceed: ")
        if confirm.strip() != "PUSH":
            print("⏭️ Migration push cancelled by user.")
            return

        print("Running database migrations...")
        try:
            subprocess.run("npx supabase db push", shell=True, check=True)
            print("✅ Database migrations applied.")
        except subprocess.CalledProcessError:
            print("⚠️ Database migrations failed or not connected. Check your Supabase configuration.")
    else:
        print("⏭️ Supabase CLI not found locally or failed. Skipping migrations.")

def start_dev_environment():
    print("🚀 Starting Development Environment...")
    print("Backend will run on http://localhost:8000")
    print("Frontend will run on http://localhost:5173 (or 3000 depending on Vite config)")
    print("-" * 50)
    
    frontend = None
    backend = None
    try:
        frontend = subprocess.Popen("npm run dev", shell=True)
        backend_cmd = "uvicorn backend.main:app --reload --port 8000"
        backend = subprocess.Popen(backend_cmd, shell=True)
        
        while True:
            f_poll = frontend.poll()
            b_poll = backend.poll()
            if f_poll is not None or b_poll is not None:
                break
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n🛑 Shutting down development servers...")
    finally:
        for p in [frontend, backend]:
            if p and p.poll() is None:
                p.terminate()
                try:
                    p.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    p.kill()
        print("✅ Shutdown complete.")

def main():
    print("=" * 50)
    print("🎓 NexusEdu Full-Stack Setup Script")
    print("=" * 50)
    
    skip_migrations = "--skip-migrations" in sys.argv

    check_python_version()
    check_node_version()
    
    install_frontend_dependencies()
    install_backend_dependencies()
    
    # We call the validation script we made earlier
    if os.path.exists("scripts/validate_env.py"):
        print("⏳ Validating Environment Variables...")
        try:
            subprocess.run([sys.executable, "scripts/validate_env.py"], check=True)
        except subprocess.CalledProcessError:
            print("⚠️ Please configure missing environment variables.")
            # We fail soft here to not block the script if they just want to see it run partially
    
    run_db_migrations(skip_migrations=skip_migrations)
    
    print("🎉 Setup Complete!")
    choice = input("Do you want to start the development servers now? [y/N]: ")
    if choice.lower() in ['y', 'yes', 'j']:
        start_dev_environment()

if __name__ == "__main__":
    main()

