import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MoreVertical, ShieldAlert, Mail, Activity, Trash } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

// Mock user data
const MOCK_USERS = Array.from({length: 50}, (_, i) => ({
  id: `usr_${i}`,
  name: `Student ${i+1}`,
  email: `student${i+1}@example.com`,
  role: i === 0 ? 'admin' : 'student',
  enrolled_chapters: Math.floor(Math.random() * 10),
  watch_time_mins: Math.floor(Math.random() * 5000),
  last_active: new Date(Date.now() - Math.random() * 10000000000).toLocaleDateString(),
  status: Math.random() > 0.9 ? 'blocked' : 'active'
}));

export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const filteredUsers = useMemo(() => {
    return MOCK_USERS.filter(u => {
      const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [searchTerm, roleFilter]);

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-foreground-muted text-sm mt-1">Manage students, roles, and access.</p>
        </div>
      </div>

      <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
        <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div className="flex w-full sm:w-auto items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
              <Input 
                placeholder="Search users..." 
                className="pl-9 h-9 bg-black/20 border-white/10 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-32 h-9 bg-black/20 border-white/10 text-sm">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            {selectedUsers.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    Bulk Actions ({selectedUsers.size})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
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
            <Button size="sm" className="h-9">Export CSV</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="rounded border-white/20 bg-black/20"
                    checked={selectedUsers.size > 0 && selectedUsers.size === filteredUsers.length}
                    onChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.slice(0, 10).map((u) => (
                <TableRow key={u.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell className="text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-white/20 bg-black/20"
                      checked={selectedUsers.has(u.id)}
                      onChange={() => toggleSelectUser(u.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground flex items-center gap-2">
                          {u.name}
                          {u.status === 'blocked' && <Badge variant="destructive" className="h-4 text-[9px] px-1 animate-pulse">Blocked</Badge>}
                        </div>
                        <div className="text-xs text-foreground-muted">{u.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${u.role === 'admin' ? 'border-primary text-primary' : 'border-white/10 text-foreground-muted'}`}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-foreground-dim flex flex-col gap-0.5">
                      <span>{u.enrolled_chapters} Chapters Enrolled</span>
                      <span>{Math.floor(u.watch_time_mins / 60)}h watch time</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-foreground-muted">{u.last_active}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10">
                          <MoreVertical className="w-4 h-4 text-foreground-muted" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem><Activity className="w-4 h-4 mr-2" /> View Activity</DropdownMenuItem>
                        <DropdownMenuItem><Mail className="w-4 h-4 mr-2" /> Send Email</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive"><ShieldAlert className="w-4 h-4 mr-2" /> Block User</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="p-4 border-t border-white/5 text-xs text-foreground-muted text-center">
          Showing 10 of {filteredUsers.length} users (Pagination to be implemented)
        </div>
      </Card>
    </div>
  );
}
