import asyncio
import os
from pyrogram import Client

# Ensure you have your TELEGRAM_API_ID and TELEGRAM_API_HASH set.
api_id = os.environ.get("TELEGRAM_API_ID")
api_hash = os.environ.get("TELEGRAM_API_HASH")
session_string = os.environ.get("PYROGRAM_SESSION_STRING")

async def main():
    if not api_id or not api_hash:
        print("Please set TELEGRAM_API_ID and TELEGRAM_API_HASH in your environment.")
        return

    # If you have a session string you can use it, otherwise pyrogram will prompt for login
    app = Client("my_account", api_id=api_id, api_hash=api_hash, session_string=session_string)
    
    channel_name = input("Enter the EXACT name of the channel: ")
    
    async with app:
        try:
            chat = await app.get_chat(channel_name)
            print(f"Channel Name: {chat.title}")
            print(f"Channel ID: {chat.id}")
        except Exception as e:
            print(f"Error fetching channel: {e}")
            print("Make sure you are a member of the channel and entered the name correctly.")

if __name__ == "__main__":
    asyncio.run(main())
