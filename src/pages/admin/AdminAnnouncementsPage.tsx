import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Megaphone, Send, Users, Trash, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch, API_BASE } from "@/lib/api";

export default function AdminAnnouncementsPage() {
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all");
  const [specificEmails, setSpecificEmails] = useState("");
  const [priority, setPriority] = useState("normal");
  const [isSending, setIsSending] = useState(false);
  
  const [recentAnnouncements, setRecentAnnouncements] = useState<any[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);

  useEffect(() => {
    fetchRecent();
  }, []);

  const fetchRecent = async () => {
    setIsLoadingRecent(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      
      const res = await apiFetch(`${API_BASE}/api/admin/announcements?limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setRecentAnnouncements(data);
      } else {
        throw new Error("Failed to fetch announcements");
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
    if (target === "specific" && !specificEmails.trim()) {
      return toast.error("Please enter specific email addresses.");
    }

    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    
    // For specific users, we can prefix the target to let the backend know, or just rely on a new field.
    // The backend just accepts a string for target, so we encode the specific emails in it.
    const finalTarget = target === "specific" ? `users:${specificEmails}` : target;

    const payload = {
      message,
      target: finalTarget,
      priority,
    };

    if (window.confirm(`Are you sure you want to send this announcement?`)) {
      setIsSending(true);
      try {
        const res = await apiFetch(`${API_BASE}/api/admin/announcements`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          throw new Error("API request failed");
        }

        toast.success(`Announcement sent successfully`);
        setMessage("");
        setSpecificEmails("");
        fetchRecent();

      } catch (err: any) {
        toast.error(err.message || "Failed to process announcement.");
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
    "all": "All Users",
    "active_7d": "Active Users (7 days)",
    "active_30d": "Inactive Users (30 days)",
    "specific": "Specific Users"
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
                  <option key={t} value={t}>{targetMapping[t]}</option>
                ))}
              </select>
            </div>

            {target === "specific" && (
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
                <option value="normal">Normal Default</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent (Requires Action)</option>
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

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3 border-t border-border/30 mt-4">
              <Button 
                onClick={handleSend}
                disabled={isSending || message.length < 10}
                className="flex-1 h-10 font-medium tracking-wide bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg"
              >
                <Send className="w-4 h-4 mr-2" /> 
                {isSending ? "Publishing..." : "Publish"}
              </Button>
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
                            {a.priority === 'urgent' ? (
                              <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/30">Urgent</Badge>
                            ) : a.priority === 'high' ? (
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

