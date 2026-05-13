import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Activity, User, BookOpen, Map, StickyNote, Video, Laptop, ArrowLeft } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export default function AdminUserDetailPage() {
  const { userId } = useParams();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [watchHistory, setWatchHistory] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [notesSearch, setNotesSearch] = useState("");

  useEffect(() => {
    if (!userId) return;
    let active = true;

    async function loadData() {
      setLoading(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) return;

        const headers = { "Authorization": token };
        const baseUrl = import.meta.env.VITE_API_BASE_URL || "";

        const [pRes, sRes, aRes, wRes, nRes, sessRes] = await Promise.all([
          fetch(`${baseUrl}/api/admin/users/${userId}/profile`, { headers }),
          fetch(`${baseUrl}/api/admin/users/${userId}/stats`, { headers }),
          fetch(`${baseUrl}/api/admin/users/${userId}/activity?limit=50`, { headers }),
          fetch(`${baseUrl}/api/admin/users/${userId}/watch-history`, { headers }),
          fetch(`${baseUrl}/api/admin/users/${userId}/notes`, { headers }),
          fetch(`${baseUrl}/api/admin/users/${userId}/sessions`, { headers })
        ]);

        if (active) {
          if (pRes.ok) setProfile(await pRes.json());
          if (sRes.ok) setStats(await sRes.json());
          if (aRes.ok) setActivityLogs(await aRes.json());
          if (wRes.ok) setWatchHistory(await wRes.json());
          if (nRes.ok) setNotes(await nRes.json());
          if (sessRes.ok) setSessions(await sessRes.json());
        }

      } catch (err) {
        console.error("Failed to load user details", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => { active = false; };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-xl font-bold mb-4">User not found</h2>
        <Button asChild variant="outline">
          <Link to="/admin/users">Back to Users</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden gap-4 -m-4 sm:-m-8 p-4 sm:p-8 pt-0">
      <div className="shrink-0 flex items-center gap-4 mb-2">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <Link to="/admin/users"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">User Details</h1>
      </div>

      <div className="shrink-0 p-6 border border-border bg-surface/50 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xl font-bold">
            {profile?.display_name?.charAt(0) || "U"}
          </div>
          <div>
            <div className="font-bold text-lg">{profile?.display_name || "Unknown User"}</div>
            <div className="text-sm font-normal text-foreground-muted">{profile?.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {profile?.is_blocked && <Badge variant="destructive">BLOCKED</Badge>}
          <Badge variant={profile?.role === "admin" ? "default" : "secondary"} className="uppercase">
            {profile?.role || "user"}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="profile" className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border mb-4">
          <TabsList className="bg-transparent h-12 w-full justify-start overflow-x-auto rounded-none space-x-2">
            <TabsTrigger value="profile" className="data-[state=active]:bg-white/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"><User className="w-4 h-4 mr-2"/> Overview</TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-white/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"><Activity className="w-4 h-4 mr-2"/> Activity Timeline</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-white/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"><Video className="w-4 h-4 mr-2"/> Watch History</TabsTrigger>
            <TabsTrigger value="heatmap" className="data-[state=active]:bg-white/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"><Map className="w-4 h-4 mr-2"/> Subject Heatmap</TabsTrigger>
            <TabsTrigger value="notes" className="data-[state=active]:bg-white/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"><StickyNote className="w-4 h-4 mr-2"/> Notes & Bookmarks</TabsTrigger>
            <TabsTrigger value="live" className="data-[state=active]:bg-white/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"><BookOpen className="w-4 h-4 mr-2"/> Live Attendance</TabsTrigger>
            <TabsTrigger value="sessions" className="data-[state=active]:bg-white/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"><Laptop className="w-4 h-4 mr-2"/> Sessions</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 bg-surface/30 border border-border rounded-xl p-4">
          <TabsContent value="profile" className="m-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-surface border border-white/5">
                 <div className="text-foreground-muted text-sm mb-1">Total Watch Time</div>
                 <div className="text-2xl font-bold font-mono">
                    {Math.floor((stats?.total_watch_time || 0) / 60)} <span className="text-sm font-normal">mins</span>
                 </div>
              </div>
              <div className="p-4 rounded-xl bg-surface border border-white/5">
                 <div className="text-foreground-muted text-sm mb-1">Videos Started</div>
                 <div className="text-2xl font-bold font-mono">{stats?.total_videos_enrolled || 0}</div>
              </div>
              <div className="p-4 rounded-xl bg-surface border border-white/5">
                 <div className="text-foreground-muted text-sm mb-1">Videos Completed</div>
                 <div className="text-2xl font-bold font-mono">{stats?.videos_completed || 0}</div>
              </div>
              <div className="p-4 rounded-xl bg-surface border border-white/5">
                 <div className="text-foreground-muted text-sm mb-1">Engagement Score</div>
                 <div className="text-2xl font-bold font-mono text-emerald-400">{stats?.engagement_score || 0}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-surface border border-white/5">
                <h3 className="font-semibold mb-4">Account Details</h3>
                <div className="grid grid-cols-2 gap-y-4 text-sm">
                  <div className="text-foreground-muted">Name</div><div>{profile?.display_name || "N/A"}</div>
                  <div className="text-foreground-muted">Email</div><div>{profile?.email || "N/A"}</div>
                  <div className="text-foreground-muted">Phone</div><div>{profile?.phone || "N/A"}</div>
                  <div className="text-foreground-muted">Joined</div><div>{profile?.created_at ? new Date(profile.created_at).toLocaleString() : 'N/A'}</div>
                  <div className="text-foreground-muted">Last Active</div><div>{profile?.last_active ? new Date(profile.last_active).toLocaleString() : 'N/A'}</div>
                </div>
              </div>
              <div className="p-6 rounded-xl bg-surface border border-white/5">
                <h3 className="font-semibold mb-4">Recent Activity</h3>
                <div className="space-y-4">
                  {activityLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="text-sm">
                      <span className="text-foreground-muted text-xs mr-2">{new Date(log.created_at).toLocaleDateString()}</span>
                      <span className="font-medium">{log.action}</span>
                    </div>
                  ))}
                  {activityLogs.length === 0 && <span className="text-sm text-foreground-muted">No activity found.</span>}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="m-0">
            {activityLogs.length === 0 ? (
              <p className="text-foreground-muted text-center py-12">No activity recorded yet.</p>
            ) : (
              <div className="space-y-4">
                <div className="relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  {activityLogs.slice(0, 50).map((log) => (
                     <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-4">
                       <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-surface shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow sm:shadow-md">
                          <Activity className="w-4 h-4 text-primary" />
                       </div>
                       <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-white/5 bg-surface/50 shadow">
                         <div className="flex items-center justify-between space-x-2 mb-1">
                           <div className="font-bold text-sm text-foreground">{log.action || "User Action"}</div>
                           <div className="text-xs text-foreground-muted">{new Date(log.created_at).toLocaleString()}</div>
                         </div>
                         {log.details && (
                           <div className="text-xs text-foreground-dim mb-2 max-w-full break-words">
                             {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                           </div>
                         )}
                         <div className="text-[10px] text-foreground-muted flex gap-3">
                           {log.ip_address && <span>IP: {log.ip_address}</span>}
                           {log.user_agent && <span className="truncate max-w-[150px]">Client: {log.user_agent}</span>}
                         </div>
                       </div>
                     </div>
                  ))}
                </div>
                <div className="flex justify-center mt-4">
                  <Button variant="outline" size="sm">Load More (Pagination demo)</Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="m-0">
            <Table>
              <TableHeader className="bg-black/20">
                <TableRow>
                  <TableHead>Video</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Times Watched</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Watched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {watchHistory.map((h, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{h.video_title || "Unknown"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden min-w-[50px]">
                           <div className="h-full bg-primary" style={{ width: `${h.progress_percent || 0}%` }} />
                        </div>
                        <span className="text-xs">{h.progress_percent || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{h.times_watched}</TableCell>
                    <TableCell>
                      <Badge variant={h.completed ? "default" : "secondary"}>
                        {h.completed ? "Completed" : "In Progress"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground-muted text-xs">
                      {h.watched_at ? new Date(h.watched_at).toLocaleString() : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
                {watchHistory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-foreground-muted">No watch history found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="heatmap" className="m-0">
             <div className="border border-white/5 rounded-xl bg-surface p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold">Subject Consistency Heatmap</h3>
                  <div className="text-sm text-foreground-muted">Last 3 Months</div>
                </div>
                <div className="flex items-end gap-2 overflow-x-auto pb-4">
                  {/* Generate 12 weeks of data visually */}
                  {Array.from({ length: 12 }).map((_, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-1 shrink-0">
                      {Array.from({ length: 7 }).map((_, dayIndex) => {
                        // Randomize activity for visual representation
                        const activeLevel = Math.floor(Math.random() * 5); 
                        const bgClasses = [
                          "bg-white/5", // 0
                          "bg-primary/30", // 1
                          "bg-primary/50", // 2
                          "bg-primary/80", // 3
                          "bg-primary", // 4
                        ];
                        return (
                          <div 
                            key={dayIndex} 
                            className={`w-4 h-4 rounded-sm ${bgClasses[activeLevel]} transition-colors hover:ring-1 hover:ring-primary`} 
                            title={`${activeLevel * 15} mins studied`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-2 mt-4 text-xs text-foreground-muted">
                  <span>Less</span>
                  <div className="w-3 h-3 rounded-sm bg-white/5" />
                  <div className="w-3 h-3 rounded-sm bg-primary/30" />
                  <div className="w-3 h-3 rounded-sm bg-primary/50" />
                  <div className="w-3 h-3 rounded-sm bg-primary/80" />
                  <div className="w-3 h-3 rounded-sm bg-primary" />
                  <span>More</span>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="notes" className="m-0 space-y-4">
            <div className="flex items-center gap-2 max-w-sm">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                <Input 
                  placeholder="Search notes..." 
                  className="pl-9 bg-background/50 border-white/10"
                  value={notesSearch}
                  onChange={(e) => setNotesSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {notes.filter(n => 
                 (n.content || "").toLowerCase().includes(notesSearch.toLowerCase()) || 
                 (n.video_title || "").toLowerCase().includes(notesSearch.toLowerCase())
              ).map((n, i) => (
                 <div key={i} className="p-5 rounded-xl bg-surface border border-white/5 flex flex-col">
                   <div className="text-sm font-semibold mb-2 flex items-center justify-between">
                     <span className="truncate pr-4 text-primary">{n.video_title || "Unknown Video"}</span>
                     <StickyNote className="w-4 h-4 text-foreground-muted shrink-0" />
                   </div>
                   <div className="text-sm text-foreground-dim whitespace-pre-wrap flex-1 min-h-[60px]">{n.content}</div>
                   <div className="text-xs text-foreground-muted mt-4 border-t border-white/5 pt-3">
                     Added: {new Date(n.created_at).toLocaleString()}
                   </div>
                 </div>
              ))}
              {notes.length === 0 && <p className="col-span-full text-foreground-muted text-center py-12">No notes taken.</p>}
            </div>
          </TabsContent>

          <TabsContent value="live" className="m-0">
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
                   <TableCell colSpan={4} className="text-center py-8 text-foreground-muted">No live class attendance records found.</TableCell>
                 </TableRow>
               </TableBody>
             </Table>
          </TabsContent>

          <TabsContent value="sessions" className="m-0">
            <Table>
              <TableHeader className="bg-black/20">
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Device / Browser</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-xs whitespace-nowrap">{new Date(s.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs font-mono">{s.ip_address || "N/A"}</TableCell>
                    <TableCell className="text-xs text-foreground-dim max-w-[200px] truncate" title={s.user_agent}>{s.user_agent || "N/A"}</TableCell>
                    <TableCell className="text-xs">
                      {s.duration_minutes > 0 ? `${s.duration_minutes}m` : "Active / Unknown"}
                    </TableCell>
                  </TableRow>
                ))}
                {sessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-foreground-muted">No session logs found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
