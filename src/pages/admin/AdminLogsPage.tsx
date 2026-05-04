import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Square, Download, Filter } from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: string;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isTailing, setIsTailing] = useState(true);

  // Simulate real-time logs
  useEffect(() => {
    if (!isTailing) return;
    
    // Initial logs
    const initialLogs: LogEntry[] = Array.from({length: 20}, (_, i) => ({
      id: `log_${Date.now()}_${i}`,
      timestamp: new Date(Date.now() - (20-i) * 1000).toISOString(),
      level: Math.random() > 0.8 ? 'error' : Math.random() > 0.6 ? 'warn' : 'info',
      message: ['User logged in', 'Database query slow', 'Telegram rate limit hit', 'Uploaded chunk 5', 'Session token expired'][Math.floor(Math.random() * 5)],
      source: ['api', 'auth', 'telegram', 'worker'][Math.floor(Math.random() * 4)]
    }));
    
    setLogs(initialLogs);

    const interval = setInterval(() => {
      const levelRand = Math.random();
      const newLog: LogEntry = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: levelRand > 0.9 ? 'error' : levelRand > 0.7 ? 'warn' : 'info',
        message: ['User fetch profile', 'Job completed', 'Invalid input received', 'Stripe webhook', 'Connection established'][Math.floor(Math.random() * 5)],
        source: ['api', 'web', 'worker', 'payment'][Math.floor(Math.random() * 4)]
      };
      setLogs(prev => [...prev.slice(-99), newLog]); // Keep last 100
    }, 2000);

    return () => clearInterval(interval);
  }, [isTailing]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 min-h-[calc(100vh-100px)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Logs</h1>
          <p className="text-foreground-muted text-sm mt-1">Real-time log viewer and diagnostic tools.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9">
            <Download className="w-4 h-4 mr-2" /> Export Logs
          </Button>
          <Button 
            variant={isTailing ? "default" : "secondary"} 
            size="sm" 
            className="h-9"
            onClick={() => setIsTailing(!isTailing)}
          >
            {isTailing ? <><Square className="w-4 h-4 mr-2" /> Stop Tail</> : <><Play className="w-4 h-4 mr-2" /> Resume Tail</>}
          </Button>
        </div>
      </div>

      <Card className="bg-surface/40 border-white/5 backdrop-blur-xl flex-1 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-white/5 flex gap-2 bg-black/20">
          <Input placeholder="Search logs..." className="h-8 bg-black/20 border-white/10 max-w-sm text-sm" />
          <Button variant="outline" size="sm" className="h-8 px-2"><Filter className="w-4 h-4" /></Button>
        </div>
        
        <div className="flex-1 bg-[#0a0a0a] p-4 overflow-y-auto font-mono text-[11px] leading-relaxed custom-scrollbar flex flex-col-reverse">
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className={`flex items-start gap-4 hover:bg-white/5 px-2 py-0.5 rounded ${log.level === 'error' ? 'text-red-400 bg-red-500/5' : log.level === 'warn' ? 'text-yellow-400 bg-yellow-500/5' : 'text-gray-400'}`}>
                <span className="shrink-0 opacity-50">{new Date(log.timestamp).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                <span className={`shrink-0 w-12 uppercase ${log.level === 'error' ? 'text-red-500 font-bold' : log.level === 'warn' ? 'text-yellow-500 font-bold' : 'text-blue-500'}`}>
                  {log.level}
                </span>
                <span className="shrink-0 w-20 text-purple-400">[{log.source}]</span>
                <span className="break-all">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
