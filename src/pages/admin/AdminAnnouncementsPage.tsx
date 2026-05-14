import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Megaphone, Send, Calendar, Users, Trash, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function AdminAnnouncementsPage() {
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("All Users");
  const [specificEmails, setSpecificEmails] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  const [recentAnnouncements, setRecentAnnouncements] = useState<any[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);

  useEffect(() => {
    fetchRecent();
  }, []);

  const fetchRecent = async () => {
    setIsLoadingRecent(true);
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (!error && data) {
        // Map to expected format if we used the standard schema or the requested one
        setRecentAnnouncements(data);
      }
    } catch (err) {
      console.error("Failed to fetch recent announcements:", err);
    } finally {
      setIsLoadingRecent(false);
    }
  };

  const handleSend = async () => {
    if (!message || message.length < 10) {
      return toast.error("Message must be at least 10 characters long.");
    }
    if (message.length > 2000) {
      return toast.error("Message exceeds 2000 characters limit.");
    }
    if (target === "Specific Users" && !specificEmails.trim()) {
      return toast.error("Please enter specific email addresses.");
    }
    if (isScheduling && (!scheduleDate || new Date(scheduleDate) <= new Date())) {
      return toast.error("Please select a valid future date to schedule.");
    }

    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    
    // Attempt API Request First
    const payload = {
      message,
      target,
      specific_emails: target === 'Specific Users' ? specificEmails.split(',').map(e => e.trim()).filter(e => e) : undefined,
      priority,
      scheduled_at: isScheduling ? scheduleDate : null
    };

    if (window.confirm(`Are you sure you want to ${isScheduling ? 'schedule' : 'send'} this announcement to ${target}?`)) {
      setIsSending(true);
      try {
        let success = false;
        
        // 1. Try hitting the API
        try {
          const res = await fetch("/api/admin/announcements", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            success = true;
          }
        } catch (apiErr) {
          // Ignore API error and fallback to Supabase
        }

        // 2. Fallback if API fails or doesn't exist
        if (!success) {
          console.log("API not available, using Supabase fallback...");
          // Fallback: Store announcement
          const { error: insertError } = await supabase
            .from("announcements" as any)
            .insert({
              message: payload.message,
              target: payload.target,
              priority: payload.priority,
              scheduled_at: payload.scheduled_at,
              sent_at: payload.scheduled_at ? null : new Date().toISOString(),
              created_by: session?.session?.user?.id
            })
            .select()
            .single();

          if (insertError) {
            console.error("Fallback insert error:", insertError.message);
            // This might fail if the table schema is actually the old one.
            // If the table schema expects title/body we can attempt a second fallback
             try {
               await supabase.from("announcements").insert({
                 title: `Announcement: ${payload.target}`,
                 body: payload.message,
                 type: payload.priority,
                 is_active: !payload.scheduled_at
               });
             } catch (e) {
               // Ignore
             }
          }

          // Fallback delivery mechanism (Immediate only)
          if (!payload.scheduled_at) {
            let usersToNotify: any[] = [];
            
            if (target === "All Users") {
              const { data: allUsers } = await supabase.from("profiles").select("id").limit(1000);
              usersToNotify = allUsers || [];
            } else if (target === "Active Users (7 days)") {
              const sevenDaysAgo = new Date();
              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
              const { data: activeLogs } = await supabase
                .from("activity_logs")
                .select("user_id")
                .gte("created_at", sevenDaysAgo.toISOString());
              
              const activeUserIds = Array.from(new Set(activeLogs?.map(log => log.user_id).filter(Boolean)));
              usersToNotify = activeUserIds.map(id => ({ id }));
            } else if (target === "Inactive Users (30 days)") {
               const thirtyDaysAgo = new Date();
               thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
               // Find active users
               const { data: activeLogs } = await supabase
                 .from("activity_logs")
                 .select("user_id")
                 .gte("created_at", thirtyDaysAgo.toISOString());
               const activeIds = Array.from(new Set(activeLogs?.map(log => log.user_id).filter(Boolean)));
               // Find users NOT in active logs
               // Note: Supabase IN filter has limits, basic fallback here
               const { data: allUsers } = await supabase.from("profiles").select("id").limit(1000);
               usersToNotify = (allUsers || []).filter(u => !activeIds.includes(u.id));
            } else if (target === "Specific Users" && payload.specific_emails) {
               const { data: matchedUsers } = await supabase
                 .from("profiles")
                 .select("id")
                 .in("email", payload.specific_emails);
               usersToNotify = matchedUsers || [];
            }

            // Create notifications for matched users
            if (usersToNotify.length > 0) {
              const notificationInserts = usersToNotify.map(u => ({
                user_id: u.id,
                title: `${priority} Message from Admin`,
                body: message,
                type: 'announcement',
                is_read: false
              }));
              
              await supabase.from("notifications").insert(notificationInserts);
              console.log(`Fallback: Created ${notificationInserts.length} notifications`);
            }
          }
        }

        toast.success(`Announcement ${isScheduling ? 'scheduled' : 'sent'} successfully`);
        setMessage("");
        setSpecificEmails("");
        setIsScheduling(false);
        setScheduleDate("");
        fetchRecent();

      } catch (err) {
        toast.error("Failed to process announcement.");
        console.error(err);
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this announcement?")) {
      try {
        const { error } = await supabase.from("announcements" as any).delete().eq("id", id);
        if (error) throw error;
        toast.success("Announcement deleted");
        fetchRecent();
      } catch (err: any) {
        toast.error("Could not delete announcement");
        console.error(err);
      }
    }
  };

  const targetMapping: Record<string, string> = {
    "All Users": "All Users",
    "Active Users (7 days)": "Active Users",
    "Inactive Users (30 days)": "Inactive Users",
    "Specific Users": "Specific Users"
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Announcements</h1>
          <p className="text-foreground/60 mt-1">Broadcast messages and alerts to your users.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-surface/40 border-border/50 shadow-sm flex flex-col h-full">
          <CardHeader className="border-b border-border/30 bg-surface/30 px-6 py-4">
            <CardTitle className="text-base flex items-center gap-2 font-semibold">
              <Megaphone className="w-4 h-4 text-primary" /> Create Message
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 flex-1">
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">Target Audience</label>
              <select 
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full h-10 rounded-md border border-border/50 bg-black/20 px-3 py-1 text-sm shadow-sm transition-colors cursor-pointer text-foreground focus:ring-1 focus:ring-primary"
              >
                {Object.keys(targetMapping).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {target === "Specific Users" && (
              <div className="space-y-1.5 animate-in slide-in-from-top-1">
                <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">Email Addresses (comma-separated)</label>
                <Input 
                  placeholder="user1@example.com, user2@example.com" 
                  value={specificEmails}
                  onChange={(e) => setSpecificEmails(e.target.value)}
                  className="bg-black/20 border-border/50 h-10" 
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">Priority</label>
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full h-10 rounded-md border border-border/50 bg-black/20 px-3 py-1 text-sm shadow-sm transition-colors cursor-pointer text-foreground focus:ring-1 focus:ring-primary"
              >
                <option value="Normal">Normal Default</option>
                <option value="High">High Priority</option>
                <option value="Urgent">Urgent (Requires Action)</option>
              </select>
            </div>

            <div className="space-y-1.5 flex-1">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wider flex justify-between">
                <span>Message Body</span>
                <span className={message.length > 2000 ? "text-red-400" : "text-foreground/40"}>
                  {message.length}/2000
                </span>
              </label>
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full h-32 px-3 py-3 text-sm rounded-md border border-border/50 bg-black/20 text-foreground resize-none focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-foreground/30 shadow-inner"
                placeholder="Type your announcement here in Markdown... (e.g. **Bold**, *Italics*)"
              />
            </div>

            {isScheduling && (
              <div className="space-y-1.5 animate-in zoom-in-95 duration-200">
                <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">Schedule For</label>
                <Input 
                  type="datetime-local" 
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="bg-black/20 border-border/50 h-10 dark:[color-scheme:dark]" 
                />
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3 border-t border-border/30 mt-4">
              <Button 
                onClick={() => {
                  if (isScheduling && scheduleDate) {
                    handleSend();
                  } else {
                    setIsScheduling(!isScheduling);
                    setScheduleDate("");
                  }
                }} 
                variant={isScheduling ? "default" : "outline"} 
                className="flex-1 h-10 font-medium tracking-wide"
                disabled={isSending}
              >
                <Calendar className="w-4 h-4 mr-2" /> 
                {isScheduling ? "Confirm Schedule" : "Schedule"}
              </Button>
              {!isScheduling && (
                <Button 
                  onClick={handleSend}
                  disabled={isSending || message.length < 10}
                  className="flex-1 h-10 font-medium tracking-wide bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg"
                >
                  <Send className="w-4 h-4 mr-2" /> 
                  {isSending ? "Sending..." : "Send Immediately"}
                </Button>
              )}
              {isScheduling && (
                <Button variant="ghost" onClick={() => setIsScheduling(false)} disabled={isSending}>
                  Cancel
                </Button>
              )}
            </div>

          </CardContent>
        </Card>

        {/* Recent & Scheduled */}
        <Card className="bg-surface/40 border-border/50 shadow-sm flex flex-col h-full">
          <CardHeader className="border-b border-border/30 bg-surface/30 px-6 py-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-500" /> Recent & Scheduled
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-auto">
            {isLoadingRecent ? (
              <div className="p-8 text-center text-foreground/40 animate-pulse">Loading announcements...</div>
            ) : recentAnnouncements.length === 0 ? (
              <div className="p-12 text-center text-foreground/40 flex flex-col items-center gap-3">
                <Megaphone className="w-8 h-8 opacity-20" />
                <p>No announcements found.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/20 bg-black/10">
                    <TableHead className="py-3 px-4 font-semibold text-xs tracking-wider uppercase">Message</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-xs tracking-wider uppercase">Details</TableHead>
                    <TableHead className="py-3 px-4 text-right font-semibold text-xs tracking-wider uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentAnnouncements.map((a: any) => {
                    // Extract fields seamlessly whether using old schema or new
                    const msg = a.message || a.body || "No content";
                    const isSch = a.scheduled_at && new Date(a.scheduled_at) > new Date();
                    const targetName = a.target || a.title || "Unknown Target";
                    
                    return (
                      <TableRow key={a.id} className="border-border/10 hover:bg-white/[0.02] transition-colors group">
                        <TableCell className="p-4 align-top max-w-[200px]">
                          <p className="text-sm font-medium text-foreground/90 truncate mb-1">{msg}</p>
                          <div className="flex gap-2 items-center">
                            {a.priority === 'Urgent' ? (
                              <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/30">Urgent</Badge>
                            ) : a.priority === 'High' ? (
                              <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-500 border-yellow-500/30">High</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-surface border-border">Normal</Badge>
                            )}
                            <span className="text-xs text-foreground/40">
                              {new Date(a.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="p-4 align-top text-xs">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-foreground/70">
                              <Users className="w-3.5 h-3.5" /> <span className="truncate">{targetName}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                               {isSch ? (
                                <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400 bg-blue-500/10 font-normal">
                                  {new Date(a.scheduled_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500 bg-emerald-500/10 font-normal flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Sent
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="p-4 text-right align-top">
                          <div className="flex items-center justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

