import { useEffect, useState } from "react";
import { accessApi } from "@/features/admin-control-plane/api";
import { ControlPlaneShell } from "./ControlPlanePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Shield, UserX, UserCheck } from "lucide-react";

type User = Record<string, any>;
type Role = Record<string, any>;
type Tab = "users" | "roles";

export default function ControlPlaneUsers() {
  const [tab, setTab] = useState<Tab>("users");
  return (
    <ControlPlaneShell>
      <h1 className="text-2xl font-bold mb-1">Users &amp; Roles</h1>
      <p className="text-sm text-foreground-muted mb-4">
        Granular access is layered on top of the owner super-admin. Role changes are audited.
      </p>
      <div className="flex gap-2 mb-4">
        <Button size="sm" variant={tab === "users" ? "default" : "outline"} onClick={() => setTab("users")}>Users</Button>
        <Button size="sm" variant={tab === "roles" ? "default" : "outline"} onClick={() => setTab("roles")}>Roles</Button>
      </div>
      {tab === "users" ? <UsersPanel /> : <RolesPanel />}
    </ControlPlaneShell>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<User | null>(null);
  const [confirm, setConfirm] = useState<{ kind: string; user: User } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await accessApi.listUsers(search || undefined);
      setUsers((data.users as User[]) || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function act(kind: string, user: User) {
    try {
      if (kind === "block") await accessApi.blockUser(user.id);
      if (kind === "unblock") await accessApi.unblockUser(user.id);
      toast.success("Updated");
      setConfirm(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    }
  }

  return (
    <>
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-foreground-muted" />
            <Input className="pl-9" placeholder="Search by name or email…" value={search}
                   onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Users</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-foreground-muted">Loading…</p> : users.length === 0 ? (
            <p className="text-sm text-foreground-muted">No users found.</p>
          ) : (
            <div className="divide-y divide-border">
              {users.map((u) => (
                <div key={u.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {u.display_name || u.email || "(no name)"}
                      {u.is_super_admin && <Badge><Shield className="w-3 h-3 mr-1" />owner</Badge>}
                      {u.is_blocked && <Badge variant="destructive">blocked</Badge>}
                    </div>
                    <div className="text-xs text-foreground-muted truncate">{u.email}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(u.roles || []).map((r: any) => (
                        <Badge key={r.id || r.role_id} variant="outline" className="text-[10px]">
                          {r.key || r.name || r.role_id?.slice(0, 6)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(u)}>Manage</Button>
                  {u.is_blocked ? (
                    <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: "unblock", user: u })}>
                      <UserCheck className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="text-amber-600"
                            disabled={u.is_super_admin}
                            onClick={() => setConfirm({ kind: "block", user: u })}>
                      <UserX className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && <UserDetail user={selected} onClose={() => setSelected(null)} onChanged={load} />}

      <Dialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm {confirm?.kind}</DialogTitle>
            <DialogDescription>
              {confirm?.kind === "block"
                ? "Block this user? They will be unable to sign in."
                : "Unblock this user?"}
            </DialogDescription>
          </DialogHeader>
          {confirm && <p className="text-sm font-medium">{confirm.user.email || confirm.user.display_name}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant={confirm?.kind === "block" ? "destructive" : "default"}
                    onClick={() => confirm && act(confirm.kind, confirm.user)}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function UserDetail({ user, onClose, onChanged }: { user: User; onClose: () => void; onChanged: () => void }) {
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<string[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set((user.roles || []).map((r: any) => r.id || r.role_id)));

  useEffect(() => {
    accessApi.listRolesDetailed().then((r) => {
      const roles = r as Role[];
      setAllRoles(roles);
      const permSet = new Set<string>();
      roles.filter((r) => assigned.has(r.id)).forEach((r) => (r.permissions || []).forEach((p: string) => permSet.add(p)));
      setPerms([...permSet].sort());
    }).catch(() => {});
    // eslint-disable-next-line
  }, [user.id]);

  async function toggle(role: Role) {
    if (role.is_system) {
      toast("The owner role is system-managed.");
      return;
    }
    const next = new Set(assigned);
    try {
      if (next.has(role.id)) {
        await accessApi.removeRole(user.id, role.id);
        next.delete(role.id);
        toast.success("Role removed");
      } else {
        await accessApi.assignRole(user.id, role.id);
        next.add(role.id);
        toast.success("Role assigned");
      }
      setAssigned(next);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Update failed");
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user.display_name || user.email || "User"}</DialogTitle>
          <DialogDescription className="font-mono text-xs">{user.id}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Roles</Label>
            <div className="space-y-2 mt-2">
              {allRoles.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={assigned.has(r.id)}
                            disabled={r.is_system}
                            onCheckedChange={() => toggle(r)} />
                  <span className="font-medium">{r.name}</span>
                  {r.is_system && <Badge variant="outline">system</Badge>}
                  <span className="text-foreground-muted text-xs">— {r.permissions?.length || 0} permissions</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Effective permissions</Label>
            <div className="flex flex-wrap gap-1 mt-2">
              {perms.length ? perms.map((p) => <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>)
                : <span className="text-xs text-foreground-muted">No granular permissions (super-admin only if owner).</span>}
            </div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RolesPanel() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const r = (await accessApi.listRolesDetailed()) as Role[];
      setRoles(r);
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function openPerms(role: Role) {
    setEditing(role);
  }

  async function savePerms(roleId: string, perms: string[]) {
    try {
      await accessApi.setRolePermissions(roleId, perms);
      toast.success("Permissions saved");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setCreating(true)}><Shield className="w-4 h-4 mr-1" /> New role</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {roles.map((r) => (
          <Card key={r.id}>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">{r.name}</CardTitle>
              {r.is_system ? <Badge>system</Badge> : (
                <Button size="sm" variant="ghost" onClick={() => openPerms(r)}>Permissions</Button>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-xs text-foreground-muted font-mono mb-2">{r.key}</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {(r.permissions || []).slice(0, 12).map((p: string) => (
                  <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                ))}
                {(r.permissions || []).length > 12 && <Badge variant="secondary" className="text-[10px]">+{r.permissions.length - 12}</Badge>}
              </div>
              <p className="text-xs text-foreground-muted">{r.user_count ?? 0} user(s)</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing && <PermEditor role={editing} onClose={() => setEditing(null)} onSave={savePerms} />}
      {creating && <CreateRole onClose={() => setCreating(false)} onCreated={load} />}
    </>
  );
}

function PermEditor({ role, onClose, onSave }: { role: Role; onClose: () => void; onSave: (id: string, p: string[]) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permissions || []));
  const [allPerms, setAllPerms] = useState<Array<{ key: string; category: string }>>([]);

  useEffect(() => {
    // Permissions are already available via the roles endpoint; also fetch catalog.
    import("@/features/admin-control-plane/api").then(({ controlPlaneApi }) => {
      controlPlaneApi.getPermissions().then((p) => setAllPerms(p as any));
    });
  }, []);

  const grouped = allPerms.reduce<Record<string, any[]>>((acc, p) => {
    (acc[p.category] ||= []).push(p);
    return acc;
  }, {});

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Permissions — {role.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, perms]) => (
            <div key={cat}>
              <h4 className="text-sm font-semibold capitalize mb-2">{cat}</h4>
              <div className="grid grid-cols-2 gap-2">
                {perms.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selected.has(p.key)}
                              disabled={role.is_system}
                              onCheckedChange={(c) => {
                                const n = new Set(selected);
                                if (c) n.add(p.key); else n.delete(p.key);
                                setSelected(n);
                              }} />
                    {p.key}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={role.is_system} onClick={() => onSave(role.id, [...selected])}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateRole({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function submit() {
    try {
      await accessApi.createRole(key, name, description);
      toast.success("Role created");
      onClose();
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>New role</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Key (lowercase, e.g. editor)</Label><Input value={key} onChange={(e) => setKey(e.target.value)} /></div>
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!key || !name}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
