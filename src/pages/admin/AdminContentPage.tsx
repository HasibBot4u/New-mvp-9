import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/contexts/CatalogContext";
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Plus, Database, Pencil, Trash, PlaySquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SubjectModal, CycleModal, ChapterModal, VideoModal } from "./AdminContentModals";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type NodeType = 'subject' | 'cycle' | 'chapter';
interface SelectedNode { id: string; type: NodeType; data: any; }

export default function AdminContentPage() {
  const { catalog, isLoading, refresh } = useCatalog();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);

  const [modalState, setModalState] = useState<{ type: 'subject'|'cycle'|'chapter'|'video', data?: any } | null>(null);

  const toggleNode = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newNodes = new Set(expandedNodes);
    if (newNodes.has(id)) newNodes.delete(id);
    else newNodes.add(id);
    setExpandedNodes(newNodes);
  };

  const apiCall = async (method: string, endpoint: string, body?: any) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw new Error("Not authenticated");

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${token}`
    };

    let payloadStr = "";
    if (body) {
      payloadStr = JSON.stringify({ data: body });
      headers["Content-Type"] = "application/json";
    }

    const secret = import.meta.env.VITE_ADMIN_TOKEN || "fake_admin_token_abcdef1234567890";
    const timestamp = (Date.now() / 1000).toString();
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(`${payloadStr}:${timestamp}`));
    const signature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    headers["X-Admin-Signature"] = signature;
    headers["X-Admin-Timestamp"] = timestamp;

    const API_URL = import.meta.env.VITE_API_BASE_URL || "https://nexusedu-backend-0bjq.onrender.com";
    const res = await fetch(`${API_URL}/api/admin/${endpoint}`, { method, headers, ...(body ? { body: payloadStr } : {}) });
    
    if (!res.ok) {
      let errText = await res.text();
      try { errText = JSON.parse(errText).detail || errText; } catch (_) {
        // Ignored
      }
      throw new Error(errText);
    }
    return res.json();
  };

  const handleSave = async (payload: any) => {
    if (!modalState) return;
    try {
      const { type, data } = modalState;
      let endpoint = '';
      if (type === 'subject') endpoint = 'subjects';
      if (type === 'cycle') endpoint = 'cycles';
      if (type === 'chapter') endpoint = 'chapters';
      if (type === 'video') endpoint = 'videos';

      if (data?.id) {
        // Update
        await apiCall('PUT', `${endpoint}/${data.id}`, payload);
        toast.success(`${type} updated successfully`);
      } else {
        // Insert
        if (type === 'cycle') payload.subject_id = selectedNode?.id;
        if (type === 'chapter') payload.cycle_id = selectedNode?.id;
        if (type === 'video') payload.chapter_id = selectedNode?.id;

        await apiCall('POST', endpoint, payload);
        toast.success(`${type} created successfully`);
      }
      refresh();
      setModalState(null);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (type: string, id: string) => {
    if (!confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) return;
    try {
      const endpoint = type === 'subject' ? 'subjects' : type === 'cycle' ? 'cycles' : type === 'chapter' ? 'chapters' : 'videos';
      await apiCall('DELETE', `${endpoint}/${id}`);
      toast.success(`${type} deleted successfully`);
      if (selectedNode?.id === id) setSelectedNode(null);
      refresh();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  if (isLoading) return <div className="text-foreground-muted animate-pulse">Loading content...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 min-h-[calc(100vh-100px)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Management</h1>
          <p className="text-foreground-muted text-sm mt-1">Manage Subjects, Cycles, Chapters, and Videos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-9" onClick={() => setModalState({ type: 'subject' })}>
            <Plus className="w-4 h-4 mr-2" /> Add Subject
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start h-[calc(100vh-180px)]">
        {/* Hierarchical Browser */}
        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl h-full flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-2 pb-10 space-y-0.5 custom-scrollbar">
            {catalog?.subjects.map(subject => (
              <div key={subject.id} className="text-sm">
                <div 
                  className={`flex items-center justify-between p-1.5 rounded-md cursor-pointer transition-colors ${selectedNode?.id === subject.id ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-foreground'}`}
                  onClick={() => setSelectedNode({ id: subject.id, type: 'subject', data: subject })}
                >
                  <div className="flex items-center gap-1.5 flex-1" onClick={(e) => toggleNode(subject.id, e)}>
                    {expandedNodes.has(subject.id) ? <ChevronDown className="w-4 h-4 text-foreground-muted shrink-0" /> : <ChevronRight className="w-4 h-4 text-foreground-muted shrink-0" />}
                    {expandedNodes.has(subject.id) ? <FolderOpen className="w-4 h-4 text-blue-400 shrink-0" /> : <Folder className="w-4 h-4 text-blue-400 shrink-0" />}
                    <span className="truncate font-medium">{subject.name}</span>
                  </div>
                  <Badge variant="outline" className="text-[9px] px-1 h-4 bg-black/20">{subject.cycles.length}</Badge>
                </div>

                {expandedNodes.has(subject.id) && (
                  <div className="pl-4 ml-2 border-l border-white/5 mt-0.5 space-y-0.5">
                    {subject.cycles.map(cycle => (
                      <div key={cycle.id}>
                        <div 
                          className={`flex items-center justify-between p-1.5 rounded-md cursor-pointer transition-colors ${selectedNode?.id === cycle.id ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-foreground-dim'}`}
                          onClick={() => setSelectedNode({ id: cycle.id, type: 'cycle', data: cycle })}
                        >
                          <div className="flex items-center gap-1.5 flex-1" onClick={(e) => toggleNode(cycle.id, e)}>
                            {expandedNodes.has(cycle.id) ? <ChevronDown className="w-4 h-4 text-foreground-muted shrink-0" /> : <ChevronRight className="w-4 h-4 text-foreground-muted shrink-0" />}
                            {expandedNodes.has(cycle.id) ? <FolderOpen className="w-4 h-4 text-emerald-400 shrink-0" /> : <Folder className="w-4 h-4 text-emerald-400 shrink-0" />}
                            <span className="truncate">{cycle.name}</span>
                          </div>
                          <Badge variant="outline" className="text-[9px] px-1 h-4 bg-black/20">{cycle.chapters.length}</Badge>
                        </div>

                        {expandedNodes.has(cycle.id) && (
                          <div className="pl-4 ml-2 border-l border-white/5 mt-0.5 space-y-0.5">
                            {cycle.chapters.map(chapter => (
                              <div 
                                key={chapter.id} 
                                className={`flex items-center justify-between p-1.5 rounded-md cursor-pointer transition-colors ${selectedNode?.id === chapter.id ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-foreground-dim'}`}
                                onClick={() => setSelectedNode({ id: chapter.id, type: 'chapter', data: chapter })}
                              >
                                <div className="flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0 ml-1" />
                                  <span className="truncate text-xs">{chapter.name}</span>
                                </div>
                                <span className="text-[10px] text-foreground-muted">{chapter.videos.length}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Content Viewer / Editor */}
        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl h-full flex flex-col overflow-hidden relative">
          {!selectedNode ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 text-foreground-muted">
                <Database className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-medium">Select an item</h3>
              <p className="text-sm text-foreground-muted mt-1 max-w-sm">
                Click on a subject, cycle, or chapter from the tree on the left.
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/10">
                <div>
                  <h3 className="font-semibold">{selectedNode.data.name || selectedNode.data.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] uppercase">{selectedNode.type}</Badge>
                    <span className="text-xs text-foreground-muted">ID: {selectedNode.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setModalState({ type: selectedNode.type, data: selectedNode.data })}>
                    <Pencil className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(selectedNode.type, selectedNode.id)}>
                    <Trash className="w-4 h-4 mr-2" /> Delete
                  </Button>
                </div>
              </div>

              <div className="flex-1 p-4 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-sm">
                    {selectedNode.type === 'subject' && 'Cycles in this Subject'}
                    {selectedNode.type === 'cycle' && 'Chapters in this Cycle'}
                    {selectedNode.type === 'chapter' && 'Videos in this Chapter'}
                  </h4>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                       const childType = selectedNode.type === 'subject' ? 'cycle' : selectedNode.type === 'cycle' ? 'chapter' : 'video';
                       setModalState({ type: childType as any });
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" /> 
                    Add {selectedNode.type === 'subject' ? 'Cycle' : selectedNode.type === 'cycle' ? 'Chapter' : 'Video'}
                  </Button>
                </div>

                <div className="rounded-xl border border-white/5 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-black/20">
                      <TableRow>
                        <TableHead>Target</TableHead>
                        <TableHead className="w-24">Order</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                       {selectedNode.type === 'subject' && selectedNode.data.cycles.map((c: any) => (
                         <TableRow key={c.id}>
                           <TableCell className="font-medium truncate">{c.name}</TableCell>
                           <TableCell>{c.display_order}</TableCell>
                           <TableCell>
                             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setModalState({ type: 'cycle', data: c })}><Pencil className="w-3 h-3" /></Button>
                           </TableCell>
                         </TableRow>
                       ))}
                       {selectedNode.type === 'cycle' && selectedNode.data.chapters.map((c: any) => (
                         <TableRow key={c.id}>
                           <TableCell className="font-medium truncate">{c.name}</TableCell>
                           <TableCell>{c.display_order}</TableCell>
                           <TableCell>
                             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setModalState({ type: 'chapter', data: c })}><Pencil className="w-3 h-3" /></Button>
                           </TableCell>
                         </TableRow>
                       ))}
                       {selectedNode.type === 'chapter' && selectedNode.data.videos.map((v: any) => (
                         <TableRow key={v.id}>
                           <TableCell>
                             <div className="font-medium truncate">{v.title}</div>
                             <div className="text-[10px] text-foreground-muted flex items-center gap-1 mt-0.5">
                               <PlaySquare className="w-3 h-3" /> {v.source_type}
                             </div>
                           </TableCell>
                           <TableCell>{v.display_order}</TableCell>
                           <TableCell>
                             <div className="flex items-center">
                               <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setModalState({ type: 'video', data: v })}><Pencil className="w-3 h-3" /></Button>
                               <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete('video', v.id)}><Trash className="w-3 h-3" /></Button>
                             </div>
                           </TableCell>
                         </TableRow>
                       ))}
                       {((selectedNode.type === 'subject' && selectedNode.data.cycles.length === 0) ||
                         (selectedNode.type === 'cycle' && selectedNode.data.chapters.length === 0) ||
                         (selectedNode.type === 'chapter' && selectedNode.data.videos.length === 0)) && (
                         <TableRow>
                           <TableCell colSpan={3} className="text-center py-6 text-foreground-muted text-sm">
                             No items found.
                           </TableCell>
                         </TableRow>
                       )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {modalState?.type === 'subject' && <SubjectModal isOpen={true} onClose={() => setModalState(null)} onSave={handleSave} defaultValues={modalState.data} />}
      {modalState?.type === 'cycle' && <CycleModal isOpen={true} onClose={() => setModalState(null)} onSave={handleSave} defaultValues={modalState.data} />}
      {modalState?.type === 'chapter' && <ChapterModal isOpen={true} onClose={() => setModalState(null)} onSave={handleSave} defaultValues={modalState.data} />}
      {modalState?.type === 'video' && <VideoModal isOpen={true} onClose={() => setModalState(null)} onSave={handleSave} defaultValues={modalState.data} />}
    </div>
  );
}
