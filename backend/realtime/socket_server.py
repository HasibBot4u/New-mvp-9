import socketio
from fastapi import FastAPI
import jwt
import logging

logger = logging.getLogger(__name__)

# Basic config, in production cors_allowed_origins should be restricted
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

def init_socket_app(app: FastAPI):
    # This will wrap the fastapi app to also handle socketio
    socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
    return socket_app

@sio.event
async def connect(sid, environ, auth):
    try:
        if not auth or 'token' not in auth:
            raise ConnectionRefusedError('Authentication required')
            
        token = auth['token']
        # Very simple validation mock. In production verify with supabase!
        # user = await verify_token(token)
        
        # Mock user id setup
        user_id = auth.get("user_id", "anonymous")
        
        await sio.save_session(sid, {'user_id': user_id})
        
        # Join user's personal room
        sio.enter_room(sid, f"user_{user_id}")
        
        logger.info(f"Client {sid} connected as {user_id}")
        
    except Exception as e:
        logger.error(f"WebSocket connection failed: {e}")
        raise ConnectionRefusedError('Authentication failed')

@sio.event
async def disconnect(sid):
    session = await sio.get_session(sid)
    logger.info(f"Client {sid} disconnected (user: {session.get('user_id')})")
    
# Included events module to register event logic
import backend.realtime.events
