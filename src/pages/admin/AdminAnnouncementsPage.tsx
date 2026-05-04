import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Megaphone, Send, Calendar, Users, Eye, Edit, Trash } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const MOCK_ANNOUNCEMENTS = [
  { id: 1, title: 'Physics Exam Postponed', target: 'Physics Cycle 1', status: 'Sent', readers: 450, date: '1h ago' },
  { id: 2, title: 'New Server Live', target: 'All Users', status: 'Sent', readers: 1200, date: 'Yesterday' },
  { id: 3, title: 'Payment Gateway Maintenance', target: 'All Users', status: 'Scheduled', readers: 0, date: 'Tomorrow at 10PM' },
];

export default function AdminAnnouncementsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
          <p className="text-foreground-muted text-sm mt-1">Send push notifications to students or specific batches.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" /> Create Announcement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-foreground-muted">Title</label>
              <Input placeholder="E.g., Server Maintenance Tonight" className="h-9 bg-black/20" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-foreground-muted">Message body (Markdown supported)</label>
              <textarea 
                className="w-full h-32 px-3 py-2 text-sm rounded-md border border-white/10 bg-black/20 text-foreground"
                placeholder="Type your message here..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-foreground-muted">Target Audience</label>
              <select className="flex h-9 w-full rounded-md border border-white/10 bg-black/20 px-3 py-1 text-sm shadow-sm transition-colors cursor-pointer text-foreground">
                <option>All Users</option>
                <option>Active Enrolled Students Only</option>
                <option>Specific Subject (Physics)</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1">
                <Send className="w-4 h-4 mr-2" /> Send Now
              </Button>
              <Button variant="outline" className="flex-1">
                <Calendar className="w-4 h-4 mr-2" /> Schedule
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base">Recent & Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead>Title</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_ANNOUNCEMENTS.map(a => (
                    <TableRow key={a.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell>
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-foreground-muted">{a.date}</p>
                      </TableCell>
                      <TableCell className="text-xs">
                         <div className="flex items-center gap-1"><Users className="w-3 h-3 text-foreground-muted" />{a.target}</div>
                      </TableCell>
                      <TableCell>
                        {a.status === 'Sent' ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="w-fit text-[10px] border-emerald-500/50 text-emerald-400 bg-emerald-500/10">Sent</Badge>
                            <span className="text-[10px] text-foreground-muted flex items-center gap-1"><Eye className="w-3 h-3" /> {a.readers} views</span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="w-fit text-[10px] border-blue-500/50 text-blue-400 bg-blue-500/10">Scheduled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {a.status === 'Scheduled' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7"><Edit className="w-3.5 h-3.5" /></Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"><Trash className="w-3.5 h-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
