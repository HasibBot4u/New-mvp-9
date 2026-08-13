import { useEffect, useState } from "react";
import { contentApi } from "@/features/admin-control-plane/api";
import { ControlPlaneShell } from "./ControlPlanePage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Plus, ArrowUp, ArrowDown, Trash2, Eye, EyeOff } from "lucide-react";

type Row = Record<string, any>;
type Resource = "subjects" | "cycles" | "chapters" | "videos";

const RESOURCES: { key: Resource; label: string; parent?: Resource; parentKey?: string }[] = [
  { key: "subjects", label: "Subjects" },
  { key: "cycles", label: "Cycles", parent: "subjects", parentKey: "subject_id" },
  { key: "chapters", label: "Chapters", parent: "cycles", parentKey: "cycle_id" },
  { key: "videos", label: "Videos", parent: "chapters", parentKey: "chapter_id" },
];

const FIELDS: Record<Resource, { key: string; label: string; type?: string }[]> = {
  subjects: [
    { key: "name", label: "Name" }, { key: "name_bn", label: "Name (BN)" },
    { key: "slug", label: "Slug" }, { key: "description", label: "Description", type: "textarea" },
    { key: "display_order", label: "Order", type: "number" },
  ],
  cycles: [
    { key: "name", label: "Name" }, { key: "name_bn", label: "Name (BN)" },
    { key: "subject_id", label: "Subject ID" }, { key: "display_order", label: "Order", type: "number" },
  ],
  chapters: [
    { key: "name", label: "Name" }, { key: "name_bn", label: "Name (BN)" },
    { key: "cycle_id", label: "Cycle ID" },
    { key: "requires_enrollment", label: "Requires enrollment", type: "bool" },
    { key: "display_order", label: "Order", type: "number" },
  ],
  videos: [
    { key: "title", label: "Title" }, { key: "title_bn", label: "Title (BN)" },
    { key: "chapter_id", label: "Chapter ID" },
    { key: "source_type", label: "Source (telegram/youtube/drive)" },
    { key: "telegram_channel_id", label: "Telegram channel ID" },
    { key: "telegram_message_id", label: "Telegram message ID", type: "number" },
    { key: "youtube_video_id", label: "YouTube ID" },
    { key: "drive_file_id", label: "Drive file ID" },
    { key: "display_order", label: "Order", type: "number" },
  ],
};

export default function ControlPlaneContent() {
  const [resource, setResource] = useState<Resource>("subjects");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: string; row: Row } | null>(null);

  const cfg = RESOURCES.find((r) => r.key === resource)!;

  async function load() {
    setLoading(true);
    try {
      const data = await contentApi.list(resource, search || undefined) as Row[];
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [resource]);

  async function save(payload: Record<string, unknown>) {
    try {
      if (editing) {
        await contentApi.update(resource, editing.id, payload);
        toast.success("Saved");
      } else {
        await contentApi.create(resource, payload);
        toast.success("Created");
      }
      setEditing(null); setCreating(false); await load();
    } catch (e: any) { toast.error(e.message || "Save failed"); }
  }

  async function publish(row: Row, active: boolean) {
    try {
      await (active ? contentApi.unpublish(resource, row.id) : contentApi.publish(resource, row.id));
      toast.success(active ? "Unpublished" : "Published");
      await load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function remove(row: Row) {
    try {
      await contentApi.delete(resource, row.id);
      toast.success(resource === "videos" ? "Deleted" : "Archived");
      setConfirm(null); await load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function move(index: number, dir: -1 | 1) {
    const ordered = rows.map((r) => r.id);
    [ordered[index], ordered[index + dir]] = [ordered[index + dir], ordered[index]];
    try {
      await contentApi.reorder(resource, ordered);
      await load();
    } catch (e: any) { toast.error(e.message); }
  }

  const titleKey = resource === "videos" ? "title" : "name";

  return (
    <ControlPlaneShell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Content</h1>
        <Button onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-1" /> New {cfg.label.slice(0, -1)}</Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {RESOURCES.map((r) => (
          <Button key={r.key} size="sm" variant={resource === r.key ? "default" : "outline"} onClick={() => setResource(r.key)}>
            {r.label}
          </Button>
        ))}
      </div>

      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-foreground-muted" />
            <Input className="pl-9" placeholder={`Search ${cfg.label.toLowerCase()}...`} value={search}
                   onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{cfg.label}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-foreground-muted">Loading…</p> : rows.length === 0 ? (
            <p className="text-sm text-foreground-muted">No items yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((row, i) => (
                <div key={row.id} className="py-3 flex items-center gap-3">
                  <div className="flex flex-col">
                    <button disabled={i === 0} onClick={() => move(i, -1)} className="text-foreground-muted disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="text-foreground-muted disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{row[titleKey] || row.name_bn || row.title_bn || "(untitled)"}</div>
                    <div className="text-xs text-foreground-muted font-mono">{row.id?.slice(0, 8)}</div>
                  </div>
                  <Badge variant={row.is_active ? "default" : "secondary"}>{row.is_active ? "Published" : "Draft"}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => publish(row, !!row.is_active)}>
                    {row.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirm({ kind: resource === "videos" ? "delete" : "archive", row })}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(editing || creating) && (
        <EditDialog resource={resource} mode={editing ? "edit" : "create"} initial={editing || {}}
                   onClose={() => { setEditing(null); setCreating(false); }} onSave={save} />
      )}

      <Dialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm {confirm?.kind}</DialogTitle>
            <DialogDescription>
              {confirm?.kind === "delete"
                ? "Permanently delete this video? This cannot be undone."
                : "Archive this item? It will be hidden from users but preserved in the database."}
            </DialogDescription>
          </DialogHeader>
          {confirm && <p className="text-sm font-medium">{confirm.row[titleKey] || confirm.row.title || "(untitled)"}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirm && remove(confirm.row)}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ControlPlaneShell>
  );
}

function EditDialog({ resource, mode, initial, onClose, onSave }: {
  resource: Resource; mode: "create" | "edit"; initial: Row;
  onClose: () => void; onSave: (p: Record<string, unknown>) => void;
}) {
  const fields = FIELDS[resource];
  const [form, setForm] = useState<Record<string, any>>({ ...initial });
  const isVid = resource === "videos";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit" : "New"} {resource.slice(0, -1)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <Label htmlFor={f.key}>{f.label}</Label>
              {f.type === "textarea" ? (
                <textarea id={f.key} className="w-full min-h-[60px] rounded border p-2 text-sm bg-background"
                  value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              ) : f.type === "bool" ? (
                <input id={f.key} type="checkbox" className="ml-2" checked={!!form[f.key]}
                       onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} />
              ) : (
                <Input id={f.key} type={f.type === "number" ? "number" : "text"}
                       value={form[f.key] ?? ""} onChange={(e) =>
                  setForm({ ...form, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })} />
              )}
            </div>
          ))}
          {isVid && (
            <p className="text-xs text-amber-600">
              Telegram channel/message IDs are sensitive infrastructure values. Enter them carefully; the session must have access.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
