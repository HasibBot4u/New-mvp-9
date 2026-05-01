import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SubjectModal({ isOpen, onClose, onSave, defaultValues }: any) {
  const [name, setName] = useState(defaultValues?.name || "");
  const [nameBn, setNameBn] = useState(defaultValues?.name_bn || "");
  const [icon, setIcon] = useState(defaultValues?.icon || '📚');
  const [color, setColor] = useState(defaultValues?.color || '#FF2E55');

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (!name) return;
    const slug = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    onSave({ name, name_bn: nameBn, slug, icon, color });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{defaultValues ? "Edit Subject" : "Add Subject"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label htmlFor="s-name">Name</Label><Input id="s-name" value={name} onChange={e => setName(e.target.value)} required /></div>
          <div><Label htmlFor="s-namebn">Bengali Name (Optional)</Label><Input id="s-namebn" value={nameBn} onChange={e => setNameBn(e.target.value)} /></div>
          <div><Label htmlFor="s-icon">Icon (Emoji)</Label><Input id="s-icon" value={icon} onChange={e => setIcon(e.target.value)} /></div>
          <div><Label htmlFor="s-color">Hex Color</Label><Input id="s-color" value={color} onChange={e => setColor(e.target.value)} /></div>
          <DialogFooter><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CycleModal({ isOpen, onClose, onSave, defaultValues }: any) {
  const [name, setName] = useState(defaultValues?.name || "");
  const [nameBn, setNameBn] = useState(defaultValues?.name_bn || "");
  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (!name) return;
    onSave({ name, name_bn: nameBn });
    onClose();
  };
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{defaultValues ? "Edit Cycle" : "Add Cycle"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label htmlFor="cy-name">Name</Label><Input id="cy-name" value={name} onChange={e => setName(e.target.value)} required /></div>
          <div><Label htmlFor="cy-namebn">Bengali Name</Label><Input id="cy-namebn" value={nameBn} onChange={e => setNameBn(e.target.value)} /></div>
          <DialogFooter><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ChapterModal({ isOpen, onClose, onSave, defaultValues }: any) {
  const [name, setName] = useState(defaultValues?.name || "");
  const [nameBn, setNameBn] = useState(defaultValues?.name_bn || "");
  const [desc, setDesc] = useState(defaultValues?.description || "");
  const [requires, setRequires] = useState(defaultValues?.requires_enrollment || false);
  
  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (!name) return;
    onSave({ name, name_bn: nameBn, description: desc, requires_enrollment: requires });
    onClose();
  };
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{defaultValues ? "Edit Chapter" : "Add Chapter"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label htmlFor="ch-name">Name</Label><Input id="ch-name" value={name} onChange={e => setName(e.target.value)} required /></div>
          <div><Label htmlFor="ch-namebn">Bengali Name</Label><Input id="ch-namebn" value={nameBn} onChange={e => setNameBn(e.target.value)} /></div>
          <div><Label htmlFor="ch-desc">Description</Label><Input id="ch-desc" value={desc} onChange={e => setDesc(e.target.value)} /></div>
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="req" checked={requires} onChange={e => setRequires(e.target.checked)} />
            <Label htmlFor="req">Requires Enrollment Code</Label>
          </div>
          <DialogFooter><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function VideoModal({ isOpen, onClose, onSave, defaultValues }: any) {
  const [title, setTitle] = useState(defaultValues?.title || "");
  const [titleBn, setTitleBn] = useState(defaultValues?.title_bn || "");
  const [sourceType, setSourceType] = useState(defaultValues?.source_type || "telegram");
  const [channelId, setChannelId] = useState(defaultValues?.telegram_channel_id || "");
  const [msgId, setMsgId] = useState(defaultValues?.telegram_message_id || "");
  const [ytId, setYtId] = useState(defaultValues?.youtube_video_id || "");
  const [driveId, setDriveId] = useState(defaultValues?.drive_file_id || "");
  const [duration, setDuration] = useState(defaultValues?.duration || "00:00");
  const [size, setSize] = useState(defaultValues?.size_mb || "");
  const [thumb, setThumb] = useState(defaultValues?.thumbnail_url || "");

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (!title) return;
    const payload: any = { title, title_bn: titleBn, source_type: sourceType, duration, thumbnail_url: thumb, size_mb: size ? parseInt(size) : null };
    if (sourceType === 'telegram') {
      payload.telegram_channel_id = channelId || null;
      payload.telegram_message_id = msgId ? parseInt(msgId) : null;
    } else if (sourceType === 'youtube') {
      payload.youtube_video_id = ytId.match(/[a-zA-Z0-9_-]{11}/)?.[0] ?? ytId;
    } else if (sourceType === 'drive') {
      payload.drive_file_id = driveId || null;
    }
    onSave(payload);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{defaultValues ? "Edit Video" : "Add Video"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label htmlFor="v-title">Title</Label><Input id="v-title" value={title} onChange={e => setTitle(e.target.value)} required /></div>
          <div><Label htmlFor="v-titlebn">Bengali Title</Label><Input id="v-titlebn" value={titleBn} onChange={e => setTitleBn(e.target.value)} /></div>
          <div>
            <Label htmlFor="v-type">Source Type</Label>
            <select id="v-type" value={sourceType} onChange={e => setSourceType(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="telegram">Telegram</option>
              <option value="youtube">YouTube</option>
              <option value="drive">Google Drive</option>
            </select>
          </div>
          {sourceType === 'telegram' && (
            <>
              <div><Label htmlFor="v-chan">Telegram Channel ID</Label><Input id="v-chan" value={channelId} onChange={e => setChannelId(e.target.value)} /></div>
              <div><Label htmlFor="v-msg">Telegram Message ID</Label><Input id="v-msg" type="number" value={msgId} onChange={e => setMsgId(e.target.value)} /></div>
            </>
          )}
          {sourceType === 'youtube' && <div><Label htmlFor="v-yt">YouTube URL or ID</Label><Input id="v-yt" value={ytId} onChange={e => setYtId(e.target.value)} /></div>}
          {sourceType === 'drive' && <div><Label htmlFor="v-drive">Drive File ID</Label><Input id="v-drive" value={driveId} onChange={e => setDriveId(e.target.value)} /></div>}
          <div><Label htmlFor="v-dur">Duration (MM:SS)</Label><Input id="v-dur" value={duration} onChange={e => setDuration(e.target.value)} /></div>
          <div><Label htmlFor="v-size">Size (MB)</Label><Input id="v-size" type="number" value={size} onChange={e => setSize(e.target.value)} /></div>
          <div><Label htmlFor="v-thumb">Thumbnail URL</Label><Input id="v-thumb" value={thumb} onChange={e => setThumb(e.target.value)} /></div>
          <DialogFooter><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


