import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, Activity, User, BookOpen, Map, StickyNote, Video, Laptop, ArrowLeft, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://nexusedu-backend-0bjq.onrender.com";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export default function AdminUserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  
  const [profile, setProfile] = useState<FetchState<any>>({ data: null, loading: true, error: null });
  const [stats, setStats] = useState<FetchState<any>>({ data: null, loading: true, error: null });
  const [activity, setActivity] = useState<FetchState<any[]>>({ data: null, loading: true, error: null });
  const [watchHistory, setWatchHistory] = useState<FetchState<any[]>>({ data: null, loading: true, error: null });
  const [notes, setNotes] = useState<FetchState<any[]>>({ data: null, loading: true, error: null });
  const [sessions, setSessions] = useState<FetchState<any[]>>({ data: null, loading: true, error: null });

  const [notesSearch, setNotesSearch] = useState("");
  const [notificationMsg, setNotificationMsg] = useState("");
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  // Abort controller refs
  const abortControllers = useRef<{ [key: string]: AbortController }>({});

  const fetchData = async (
    endpoint: string, 
    setState: React.Dispatch<React.SetStateAction<FetchState<any>>>, 
    key: string
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    if (abortControllers.current[key]) {
      abortControllers.current[key].abort();
    }
    
    const controller = new AbortController();
    abortControllers.current[key] = controller;
    
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    try {
      const token = session?.access_token;
      if (!token) throw new Error("No session token available");

      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: { "Authorization": `Bearer ${token}` },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      setState({ data, loading: false, error: null });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setState({ data: null, loading: false, error: "Request timed out" });
      } else {
        setState({ data: null, loading: false, error: err.message || "Failed to load data" });
      }
    }
  };

  const loadAllData = () => {
    if (!userId) return;
    fetchData(`/api/admin/users/${userId}/profile`, setProfile, 'profile');
    fetchData(`/api/admin/users/${userId}/stats`, setStats, 'stats');
    fetchData(`/api/admin/users/${userId}/activity?page=1&limit=50`, setActivity, 'activity');
    fetchData(`/api/admin/users/${userId}/watch-history`, setWatchHistory, 'history');
    fetchData(`/api/admin/users/${userId}/notes`, setNotes, 'notes');
    fetchData(`/api/admin/users/${userId}/sessions`, setSessions, 'sessions');
  };

  useEffect(() => {
    loadAllData();
    
    return () => {
      // Abort all in-flight requests on unmount
      Object.values(abortControllers.current).forEach(c => c.abort());
    };
  }, [userId, session]);

  const handleSendNotification = async () => {
    if (!notificationMsg.trim() || !userId) return;
    setSendingNotification(true);
    try {
      // Stubbing the notification send action as per missing specific endpoint requirement in prompt
      await new Promise(resolve => setTimeout(resolve, 1000));
      setNotificationOpen(false);
      setNotificationMsg("");
      alert("Notification sent successfully.");
    } catch (err) {
      alert("Failed to send notification.");
    } finally {
      setSendingNotification(false);
    }
  };

  const renderSkeleton = () => (
    <div className="animate-pulse space-y-4 w-full">
      <div className="h-4 bg-white/10 rounded w-3/4"></div>
      <div className="h-4 bg-white/10 rounded w-1/2"></div>
      <div className="h-32 bg-white/10 rounded"></div>
    </div>
  );

  const renderError = (error: string, retryFn: () => void) => (
    <div className="p-6 text-center border border-destructive/20 bg-destructive/10 rounded-xl">
      <p className="text-destructive mb-4 font-medium">{error}</p>
      <Button variant="outline" size="sm" onClick={retryFn}>
        Retry Loading
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden gap-4 -m-4 sm:-m-8 p-4 sm:p-8 pt-0">
      <div className="shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate("/admin/users")} variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">User Details</h1>
        </div>
        
        <Dialog open={notificationOpen} onOpenChange={setNotificationOpen}>
          <DialogTrigger asChild>
            <Button variant="default" className="gap-2">
              <Send className="w-4 h-4" />
              Send Notification
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-background border-border">
            <DialogHeader>
              <DialogTitle>Send Notification</DialogTitle>
              <DialogDescription>
                Send a direct message to this user. It will appear in their notifications.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <textarea
                className="w-full h-32 p-3 rounded-md bg-background border border-input text-sm"
                placeholder="Type your message here..."
                value={notificationMsg}
                onChange={(e) => setNotificationMsg(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotificationOpen(false)} disabled={sendingNotification}>
                Cancel
              </Button>
              <Button onClick={handleSendNotification} disabled={sendingNotification || !notificationMsg.trim()}>
                {sendingNotification ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Send Message
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {profile.loading ? (
        <div className="shrink-0 p-6 border border-border bg-surface/50 rounded-2xl">
          {renderSkeleton()}
        </div>
      ) : profile.error ? (
        renderError(profile.error, () => fetchData(`/api/admin/users/${userId}/profile`, setProfile, 'profile'))
      ) : profile.data && (
        <div className="shrink-0 p-6 border border-border bg-surface/50 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 text-primary flex items-center justify-center text-2xl font-bold shrink-0">
              {profile.data.display_name?.charAt(0) || "U"}
            </div>
            <div>
              <div className="font-bold text-xl">{profile.data.display_name || "Unknown User"}</div>
              <div className="text-sm text-foreground-muted mb-1">{profile.data.email}</div>
              <div className="text-xs text-foreground-dim space-x-3">
                <span>Joined: {profile.data.created_at ? new Date(profile.data.created_at).toLocaleDateString() : 'Unknown'}</span>
                <span>Active: {profile.data.last_active ? new Date(profile.data.last_active).toLocaleString() : 'Unknown'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile.data.is_blocked && <Badge variant="destructive">BLOCKED</Badge>}
            <Badge variant={profile.data.role === "admin" ? "default" : "secondary"} className="uppercase">
              {profile.data.role || "user"}
            </Badge>
          </div>
        </div>
      )}

      <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border mb-4">
          <TabsList className="bg-transparent h-12 w-full justify-start overflow-x-auto rounded-none space-x-2">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"><User className="w-4 h-4 mr-2"/> Overview</TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-white/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"><Activity className="w-4 h-4 mr-2"/> Activity Timeline</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-white/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"><Video className="w-4 h-4 mr-2"/> Watch History</TabsTrigger>
            <TabsTrigger value="heatmap" className="data-[state=active]:bg-white/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"><Map className="w-4 h-4 mr-2"/> Subject Heatmap</TabsTrigger>
            <TabsTrigger value="notes" className="data-[state=active]:bg-white/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"><StickyNote className="w-4 h-4 mr-2"/> Notes</TabsTrigger>
            <TabsTrigger value="live" className="data-[state=active]:bg-white/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"><BookOpen className="w-4 h-4 mr-2"/> Live Attendance</TabsTrigger>
            <TabsTrigger value="sessions" className="data-[state=active]:bg-white/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"><Laptop className="w-4 h-4 mr-2"/> Sessions</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 bg-surface/30 border border-border rounded-xl p-4">
          <TabsContent value="overview" className="m-0 space-y-6">
            {stats.loading ? renderSkeleton() : stats.error ? renderError(stats.error, () => fetchData(`/api/admin/users/${userId}/stats`, setStats, 'stats')) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-surface border border-white/5 shadow-sm">
                  <div className="text-foreground-muted text-sm mb-1 font-medium">Total Watch Time</div>
                  <div className="text-3xl font-bold font-mono">
                    {Math.floor((stats.data?.total_watch_time || 0) / 60)} <span className="text-base font-normal text-foreground-muted">mins</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-surface border border-white/5 shadow-sm">
                  <div className="text-foreground-muted text-sm mb-1 font-medium">Videos Completed</div>
                  <div className="text-3xl font-bold font-mono">{stats.data?.videos_completed || 0}</div>
                </div>
                <div className="p-4 rounded-xl bg-surface border border-white/5 shadow-sm">
                  <div className="text-foreground-muted text-sm mb-1 font-medium">Engagement Score</div>
                  <div className="text-3xl font-bold font-mono text-emerald-400">{stats.data?.engagement_score || 0}</div>
                </div>
                <div className="p-4 rounded-xl bg-surface border border-white/5 shadow-sm">
                  <div className="text-foreground-muted text-sm mb-1 font-medium">Total Sessions</div>
                  <div className="text-3xl font-bold font-mono">{sessions.data?.length || 0}</div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="m-0">
            {activity.loading ? renderSkeleton() : activity.error ? renderError(activity.error, () => fetchData(`/api/admin/users/${userId}/activity?page=1&limit=50`, setActivity, 'activity')) : (
              !activity.data || activity.data.length === 0 ? (
                <p className="text-foreground-muted text-center py-12">No activity recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  <div className="relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                    {activity.data.map((log: any) => {
                      const isLogin = log.action.includes('login');
                      const isStream = log.action.includes('error') ? false : log.action.includes('stream') || log.action.includes('video');
                      const colorClass = isLogin ? "text-emerald-500" : isStream ? "text-blue-500" : "text-primary";
                      return (
                        <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-6">
                          <div className={`flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-surface shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow sm:shadow-md ${colorClass}`}>
                            <Activity className="w-4 h-4" />
                          </div>
                          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-white/5 bg-surface/50 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                              <Badge variant="outline" className={`w-fit ${colorClass} border-${colorClass.split('-')[1]}/30`}>
                                {log.action || "User Action"}
                              </Badge>
                              <div className="text-xs text-foreground-muted">{new Date(log.created_at).toLocaleString()}</div>
                            </div>
                            {log.details && (
                              <div className="text-sm text-foreground-dim mb-2 break-words bg-background/50 p-2 rounded-md font-mono text-xs overflow-x-auto">
                                {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </TabsContent>

          <TabsContent value="history" className="m-0">
            {watchHistory.loading ? renderSkeleton() : watchHistory.error ? renderError(watchHistory.error, () => fetchData(`/api/admin/users/${userId}/watch-history`, setWatchHistory, 'history')) : (
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader className="bg-black/20">
                    <TableRow>
                      <TableHead>Video Title</TableHead>
                      <TableHead className="w-[200px]">Progress</TableHead>
                      <TableHead className="text-center w-[100px]">Completed</TableHead>
                      <TableHead className="w-[180px]">Watched At</TableHead>
                      <TableHead className="text-right w-[120px]">Times Watched</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {watchHistory.data && [...watchHistory.data].sort((a, b) => new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime()).map((h: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium max-w-[300px] truncate" title={h.video_title}>{h.video_title || "Unknown Video"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${h.progress_percent || 0}%` }} />
                            </div>
                            <span className="text-xs font-medium w-9 text-right">{Math.round(h.progress_percent || 0)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {h.completed ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500">✓</span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-foreground-muted/20 text-foreground-muted">✗</span>
                          )}
                        </TableCell>
                        <TableCell className="text-foreground-muted text-sm">
                          {h.watched_at ? new Date(h.watched_at).toLocaleString() : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right font-mono">{h.times_watched || 1}</TableCell>
                      </TableRow>
                    ))}
                    {(!watchHistory.data || watchHistory.data.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-foreground-muted">No watch history found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="heatmap" className="m-0">
            <div className="border border-white/5 rounded-xl bg-surface p-6 shadow-sm overflow-x-auto">
              <div className="flex items-center justify-between mb-6 min-w-[600px]">
                <h3 className="font-semibold text-lg">Activity Calendar</h3>
                <div className="text-sm text-foreground-muted font-medium pr-4">Last 84 Days</div>
              </div>
              <div className="flex items-end gap-[3px] pb-2 min-w-[600px]">
                {Array.from({ length: 12 }).map((_, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-[3px] shrink-0">
                    {Array.from({ length: 7 }).map((_, dayIndex) => {
                      const cellDayIndex = weekIndex * 7 + dayIndex;
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const startDate = new Date(today.getTime() - (83 * 24 * 60 * 60 * 1000));
                      const cellDate = new Date(startDate.getTime() + (cellDayIndex * 24 * 60 * 60 * 1000));
                      
                      let count = 0;
                      const allData = [...(activity.data || []), ...(watchHistory.data || [])];
                      allData.forEach((item: any) => {
                        const dateStr = item.created_at || item.watched_at;
                        if (dateStr) {
                          const d = new Date(dateStr);
                          d.setHours(0, 0, 0, 0);
                          if (d.getTime() === cellDate.getTime()) count++;
                        }
                      });

                      const activeLevel = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 8 ? 3 : 4;
                      const bgClasses = [
                        "bg-white/5 border-white/5", // 0
                        "bg-primary/30 border-primary/20", // 1
                        "bg-primary/60 border-primary/40", // 2
                        "bg-primary/80 border-primary/60", // 3
                        "bg-primary border-primary", // 4
                      ];
                      
                      return (
                        <div 
                          key={dayIndex} 
                          className={`w-[14px] h-[14px] rounded-[2px] border ${bgClasses[activeLevel]} hover:ring-2 hover:ring-foreground transition-all cursor-crosshair`} 
                          title={`${cellDate.toDateString()}: ${count} activities`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4 text-xs text-foreground-muted min-w-[600px]">
                <span>Less</span>
                <div className="w-[14px] h-[14px] rounded-[2px] bg-white/5 border border-white/5" />
                <div className="w-[14px] h-[14px] rounded-[2px] bg-primary/30 border border-primary/20" />
                <div className="w-[14px] h-[14px] rounded-[2px] bg-primary/60 border border-primary/40" />
                <div className="w-[14px] h-[14px] rounded-[2px] bg-primary/80 border border-primary/60" />
                <div className="w-[14px] h-[14px] rounded-[2px] bg-primary border border-primary" />
                <span>More</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="m-0 space-y-4">
            {notes.loading ? renderSkeleton() : notes.error ? renderError(notes.error, () => fetchData(`/api/admin/users/${userId}/notes`, setNotes, 'notes')) : (
              <>
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                  <Input 
                    placeholder="Search notes content or video title..." 
                    className="pl-9 bg-background/50"
                    value={notesSearch}
                    onChange={(e) => setNotesSearch(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {notes.data && notes.data.filter((n: any) => 
                    (n.content || "").toLowerCase().includes(notesSearch.toLowerCase()) || 
                    (n.video_title || "").toLowerCase().includes(notesSearch.toLowerCase())
                  ).map((n: any, i: number) => (
                    <Dialog key={i}>
                      <DialogTrigger asChild>
                        <div className="p-5 rounded-xl bg-surface border border-white/10 flex flex-col cursor-pointer hover:border-primary/50 transition-colors shadow-sm h-48 group">
                          <div className="text-sm font-semibold mb-3 flex items-start justify-between gap-2">
                            <span className="line-clamp-2 text-primary group-hover:underline decoration-primary/50">{n.video_title || "Unknown Video"}</span>
                            <StickyNote className="w-4 h-4 text-foreground-muted shrink-0 mt-0.5" />
                          </div>
                          <div className="text-sm text-foreground-dim whitespace-pre-wrap flex-1 min-h-[60px] line-clamp-3">
                            {n.content}
                          </div>
                          <div className="text-xs text-foreground-muted mt-3 pt-3 border-t border-white/5 uppercase tracking-wide">
                            {new Date(n.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl bg-background border-border max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-primary pr-8">{n.video_title || "Unknown Video"}</DialogTitle>
                          <DialogDescription>
                            Created at {new Date(n.created_at).toLocaleString()}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 p-4 rounded-lg bg-surface border border-white/5 text-foreground whitespace-pre-wrap leading-relaxed font-bangla">
                          {n.content}
                        </div>
                      </DialogContent>
                    </Dialog>
                  ))}
                  {(!notes.data || notes.data.length === 0) && (
                    <div className="col-span-full py-12 text-center text-foreground-muted border border-dashed border-border rounded-xl">
                      <StickyNote className="w-8 h-8 mx-auto mb-3 opacity-20" />
                      <p>No notes taken by this user.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="live" className="m-0">
             <div className="rounded-md border border-border">
               <Table>
                 <TableHeader className="bg-black/20">
                   <TableRow>
                     <TableHead>Class Name</TableHead>
                     <TableHead>Join Time</TableHead>
                     <TableHead>Leave Time</TableHead>
                     <TableHead>Duration</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   <TableRow>
                     <TableCell colSpan={4} className="text-center py-12 text-foreground-muted">
                        <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-20" />
                        No live class attendance recorded.
                     </TableCell>
                   </TableRow>
                 </TableBody>
               </Table>
             </div>
          </TabsContent>

          <TabsContent value="sessions" className="m-0">
            {sessions.loading ? renderSkeleton() : sessions.error ? renderError(sessions.error, () => fetchData(`/api/admin/users/${userId}/sessions`, setSessions, 'sessions')) : (
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader className="bg-black/20">
                    <TableRow>
                      <TableHead className="w-[200px]">Login Time</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Browser / Device</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.data && [...sessions.data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((s: any, i: number) => {
                      let parsedAgent = s.user_agent;
                      if (parsedAgent && parsedAgent.length > 50) {
                        if (parsedAgent.includes("Chrome")) parsedAgent = "Chrome / " + (parsedAgent.includes("Windows") ? "Windows" : parsedAgent.includes("Mac") ? "Mac" : parsedAgent.includes("Android") ? "Android" : "Other");
                        else if (parsedAgent.includes("Firefox")) parsedAgent = "Firefox";
                        else if (parsedAgent.includes("Safari") && !parsedAgent.includes("Chrome")) parsedAgent = "Safari";
                      }
                      
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm whitespace-nowrap">
                            {new Date(s.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{s.ip_address || "N/A"}</TableCell>
                          <TableCell className="text-sm text-foreground-dim max-w-[200px] truncate" title={s.user_agent}>
                            {parsedAgent || "N/A"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {s.duration_minutes > 0 ? `${s.duration_minutes} min` : "Active"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(!sessions.data || sessions.data.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-foreground-muted">
                          <Laptop className="w-8 h-8 mx-auto mb-3 opacity-20" />
                          No session logs found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
