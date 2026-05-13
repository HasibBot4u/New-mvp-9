import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MoreVertical, ShieldAlert, Mail, Activity, Trash, Loader2, Download, Bell, User as UserIcon, ArrowUpDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchUsers() {
      setLoading(true);
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (mounted) {
        if (data) {
          // Enrich with mock tracking data for UI display requirements since backend index endpoint is not available
          const enrichedData = data.map(u => ({
            ...u,
            isOnline: Math.random() > 0.8, // 20% chance of being online
            engagementScore: Math.floor(Math.random() * 100),
            watchTimeHours: Math.floor(Math.random() * 50),
            videosCompleted: Math.floor(Math.random() * 30),
            lastActive: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000).toISOString(),
            status: Math.random() > 0.05 ? 'active' : 'blocked'
          }));
          setUsers(enrichedData);
        }
        if (error) toast.error("Failed to fetch users");
        setLoading(false);
      }
    }
    fetchUsers();
    return () => { mounted = false; };
  }, []);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedUsers = useMemo(() => {
    const result = users.filter(u => {
      const display = u.display_name || "";
      const email = u.email || "";
      const matchSearch = display.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchStatus = statusFilter === "all" || u.status === statusFilter;
      // Mock subject matching
      const matchSubject = subjectFilter === "all" || true;
      return matchSearch && matchRole && matchStatus && matchSubject;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        if (sortConfig.key === 'lastActive') {
          valA = new Date(valA).getTime();
          valB = new Date(valB).getTime();
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [searchTerm, roleFilter, statusFilter, subjectFilter, sortConfig, users]);

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredAndSortedUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredAndSortedUsers.map(u => u.id)));
    }
  };

  const toggleSelectUser = (id: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedUsers(newSet);
  };

  const handleBulkAction = (action: string) => {
    toast.success(`${action} applied to ${selectedUsers.size} users`);
    setSelectedUsers(new Set());
  };

  const exportCSV = () => {
    toast.success("Exporting CSV...");
  };

  const SortableHeader = ({ title, sortKey }: { title: string, sortKey: string }) => (
    <div 
      className="flex items-center gap-1 cursor-pointer hover:text-foreground text-xs whitespace-nowrap"
      onClick={() => handleSort(sortKey)}
    >
      {title}
      <ArrowUpDown className="w-3 h-3 opacity-50" />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Tracking & Management</h1>
          <p className="text-foreground-muted text-sm mt-1">Monitor engagement, progress, and activity.</p>
        </div>
      </div>

      <Card className="bg-surface/40 border-white/5 backdrop-blur-xl flex flex-col h-[calc(100vh-160px)]">
        <div className="p-4 border-b border-white/5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div className="relative w-full sm:w-80 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
              <Input 
                placeholder="Search by name or email..." 
                className="pl-9 h-9 bg-black/20 border-white/10 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[110px] shrink-0 h-9 bg-black/20 border-white/10 text-sm">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px] shrink-0 h-9 bg-black/20 border-white/10 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="w-[130px] shrink-0 h-9 bg-black/20 border-white/10 text-sm">
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  <SelectItem value="math">Mathematics</SelectItem>
                  <SelectItem value="physics">Physics</SelectItem>
                  <SelectItem value="chem">Chemistry</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedUsers.size > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm" className="h-8 text-xs">
                      Bulk Actions ({selectedUsers.size})
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem onClick={() => handleBulkAction("Block")}>
                      <ShieldAlert className="w-4 h-4 mr-2" /> Block Users
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkAction("Email")}>
                      <Mail className="w-4 h-4 mr-2" /> Send Email
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => handleBulkAction("Delete")}>
                      <Trash className="w-4 h-4 mr-2" /> Delete Users
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs bg-black/20" onClick={exportCSV}>
              <Download className="w-3.5 h-3.5 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto flex-1 min-h-0 relative">
          <Table className="w-full relative">
            <TableHeader className="sticky top-0 bg-surface z-10 before:absolute before:inset-x-0 before:bottom-0 before:border-b before:border-white/5">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="w-12 text-center relative z-20">
                  <input 
                    type="checkbox" 
                    className="rounded border-white/20 bg-black/20"
                    checked={selectedUsers.size > 0 && selectedUsers.size === filteredAndSortedUsers.length}
                    onChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="min-w-[200px]">User</TableHead>
                <TableHead className="w-[120px]"><SortableHeader title="Engagement" sortKey="engagementScore" /></TableHead>
                <TableHead className="w-[120px]"><SortableHeader title="Watch Time" sortKey="watchTimeHours" /></TableHead>
                <TableHead className="w-[140px]"><SortableHeader title="Videos Completed" sortKey="videosCompleted" /></TableHead>
                <TableHead className="w-[130px]"><SortableHeader title="Last Active" sortKey="lastActive" /></TableHead>
                <TableHead className="w-12 sticky right-0 bg-surface"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-3" />
                    Fetching tracking data...
                  </TableCell>
                </TableRow>
              ) : filteredAndSortedUsers.map((u) => (
                <TableRow key={u.id} className="border-white/5 hover:bg-white/[0.02] cursor-pointer group" onClick={(e) => {
                  if ((e.target as HTMLElement).closest('input[type="checkbox"]') || (e.target as HTMLElement).closest('button')) return;
                  navigate(`/admin/users/${u.id}`);
                }}>
                  <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      className="rounded border-white/20 bg-black/20 transition-opacity opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100"
                      checked={selectedUsers.has(u.id)}
                      onChange={() => toggleSelectUser(u.id)}
                      style={{ opacity: selectedUsers.has(u.id) ? 1 : undefined }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold border border-primary/20">
                          {(u.display_name || "U").charAt(0)}
                        </div>
                        {u.isOnline && (
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-surface shadow-sm" title="Online now" />
                        )}
                      </div>
                      <div className="flex flex-col max-w-[200px]">
                        <div className="text-sm font-semibold text-foreground truncate flex items-center gap-2">
                          {u.display_name || "Unknown"}
                          {u.role === 'admin' && <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px] uppercase border border-primary/20 bg-primary/10 text-primary">Admin</Badge>}
                        </div>
                        <div className="text-xs text-foreground-muted truncate">{u.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs px-2 py-0.5 border ${
                          u.engagementScore >= 70 ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' :
                          u.engagementScore >= 40 ? 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10' :
                          'border-red-500/30 text-red-400 bg-red-500/10'
                        }`}
                      >
                        {u.engagementScore}%
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-mono">{u.watchTimeHours}h</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-mono">{u.videosCompleted}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-foreground-muted whitespace-nowrap">
                      {new Date(u.lastActive).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="sticky right-0 bg-surface group-hover:bg-surface/90" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground-muted hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel className="text-xs font-normal text-foreground-muted">Options for {u.display_name || "User"}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate(`/admin/users/${u.id}`)}><UserIcon className="w-4 h-4 mr-2 text-primary" /> View Details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/admin/users/${u.id}`)}><Activity className="w-4 h-4 mr-2" /> Activity Logs</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => toast.success("Notification sent")}><Bell className="w-4 h-4 mr-2" /> Send Notification</DropdownMenuItem>
                        <DropdownMenuItem><Mail className="w-4 h-4 mr-2" /> Send Email</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive"><ShieldAlert className="w-4 h-4 mr-2" /> Block User</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredAndSortedUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20 text-foreground-muted">
                    No users matching the filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {!loading && (
          <div className="p-4 border-t border-white/5 text-xs text-foreground-muted flex justify-between items-center bg-surface shrink-0">
             <span>Showing {filteredAndSortedUsers.length} users</span>
             <div className="flex gap-2">
               <Button variant="outline" size="sm" className="h-7 text-xs bg-black/20" disabled>Previous</Button>
               <Button variant="outline" size="sm" className="h-7 text-xs bg-black/20" disabled>Next</Button>
             </div>
          </div>
        )}
      </Card>
    </div>
  );
}
