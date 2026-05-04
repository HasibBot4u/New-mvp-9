import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/contexts/AuthContext';

interface UseWebSocketOptions {
  room?: string;
  onMessage?: (message: any) => void;
  onNotification?: (notification: any) => void;
  onUserTyping?: (data: { user_id: string; is_typing: boolean }) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const { session, user } = useAuth();
  
  const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

  useEffect(() => {
    // Basic guard: require session for websocket connection
    if (!session?.access_token) return;

    // Initialize socket
    const socket = io(SOCKET_URL, {
      auth: {
        token: session.access_token,
        user_id: user?.id
      },
      transports: ['websocket'],
      autoConnect: true,
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      
      // Join specific room if provided
      if (options.room) {
        socket.emit('join_room', { room: options.room });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    if (options.onMessage) {
      socket.on('new_message', options.onMessage);
    }
    
    if (options.onNotification) {
      socket.on('notification', options.onNotification);
    }
    
    if (options.onUserTyping) {
      socket.on('user_typing', options.onUserTyping);
    }

    return () => {
      if (options.room) {
        socket.emit('leave_room', { room: options.room });
      }
      socket.disconnect();
    };
  }, [session, options.room, SOCKET_URL]);

  const sendMessage = useCallback((message: string) => {
    if (socketRef.current?.connected && options.room) {
      socketRef.current.emit('send_message', { 
        room: options.room, 
        message,
        timestamp: new Date().toISOString()
      });
    }
  }, [options.room]);

  const setTyping = useCallback((isTyping: boolean) => {
    if (socketRef.current?.connected && options.room) {
      socketRef.current.emit('typing', { 
        room: options.room, 
        is_typing: isTyping 
      });
    }
  }, [options.room]);

  return { isConnected, sendMessage, setTyping };
}
