import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCatalog } from "@/contexts/CatalogContext";
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown, MoreVertical, Plus, Upload, Database } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export default function AdminContentPage() {
  const { catalog, isLoading } = useCatalog();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const toggleNode = (id: string) => {
    const newNodes = new Set(expandedNodes);
    if (newNodes.has(id)) newNodes.delete(id);
    else newNodes.add(id);
    setExpandedNodes(newNodes);
  };

  if (isLoading) return <div className="text-foreground-muted animate-pulse">Loading content...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 min-h-[calc(100vh-100px)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Management</h1>
          <p className="text-foreground-muted text-sm mt-1">Hierarchical browser and bulk video operations.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9">
            <Upload className="w-4 h-4 mr-2" /> Upload Batch
          </Button>
          <Button size="sm" className="h-9">
            <Plus className="w-4 h-4 mr-2" /> Add Subject
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] xl:grid-cols-[350px_1fr] gap-6 items-start h-[calc(100vh-180px)]">
        {/* Hierarchical Browser */}
        <Card className="bg-surface/40 border-white/5 backdrop-blur-xl h-full flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/5 bg-black/10">
            <Input 
              placeholder="Filter content tree..." 
              className="h-8 bg-black/20 border-white/10 text-xs"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2 pb-10 space-y-0.5 custom-scrollbar">
            {catalog?.subjects.map(subject => (
              <div key={subject.id} className="text-sm">
                <div 
                  className={`flex items-center justify-between p-1.5 rounded-md cursor-pointer transition-colors ${selectedNode === subject.id ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-foreground'}`}
                  onClick={() => { toggleNode(subject.id); setSelectedNode(subject.id); }}
                >
                  <div className="flex items-center gap-1.5">
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
                          className={`flex items-center justify-between p-1.5 rounded-md cursor-pointer transition-colors ${selectedNode === cycle.id ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-foreground-dim'}`}
                          onClick={() => { toggleNode(cycle.id); setSelectedNode(cycle.id); }}
                        >
                          <div className="flex items-center gap-1.5">
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
                                className={`flex items-center justify-between p-1.5 rounded-md cursor-pointer transition-colors ${selectedNode === chapter.id ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-foreground-dim'}`}
                                onClick={() => setSelectedNode(chapter.id)}
                              >
                                <div className="flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0 ml-1" />
                                  <span className="truncate text-xs">{chapter.name}</span>
                                </div>
                                <span className="text-[10px] text-foreground-muted">{chapter.videos.length} videos</span>
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
                Click on a subject, cycle, or chapter from the tree on the left to view its contents and properties.
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/10">
                <div>
                  <h3 className="font-semibold">{selectedNode}</h3>
                  <p className="text-xs text-foreground-muted mt-0.5">ID: {selectedNode.slice(0, 8)}... (placeholder)</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Edit metadata</DropdownMenuItem>
                    <DropdownMenuItem>Upload content</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex-1 p-4 overflow-y-auto">
                 <div className="rounded-xl border border-white/5 bg-black/20 p-8 text-center text-foreground-muted border-dashed">
                   {/* Here we would render a generic table of children elements (like videos) based on the selectedNode type */}
                   <p className="text-sm mb-4">View and edit children items here</p>
                   <Button variant="outline" size="sm">Add Item</Button>
                 </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
