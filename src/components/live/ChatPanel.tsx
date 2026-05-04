import React, { useState, useRef, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ChatMessage {
  id: string;
  user_id: string;
  message: string;
  timestamp: string;
}

interface ChatPanelProps {
  roomName: string;
}

export function ChatPanel({ roomName }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const { isConnected, sendMessage, setTyping } = useWebSocket({
    room: roomName,
    onMessage: (msg: any) => {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        user_id: msg.user_id || 'Anonymous',
        message: msg.message,
        timestamp: msg.timestamp || new Date().toISOString()
      }]);
    },
    onUserTyping: (data) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (data.is_typing) {
          newSet.add(data.user_id);
        } else {
          newSet.delete(data.user_id);
        }
        return newSet;
      });
    }
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typingUsers]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    sendMessage(inputValue);
    // Optimistically add to local state
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      user_id: 'Me',
      message: inputValue,
      timestamp: new Date().toISOString()
    }]);
    setInputValue('');
    setTyping(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setTyping(e.target.value.length > 0);
  };

  return (
    <Card className="flex flex-col h-full bg-black/40 border-white/10 backdrop-blur-xl">
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-surface/50">
        <h3 className="font-semibold text-lg flex items-center gap-2">Live Q&A <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span></h3>
        <div className="flex items-center gap-2 text-foreground-muted text-sm">
          <Users className="w-4 h-4" />
          <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.user_id === 'Me' ? 'items-end' : 'items-start'}`}>
            <span className="text-xs text-foreground-muted mb-1">{msg.user_id}</span>
            <div className={`px-3 py-2 rounded-lg max-w-[85%] text-sm ${msg.user_id === 'Me' ? 'bg-primary text-primary-foreground' : 'bg-white/10'}`}>
              {msg.message}
            </div>
            <span className="text-[10px] text-foreground-muted mt-1">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        
        {typingUsers.size > 0 && (
          <div className="text-xs text-foreground-muted italic animate-pulse">
            {typingUsers.size} user(s) typing...
          </div>
        )}
      </div>

      <div className="p-4 border-t border-white/10 bg-surface/30">
        <div className="flex gap-2">
          <Input 
            placeholder="Ask a question..." 
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="bg-black/50 border-white/10"
            disabled={!isConnected}
          />
          <Button onClick={handleSend} disabled={!inputValue.trim() || !isConnected} size="icon" className="shrink-0">
            <Send className="w-4 h-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
