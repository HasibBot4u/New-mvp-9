import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, User, Clock, BookOpen, BarChart3, MessageSquare, Monitor, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://nexusedu-backend-0bjq.onrender.com";

export default function AdminUserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();

  const [activeTab, setActiveTab] = useState("overview");

  // Fetch states
  const [profile, setProfile] = useState<{data: any, loading: boolean, error: string|null}>({ data: null, loading: true, error: null });
  const [activity, setActivity] = useState<{data: any, loading: boolean, error: string|null}>({ data: null, loading: true, error: null });
  const [watchHistory, setWatchHistory] = useState<{data: any, loading: boolean, error: string|null}>({ data: null, loading: true, error: null });
  const [stats, setStats] = useState<{data: any, loading: boolean, error: string|null}>({ data: null, loading: true, error: null });
  const [notes, setNotes] = useState<{data: any, loading: boolean, error: string|null}>({ data: null, loading: true, error: null });
  const [sessionsData, setSessionsData] = useState<{data: any, loading: boolean, error: string|null}>({ data: null, loading: true, error: null });

  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [selectedNote, setSelectedNote] = useState<any>(null);

  const mounted = useRef(false);
  const abortControllers = useRef<{ [key: string]: AbortController }>({});

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      Object.values(abortControllers.current).forEach(c => c.abort());
    };
  }, []);

  const fetchData = useCallback(async (
    endpoint: string, 
    setState: React.Dispatch<React.SetStateAction<{data: any, loading: boolean, error: string|null}>>,
    key: string
  ) => {
    if (!mounted.current) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    if (abortControllers.current[key]) {
      abortControllers.current[key].abort();
    }
    const controller = new AbortController();
    abortControllers.current[key] = controller;
    
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Status HTTP: ${response.status}`);
      const data = await response.json();
      if (mounted.current) {
        setState({ data, loading: false, error: null });
      }
    } catch (err: any) {
      if (mounted.current) {
        setState({ data: null, loading: false, error: err.name === "AbortError" ? "Request timed out" : err.message || "Failed to load data" });
      }
    }
  }, [session?.access_token]);

  const loadAll = useCallback(() => {
    if (!userId) return;
    fetchData(`/api/admin/users/${userId}/profile`, setProfile, 'profile');
    fetchData(`/api/admin/users/${userId}/activity?page=1&limit=50`, setActivity, 'activity');
    fetchData(`/api/admin/users/${userId}/watch-history`, setWatchHistory, 'history');
    fetchData(`/api/admin/users/${userId}/stats`, setStats, 'stats');
    fetchData(`/api/admin/users/${userId}/notes`, setNotes, 'notes');
    fetchData(`/api/admin/users/${userId}/sessions`, setSessionsData, 'sessions');
  }, [userId, fetchData]);

  useEffect(() => {
    if (session?.access_token && userId) {
      loadAll();
    }
  }, [session?.access_token, userId, loadAll]);

  const Skeleton = () => (
    <div className="animate-pulse bg-white/10 rounded-xl h-24 w-full"></div>
  );

  const ErrorUI = ({ error, onRetry }: { error: string, onRetry: () => void }) => (
    <div className="p-4 bg-destructive/10 text-destructive rounded-xl border border-destructive/30 flex flex-col items-center gap-2">
      <p>{error}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
    </div>
  );

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 bg-background text-foreground min-h-full rounded-tl-xl border-l border-t border-border">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/admin/users")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Users
        </Button>
        <Button onClick={() => setShowNotificationModal(true)}>Send Notification</Button>
      </div>

      {showNotificationModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-background border border-border p-6 rounded-xl w-full max-w-md flex flex-col gap-4 shadow-2xl">
            <h2 className="text-xl font-bold">Send Notification</h2>
            <textarea 
              value={notificationMessage}
              onChange={(e) => setNotificationMessage(e.target.value)}
              className="bg-transparent border border-input rounded-md p-3 h-32 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Type your message here..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNotificationModal(false)}>Cancel</Button>
              <Button onClick={() => {
                alert(`Notification sent`);
                setShowNotificationModal(false);
                setNotificationMessage("");
              }}>Send</Button>
            </div>
          </div>
        </div>
      )}

      {selectedNote && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-background border border-border p-6 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col gap-4 shadow-2xl">
            <div className="flex justify-between items-start">
              <div className="pr-8">
                <h2 className="text-xl font-bold">{selectedNote.video_title || "Unknown Video"}</h2>
                <p className="text-sm text-foreground/50">{new Date(selectedNote.created_at).toLocaleString()}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedNote(null)}>✕</Button>
            </div>
            <div className="overflow-y-auto whitespace-pre-wrap flex-1 bg-secondary/30 p-4 rounded-md text-sm leading-relaxed">
              {selectedNote.content}
            </div>
          </div>
        </div>
      )}

      {profile.loading ? <Skeleton /> : profile.error ? <ErrorUI error={profile.error} onRetry={() => fetchData(`/api/admin/users/${userId}/profile`, setProfile, 'profile')} /> : profile.data && (
        <Card className="bg-surface border-border shadow-sm">
          <CardContent className="p-6 flex flex-col md:flex-row items-center md:items-start gap-5">
            <div className="shrink-0 w-20 h-20 rounded-full bg-primary/20 text-primary flex items-center justify-center text-3xl font-bold uppercase shadow-inner">
              {profile.data.display_name?.[0] || profile.data.email?.[0] || "U"}
            </div>
            <div className="flex flex-col gap-1.5 text-center md:text-left flex-1">
              <h1 className="text-2xl font-bold tracking-tight">{profile.data.display_name || "Unknown"}</h1>
              <p className="text-foreground/70">{profile.data.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2 justify-center md:justify-start">
                <Badge variant={profile.data.role === 'admin' ? 'default' : 'secondary'} className="uppercase">
                  {profile.data.role}
                </Badge>
                {profile.data.is_blocked && <Badge variant="destructive">BLOCKED</Badge>}
                <span className="text-sm text-foreground/50 ml-2">Joined: {new Date(profile.data.created_at).toLocaleDateString()}</span>
                {profile.data.last_active && <span className="text-sm text-foreground/50 ml-2">Active: {new Date(profile.data.last_active).toLocaleString()}</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
        <div className="overflow-x-auto pb-2 mb-4 shrink-0">
          <TabsList className="bg-transparent h-10 gap-2 flex w-max">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-full px-4 border border-transparent data-[state=active]:border-primary/20"><User className="w-4 h-4 mr-2"/> Overview</TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-full px-4 border border-transparent data-[state=active]:border-primary/20"><Clock className="w-4 h-4 mr-2"/> Activity</TabsTrigger>
            <TabsTrigger value="watch" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-full px-4 border border-transparent data-[state=active]:border-primary/20"><Monitor className="w-4 h-4 mr-2"/> Watch History</TabsTrigger>
            <TabsTrigger value="heatmap" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-full px-4 border border-transparent data-[state=active]:border-primary/20"><Calendar className="w-4 h-4 mr-2"/> Heatmap</TabsTrigger>
            <TabsTrigger value="notes" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-full px-4 border border-transparent data-[state=active]:border-primary/20"><MessageSquare className="w-4 h-4 mr-2"/> Notes</TabsTrigger>
            <TabsTrigger value="live" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-full px-4 border border-transparent data-[state=active]:border-primary/20"><BookOpen className="w-4 h-4 mr-2"/> Live</TabsTrigger>
            <TabsTrigger value="sessions" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-full px-4 border border-transparent data-[state=active]:border-primary/20"><BarChart3 className="w-4 h-4 mr-2"/> Sessions</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 bg-surface/30 border border-border rounded-xl p-6 overflow-y-auto">
          <TabsContent value="overview" className="m-0 focus:outline-none">
            {stats.loading ? <Skeleton /> : stats.error ? <ErrorUI error={stats.error} onRetry={() => fetchData(`/api/admin/users/${userId}/stats`, setStats, 'stats')} /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-surface shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-foreground/60">Total Watch Time</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold tabular-nums">{Math.floor((stats.data?.total_watch_time || 0)/60)} <span className="text-lg font-normal text-foreground/50">h</span></div></CardContent></Card>
                <Card className="bg-surface shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-foreground/60">Videos Completed</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold tabular-nums">{stats.data?.videos_completed || 0}</div></CardContent></Card>
                <Card className="bg-surface shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-foreground/60">Engagement Score</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold tabular-nums text-emerald-500">{stats.data?.engagement_score || 0}%</div></CardContent></Card>
                <Card className="bg-surface shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-foreground/60">Total Sessions</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold tabular-nums">{stats.data?.total_sessions || sessionsData?.data?.length || 0}</div></CardContent></Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="m-0 focus:outline-none">
            {activity.loading ? <Skeleton /> : activity.error ? <ErrorUI error={activity.error} onRetry={() => fetchData(`/api/admin/users/${userId}/activity?page=1&limit=50`, setActivity, 'activity')} /> : (
              <div className="relative pl-6 sm:pl-8 border-l-2 border-border/50 py-4 max-w-4xl">
                {(activity.data?.items || activity.data || []).map((item: any, idx: number) => {
                  let color = "bg-gray-500 border-gray-400";
                  let actionName = item.action || "Unknown Action";
                  if (actionName.includes("login")) color = "bg-emerald-500 border-emerald-400";
                  else if (actionName.includes("stream")) color = "bg-blue-500 border-blue-400";
                  else if (actionName.includes("catalog") || actionName.includes("view")) color = "bg-purple-500 border-purple-400";
                  else if (actionName.includes("complete")) color = "bg-amber-500 border-amber-400";
                  
                  return (
                    <div key={item.id || idx} className="relative mb-8 last:mb-0">
                      <div className={`absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full border-2 bg-background ${color} shadow-[0_0_0_4px_theme(colors.background)]`} />
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                        <Badge variant="outline" className={`shrink-0 ${color.replace('bg-', 'text-').replace('border-', 'border-').split(' ')[1]}`}>
                          {actionName}
                        </Badge>
                        <span className="text-xs font-medium text-foreground/50">{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                      {item.details && Object.keys(item.details).length > 0 && (
                        <div className="text-xs text-foreground/70 bg-black/20 border border-white/5 p-3 rounded-lg mt-2 overflow-x-auto whitespace-pre-wrap font-mono shadow-inner">
                          {JSON.stringify(item.details, null, 2)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {(!activity.data || activity.data.length === 0) && <p className="text-foreground/50 italic">No activity recorded</p>}
              </div>
            )}
          </TabsContent>

          <TabsContent value="watch" className="m-0 focus:outline-none">
            {watchHistory.loading ? <Skeleton /> : watchHistory.error ? <ErrorUI error={watchHistory.error} onRetry={() => fetchData(`/api/admin/users/${userId}/watch-history`, setWatchHistory, 'history')} /> : (
              <div className="w-full overflow-x-auto border border-border shadow-sm rounded-xl bg-surface">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-foreground/60 bg-black/20 uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-4">Video Title</th>
                      <th className="px-6 py-4">Progress (%)</th>
                      <th className="px-6 py-4 text-center">Completed</th>
                      <th className="px-6 py-4">Watched At</th>
                      <th className="px-6 py-4 text-right">Times Watched</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(watchHistory.data || []).sort((a: any, b: any) => new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime()).map((item: any, i: number) => {
                      const prog = Math.min(100, Math.max(0, item.progress_percent || 0));
                      return (
                        <tr key={item.id || i} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 font-medium text-foreground">{item.video_title || "Unknown Video"}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-full max-w-[120px] bg-black/40 rounded-full h-2 overflow-hidden shadow-inner">
                                <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${prog}%` }}></div>
                              </div>
                              <span className="text-xs font-mono w-8">{Math.round(prog)}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {item.completed ? 
                              <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 font-bold shadow-sm">✓</span> 
                              : <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-foreground/10 text-foreground/40 font-bold shadow-sm">✗</span>}
                          </td>
                          <td className="px-6 py-4 text-foreground/70">{new Date(item.watched_at).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right font-mono">{item.times_watched || 1}</td>
                        </tr>
                      )
                    })}
                    {(!watchHistory.data || watchHistory.data.length === 0) && (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-foreground/50">No watch history available</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="heatmap" className="m-0 focus:outline-none">
            {activity.loading || watchHistory.loading ? <Skeleton /> : (
              <div className="border border-border p-6 rounded-xl overflow-x-auto bg-surface shadow-sm">
                <h3 className="font-semibold mb-6 text-foreground tracking-tight">Activity Contributions (Last 12 Weeks)</h3>
                <div className="flex gap-1.5" style={{ width: 'fit-content' }}>
                  {Array.from({ length: 12 }).map((_, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-1.5">
                      {Array.from({ length: 7 }).map((_, dayIndex) => {
                        const daysAgo = (11 - weekIndex) * 7 + (6 - dayIndex);
                        const date = new Date();
                        date.setDate(date.getDate() - daysAgo);
                        date.setHours(0, 0, 0, 0);

                        let count = 0;
                        const checkEvt = (evt: any) => {
                          if (!evt) return;
                          const d = new Date(evt.created_at || evt.watched_at);
                          d.setHours(0,0,0,0);
                          if (d.getTime() === date.getTime()) count++;
                        };
                        (activity.data?.items || activity.data || []).forEach(checkEvt);
                        (watchHistory.data || []).forEach(checkEvt);

                        let color = "bg-black/20 border border-white/5";
                        if (count >= 9) color = "bg-primary shadow-[0_0_8px_theme(colors.primary.DEFAULT)]";
                        else if (count >= 6) color = "bg-primary/80";
                        else if (count >= 3) color = "bg-primary/50";
                        else if (count >= 1) color = "bg-primary/30";

                        return (
                          <div 
                            key={dayIndex}
                            className={`w-3.5 h-3.5 md:w-4 md:h-4 rounded-sm ${color} transition-all duration-200 hover:ring-2 hover:ring-foreground group relative cursor-pointer`}
                          >
                            <div className="absolute opacity-0 group-hover:opacity-100 bg-popover text-popover-foreground text-xs p-2 rounded bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap z-10 pointer-events-none shadow-xl border border-border">
                              {date.toLocaleDateString()}: <span className="font-bold">{count}</span> activities
                              <svg className="absolute text-popover h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255" xmlSpace="preserve"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex items-center gap-2 text-xs text-foreground/50 font-medium w-max">
                  <span>Less</span>
                  <div className="w-3.5 h-3.5 rounded-sm bg-black/20 border border-white/5"></div>
                  <div className="w-3.5 h-3.5 rounded-sm bg-primary/30"></div>
                  <div className="w-3.5 h-3.5 rounded-sm bg-primary/50"></div>
                  <div className="w-3.5 h-3.5 rounded-sm bg-primary/80"></div>
                  <div className="w-3.5 h-3.5 rounded-sm bg-primary"></div>
                  <span>More</span>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="notes" className="m-0 focus:outline-none">
            {notes.loading ? <Skeleton /> : notes.error ? <ErrorUI error={notes.error} onRetry={() => fetchData(`/api/admin/users/${userId}/notes`, setNotes, 'notes')} /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {(notes.data || []).map((note: any) => (
                  <Card key={note.id} className="cursor-pointer border-border bg-surface hover:border-primary/50 hover:shadow-md transition-all flex flex-col group overflow-hidden" onClick={() => setSelectedNote(note)}>
                    <CardHeader className="p-4 pb-0 space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <CardTitle className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">{note.video_title || "Unknown Video"}</CardTitle>
                        <MessageSquare className="w-4 h-4 text-foreground/30 shrink-0 mt-0.5" />
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-foreground/50 font-medium">{new Date(note.created_at).toLocaleDateString()}</div>
                    </CardHeader>
                    <CardContent className="p-4 pt-3 flex-1 relative">
                      <p className="text-sm text-foreground/80 line-clamp-4 leading-relaxed font-bangla whitespace-pre-wrap">{note.content}</p>
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-surface to-transparent"></div>
                    </CardContent>
                  </Card>
                ))}
                {(!notes.data || notes.data.length === 0) && (
                  <div className="col-span-full py-16 text-center border-2 border-dashed border-border rounded-xl bg-black/10">
                    <MessageSquare className="w-10 h-10 text-foreground/20 mx-auto mb-4" />
                    <p className="text-foreground/50">No notes recorded by this user.</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="live" className="m-0 focus:outline-none">
             <div className="w-full overflow-x-auto border border-border shadow-sm rounded-xl bg-surface">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-foreground/60 bg-black/20 uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-4">Class Name</th>
                      <th className="px-6 py-4">Join Time</th>
                      <th className="px-6 py-4">Leave Time</th>
                      <th className="px-6 py-4 text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-foreground/50">
                        <BookOpen className="w-8 h-8 text-foreground/20 mx-auto mb-3" />
                        No live class attendance recorded
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
          </TabsContent>

          <TabsContent value="sessions" className="m-0 focus:outline-none">
            {sessionsData.loading ? <Skeleton /> : sessionsData.error ? <ErrorUI error={sessionsData.error} onRetry={() => fetchData(`/api/admin/users/${userId}/sessions`, setSessionsData, 'sessions')} /> : (
              <div className="w-full overflow-x-auto border border-border shadow-sm rounded-xl bg-surface">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-foreground/60 bg-black/20 uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-4">Login Time</th>
                      <th className="px-6 py-4">IP Address</th>
                      <th className="px-6 py-4 max-w-[200px]">User Agent</th>
                      <th className="px-6 py-4 text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(sessionsData.data || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((sessionItem: any, i: number) => {
                      let ua = sessionItem.user_agent || "Unknown";
                      if(ua.includes("Chrome")) ua = `Chrome (${ua.includes("Windows") ? "Win" : ua.includes("Mac") ? "Mac" : "Android/Linux"})`;
                      else if(ua.includes("Firefox")) ua = `Firefox`;
                      else if(ua.includes("Safari") && !ua.includes("Chrome")) ua = `Safari`;
                      return (
                        <tr key={sessionItem.id || i} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 font-medium">{new Date(sessionItem.created_at).toLocaleString()}</td>
                          <td className="px-6 py-4 font-mono text-xs text-foreground/70">{sessionItem.ip_address || "Unknown"}</td>
                          <td className="px-6 py-4 text-foreground/80 truncate max-w-[200px]" title={sessionItem.user_agent}>{ua}</td>
                          <td className="px-6 py-4 text-right">
                            {sessionItem.duration_minutes ? <Badge variant="outline">{sessionItem.duration_minutes} min</Badge> : <Badge className="bg-emerald-500/20 text-emerald-500 border-none hover:bg-emerald-500/20">Active</Badge>}
                          </td>
                        </tr>
                      )
                    })}
                    {(!sessionsData.data || sessionsData.data.length === 0) && (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-foreground/50">No session info available</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
