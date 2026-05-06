#!/usr/bin/env python3
import os
import sys

# Script to validate all environment variables
REQUIRED_VARS = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_ANON_KEY",
    "TELEGRAM_API_ID",
    "TELEGRAM_API_HASH",
    "PYROGRAM_SESSION_STRING",
    "TELEGRAM_BOT_TOKEN",
    "ADMIN_CHAT_ID",
    "THUMBNAIL_CHANNEL_ID",
    "WEBHOOK_URL",
    "ADMIN_TOKEN",
    "ALLOWED_ORIGINS"
]

def load_env():
    # Basic .env loader so you don't need additional dependencies like python-dotenv
    try:
        with open('.env', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip())
    except FileNotFoundError:
        pass

def main():
    load_env()
    
    missing = []
    for var in REQUIRED_VARS:
        if not os.environ.get(var):
            missing.append(var)
    
    if missing:
        print("❌ CRITICAL: The following required environment variables are missing:")
        for var in missing:
            print(f"  - {var}")
        print("\nPlease configure them in your Render Dashboard or local .env file.")
        
        if "TELEGRAM_API_ID" in missing:
             print("\nNote: TELEGRAM_API_ID must be a purely numerical string.")
             
        sys.exit(1)
        
    try:
        int(os.environ.get("TELEGRAM_API_ID"))
    except ValueError:
        print("❌ CRITICAL: TELEGRAM_API_ID must be a number (integer)")
        sys.exit(1)
        
    print("✅ All required environment variables are present.")

if __name__ == "__main__":
    main()
