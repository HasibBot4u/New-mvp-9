import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Square, Download, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTailing, setIsTailing] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [timeFilter, setTimeFilter] = useState("24h");
  
  const fetchLogs = async () => {
    try {
      let query = supabase
        .from("activity_logs")
        .select("*, profiles(display_name, email)")
        .order("created_at", { ascending: false })
        .limit(200); // Fetch more so local filtering works well
      
      const now = new Date();
      if (timeFilter === "1h") {
        query = query.gte("created_at", new Date(now.getTime() - 60 * 60 * 1000).toISOString());
      } else if (timeFilter === "24h") {
        query = query.gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
      } else if (timeFilter === "7d") {
        query = query.gte("created_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());
      } else if (timeFilter === "30d") {
        query = query.gte("created_at", new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());
      }
      
      const { data, error } = await query;
      if (error) throw error;
      if (data) {
        setLogs(data);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(() => {
      if (isTailing) {
        fetchLogs();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isTailing, timeFilter]);

  const getSeverity = (log: any) => {
    const a = (log.action || "").toLowerCase();
    const d = log.details ? JSON.stringify(log.details).toLowerCase() : "";
    const combined = a + " " + d;
    
    if (["error", "failed", "exception", "crash", "timeout"].some(kw => combined.includes(kw))) return "ERROR";
    if (["warn", "warning", "deprecated", "slow"].some(kw => combined.includes(kw))) return "WARN";
    if (["login", "logout", "signup", "auth"].some(kw => combined.includes(kw))) return "AUTH";
    if (["debug", "trace"].some(kw => combined.includes(kw))) return "DEBUG";
    if (["info", "success", "completed", "started"].some(kw => combined.includes(kw))) return "INFO";
    return "INFO"; // Default
  };

  const getSource = (log: any) => {
    const a = (log.action || "").toLowerCase();
    const d = log.details || {};
    const s = ((d as any).source || a || "").toLowerCase();
    
    if (s.includes("worker") || s.includes("build")) return "worker";
    if (s.includes("telegram")) return "telegram";
    if (s.includes("api")) return "api";
    if (a.includes("login") || a.includes("logout") || a.includes("signup") || s.includes("auth")) return "auth";
    if (s.includes("db") || s.includes("database") || s.includes("supabase")) return "db";
    return "api"; 
  };

  const getMessage = (log: any) => {
    if (log.details && (log.details as any).message) return (log.details as any).message;
    if (log.details && (log.details as any).error) return (log.details as any).error;
    if (log.action === "stream_start") return `Started streaming video ${log.details?.video_id || ""}`;
    if (log.action === "course_enroll") return `Enrolled in course ${log.details?.course_id || ""}`;
    return log.action;
  };

  const filteredLogs = logs.filter(log => {
    const sev = getSeverity(log);
    const src = getSource(log);
    const msg = getMessage(log);
    
    if (severityFilter !== "All" && sev !== severityFilter.toUpperCase()) return false;
    if (sourceFilter !== "All" && src.toLowerCase() !== sourceFilter.toLowerCase()) return false;
    
    if (search) {
      const s = search.toLowerCase();
      if (!msg.toLowerCase().includes(s) && 
          !src.toLowerCase().includes(s) && 
          !sev.toLowerCase().includes(s) &&
          !(log.user_id && log.user_id.toLowerCase().includes(s))) {
        return false;
      }
    }
    
    return true;
  });

  const getSeverityBadgeColor = (sev: string) => {
    switch(sev) {
      case "ERROR": return "bg-red-500/10 text-red-500 border-red-500/30";
      case "WARN": return "bg-orange-500/10 text-orange-500 border-orange-500/30";
      case "INFO": return "bg-blue-500/10 text-blue-500 border-blue-500/30";
      case "DEBUG": return "bg-gray-500/10 text-gray-400 border-gray-500/30";
      case "AUTH": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
      default: return "bg-blue-500/10 text-blue-500 border-blue-500/30";
    }
  };

  const getRowColor = (sev: string) => {
    switch(sev) {
      case "ERROR": return "bg-red-500/[0.03]";
      case "WARN": return "bg-orange-500/[0.03]";
      case "AUTH": return "bg-emerald-500/[0.03]";
      default: return "";
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `system_logs_${new Date().toISOString()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleClearLogs = async () => {
    if (window.confirm("Are you sure you want to clear logs older than 30 days? This action cannot be undone.")) {
       const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
       try {
         const { error } = await supabase.from("activity_logs").delete().lt("created_at", thirtyDaysAgo);
         if (error) throw error;
         toast.success("Successfully cleared old logs");
         fetchLogs();
       } catch (err: any) {
         toast.error("Failed to clear logs", { description: err.message });
       }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 min-h-[calc(100vh-100px)] flex flex-col pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
          <p className="text-foreground/60 mt-1">Real-time log viewer and diagnostic tools.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="destructive" size="sm" className="h-9 opacity-80 hover:opacity-100" onClick={handleClearLogs}>
            <Trash2 className="w-4 h-4 mr-2" /> Clear Old
          </Button>
          <Button variant="outline" size="sm" className="h-9 bg-surface/50" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button 
            variant={isTailing ? "default" : "secondary"} 
            size="sm" 
            className="h-9 shadow-sm"
            onClick={() => setIsTailing(!isTailing)}
          >
            {isTailing ? <><Square className="w-4 h-4 mr-2" /> Stop Tail</> : <><Play className="w-4 h-4 mr-2" /> Resume Tail</>}
          </Button>
        </div>
      </div>

      <Card className="bg-surface/40 border-border/50 shadow-sm flex-1 flex flex-col overflow-hidden">
        {/* Filters */}
        <div className="p-3 border-b border-border/30 flex flex-wrap items-center gap-3 bg-surface/30">
          <div className="relative max-w-sm flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-foreground/40" />
            <Input 
              placeholder="Search message, source, or user..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 bg-black/20 border-border/50 text-sm focus-visible:ring-primary shadow-inner" 
            />
          </div>
          
          <select 
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="h-8 rounded-md border border-border/50 bg-black/20 px-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
          >
            <option value="All">All Levels</option>
            <option value="Error">Error</option>
            <option value="Warn">Warn</option>
            <option value="Info">Info</option>
            <option value="Auth">Auth</option>
            <option value="Debug">Debug</option>
          </select>

          <select 
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="h-8 rounded-md border border-border/50 bg-black/20 px-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
          >
             <option value="All">All Sources</option>
             <option value="api">API</option>
             <option value="worker">Worker</option>
             <option value="telegram">Telegram</option>
             <option value="db">DB</option>
             <option value="auth">Auth</option>
          </select>

          <select 
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="h-8 rounded-md border border-border/50 bg-black/20 px-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
          >
             <option value="1h">Last 1 Hour</option>
             <option value="24h">Last 24 Hours</option>
             <option value="7d">Last 7 Days</option>
             <option value="30d">Last 30 Days</option>
          </select>
        </div>
        
        <div className="flex-1 bg-[#0a0a0a] p-2 md:p-4 overflow-y-auto font-mono text-[11px] md:text-xs leading-relaxed custom-scrollbar flex flex-col pt-4">
          <div className="space-y-1 mt-auto">
            {isLoading ? (
              <div className="p-4 text-foreground/40 text-center flex items-center justify-center gap-2">
                <Spinner className="w-4 h-4 animate-spin" /> Loading logs...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-foreground/40 text-center italic border border-dashed border-border/50 rounded-lg m-4">
                No logs match the current filters.
              </div>
            ) : (
              // Display in oldest-first or newest-first? Normally tails display newest at bottom.
              // We fetched order("created_at", descending: true). 
              // To show newest at the bottom, we map in reverse, or flex-col-reverse. 
              // The parent has flex-col, let's reverse the array.
              [...filteredLogs].reverse().map((log) => {
                const sev = getSeverity(log);
                const src = getSource(log);
                const msg = getMessage(log);
                
                return (
                  <div key={log.id} className={`flex items-start gap-2 md:gap-4 hover:bg-white/[0.05] px-2 py-1.5 rounded transition-colors border border-transparent hover:border-border/30 ${getRowColor(sev)}`}>
                    <span className="shrink-0 opacity-40 tabular-nums">
                      {new Date(log.created_at).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                    </span>
                    <Badge variant="outline" className={`shrink-0 w-[52px] h-[20px] pb-0.5 justify-center rounded-[4px] font-bold text-[9px] uppercase border-0 flex shadow-sm ${getSeverityBadgeColor(sev)}`}>
                      {sev}
                    </Badge>
                    <span className="shrink-0 w-16 text-purple-400/80 hidden sm:inline-block truncate">[{src}]</span>
                    
                    <span className="flex-1 break-all text-foreground/80 leading-snug">
                      <span className="sm:hidden text-purple-400/80 mr-1">[{src}]</span>
                      {msg}
                    </span>

                    {log.user_id && (
                      <span className="shrink-0 text-foreground/40 truncate max-w-[120px] hidden md:inline-block font-sans text-[10px]" title={log.user_id}>
                        {log.profiles?.email || log.user_id.slice(0, 8) + '...'}
                      </span>
                    )}
                    {log.ip_address && (
                       <span className="shrink-0 text-foreground/30 truncate hidden lg:inline-block">
                         {log.ip_address}
                       </span>
                    )}
                  </div>
                );
              })
            )}
            
            {/* Anchor for auto-scroll if needed */}
            <div className="h-2"></div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Temporary spinner component to replace missing import
function Spinner({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}

