"""
DIAGNOSTIC SCRIPT - Run this to check your bot configuration
Save as backend/diagnose_bot.py and run with: python backend/diagnose_bot.py
"""

import os
import sys
import asyncio
import json

# Check environment variables
print("=" * 60)
print("NEXUSEDU BOT DIAGNOSTICS")
print("=" * 60)

required_vars = [
    "TELEGRAM_BOT_TOKEN",
    "ADMIN_CHAT_ID", 
    "WEBHOOK_URL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY"
]

print("\n📋 ENVIRONMENT VARIABLES:")
for var in required_vars:
    val = os.environ.get(var, "")
    if val:
        # Mask sensitive values
        display = val[:10] + "..." + val[-5:] if len(val) > 20 else val
        print(f"  ✅ {var}: {display}")
    else:
        print(f"  ❌ {var}: MISSING")

# Check bot token format
print("\n🔑 BOT TOKEN VALIDATION:")
token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
if token:
    parts = token.split(":")
    if len(parts) == 2 and parts[0].isdigit() and len(parts[1]) > 20:
        print(f"  ✅ Format looks valid (ID: {parts[0]})")
    else:
        print(f"  ❌ Invalid format. Expected: 123456:ABC...")
else:
    print("  ❌ No token found")

# Check admin ID
print("\n👤 ADMIN CHAT ID:")
admin_id = os.environ.get("ADMIN_CHAT_ID", "")
if admin_id:
    try:
        int(admin_id)
        print(f"  ✅ Valid integer: {admin_id}")
        if admin_id.startswith("-100"):
            print("  ⚠️  WARNING: This looks like a CHANNEL ID, not a USER ID")
            print("     Get your user ID from @userinfobot")
    except:
        print(f"  ❌ Not a valid integer: {admin_id}")
else:
    print("  ❌ Missing")

# Check webhook URL
print("\n🌐 WEBHOOK URL:")
webhook = os.environ.get("WEBHOOK_URL", "")
if webhook:
    if webhook.endswith("/api/bot_webhook"):
        print(f"  ⚠️  WARNING: URL ends with /api/bot_webhook")
        print("     Should be just: https://your-domain.com")
    else:
        print(f"  ✅ {webhook}")
else:
    print("  ❌ Missing")

# Try importing bot_manager
print("\n🤖 BOT MANAGER IMPORT TEST:")
try:
    from bot_manager import bot_manager
    print("  ✅ Import successful")
    print(f"  Config valid: {bot_manager.config.is_valid()}")
    print(f"  Admin IDs: {bot_manager.config.ADMIN_IDS}")
except Exception as e:
    print(f"  ❌ Import failed: {e}")
    import traceback
    traceback.print_exc()

# Test Telegram API directly
print("\n📡 TELEGRAM API TEST:")
if token:
    import urllib.request
    try:
        url = f"https://api.telegram.org/bot{token}/getMe"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            if data.get("ok"):
                bot_info = data["result"]
                print(f"  ✅ Bot is valid: @{bot_info['username']}")
                print(f"     Name: {bot_info['first_name']}")
                print(f"     ID: {bot_info['id']}")
            else:
                print(f"  ❌ API error: {data}")
    except Exception as e:
        print(f"  ❌ Connection failed: {e}")
else:
    print("  ❌ No token to test")

# Test webhook info
print("\n🪝 WEBHOOK INFO:")
if token:
    import urllib.request
    try:
        url = f"https://api.telegram.org/bot{token}/getWebhookInfo"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            if data.get("ok"):
                result = data["result"]
                print(f"  Webhook URL: {result.get('url', 'NOT SET')}")
                print(f"  Pending updates: {result.get('pending_update_count', 0)}")
                print(f"  Max connections: {result.get('max_connections', 'N/A')}")
            else:
                print(f"  ❌ API error: {data}")
    except Exception as e:
        print(f"  ❌ Connection failed: {e}")
else:
    print("  ❌ No token to test")

print("\n" + "=" * 60)
print("DIAGNOSTICS COMPLETE")
print("=" * 60)
