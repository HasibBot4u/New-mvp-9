from backend.realtime.socket_server import sio
import logging

logger = logging.getLogger(__name__)

# --- Room Management ---

@sio.event
async def join_room(sid, data):
    """Join a specific room (e.g., chapter_123, admin_alerts)."""
    room = data.get('room')
    if room:
        sio.enter_room(sid, room)
        logger.info(f"Client {sid} joined room {room}")

@sio.event
async def leave_room(sid, data):
    """Leave a specific room."""
    room = data.get('room')
    if room:
        sio.leave_room(sid, room)
        logger.info(f"Client {sid} left room {room}")

# --- Live Q&A / Chat ---

@sio.event
async def send_message(sid, data):
    """Handle incoming questions/chat messages in a room."""
    session = await sio.get_session(sid)
    user_id = session.get('user_id')
    room = data.get('room')
    message = data.get('message')
    
    if room and message:
        # Broadcast to room
        await sio.emit('new_message', {
            'user_id': user_id,
            'message': message,
            'timestamp': data.get('timestamp')
        }, room=room)

@sio.event
async def typing(sid, data):
    """Typing indicator."""
    session = await sio.get_session(sid)
    room = data.get('room')
    is_typing = data.get('is_typing', True)
    
    if room:
        await sio.emit('user_typing', {
            'user_id': session.get('user_id'),
            'is_typing': is_typing
        }, room=room, skip_sid=sid)

# --- Broadcasting API functions (Callable from other modules) ---

async def broadcast_notification(message: str, target_room: str = "broadcast"):
    """Server-side broadcast a notification to a specific room."""
    await sio.emit('notification', {'message': message}, room=target_room)

async def notify_user(user_id: str, payload: dict):
    """Server-side notify a single user."""
    await sio.emit('notification', payload, room=f"user_{user_id}")
