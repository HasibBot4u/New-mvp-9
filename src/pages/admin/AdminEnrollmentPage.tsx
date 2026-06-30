import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Ticket, Download, Trash, Search, Loader2, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://nexusedu-backend-0bjq.onrender.com";

type EnrollmentCode = {
  id: string;
  code: string;
  chapter_id?: string;
  cycle_id?: string;
  uses: number;
  max_uses: number;
  expires_at?: string;
  is_active: boolean;
  label?: string;
  created_at: string;
  chapters?: { name: string };
  cycles?: { name: string };
  subjects?: { name: string };
};

export default function AdminEnrollmentPage() {
  const { session } = useAuth();
  
  // Data State
  const [codes, setCodes] = useState<EnrollmentCode[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [codeType, setCodeType] = useState<"chapter" | "cycle">("chapter");
  const [count, setCount] = useState(1);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [label, setLabel] = useState("");

  // Target Selection State
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [step, setStep] = useState<"subject" | "cycle" | "chapter">("subject");
  
  const [subjects, setSubjects] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);

  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [selectedCycle, setSelectedCycle] = useState<any>(null);
  const [selectedChapter, setSelectedChapter] = useState<any>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "full">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "chapter" | "cycle">("all");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch initial data
  const fetchCodes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("enrollment_codes")
        .select("*, chapters(name, cycles(name, subjects(name))), cycles(name, subjects(name))")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCodes(data as EnrollmentCode[] || []);
      
      // Clear selections on reload
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err.message || "Failed to load codes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const loadSubjects = async () => {
    try {
      const { data, error } = await supabase.from("subjects").select("id,name,icon").order("name");
      if (error) throw error;
      setSubjects(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCycles = async (subjectId: string) => {
    try {
      const { data, error } = await supabase.from("cycles").select("id,name").eq("subject_id", subjectId).order("name");
      if (error) throw error;
      setCycles(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadChapters = async (cycleId: string) => {
    try {
      const { data, error } = await supabase.from("chapters").select("id,name").eq("cycle_id", cycleId).order("order_index");
      if (error) throw error;
      setChapters(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Selectors handlers
  const openSelector = async () => {
    setSelectedSubject(null);
    setSelectedCycle(null);
    setSelectedChapter(null);
    setStep("subject");
    await loadSubjects();
    setIsSelectorOpen(true);
  };

  const handleSubjectSelect = (sub: any) => {
    setSelectedSubject(sub);
    loadCycles(sub.id);
    setStep("cycle");
  };

  const handleCycleSelect = (cycle: any) => {
    setSelectedCycle(cycle);
    if (codeType === "cycle") {
      setIsSelectorOpen(false);
    } else {
      loadChapters(cycle.id);
      setStep("chapter");
    }
  };

  const handleChapterSelect = (chapter: any) => {
    setSelectedChapter(chapter);
    setIsSelectorOpen(false);
  };

  const getTargetName = () => {
    if (codeType === "cycle") {
      return selectedCycle ? selectedCycle.name : "Select Target...";
    }
    return selectedChapter ? selectedChapter.name : "Select Target...";
  };

  const getTargetId = () => {
    return codeType === "cycle" ? selectedCycle?.id : selectedChapter?.id;
  };

  const canGenerate = Boolean(getTargetId()) && count >= 1 && maxUses >= 1;

  // Generation
  const handleGenerate = async () => {
    const targetId = getTargetId();
    if (!targetId) {
      toast.error(`Please select a ${codeType}`);
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/api/admin/generate_chapter_code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          chapter_id: codeType === "chapter" ? targetId : undefined,
          cycle_id: codeType === "cycle" ? targetId : undefined,
          type: codeType,
          count: count || 1,
          max_uses: maxUses || 1,
          expires_at: expiresAt || null,
          label: label || null
        })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate code");
      }

      toast.success("Codes generated successfully!");
      
      // Reset form (except type)
      setCount(1);
      setMaxUses(1);
      setExpiresAt("");
      setLabel("");
      setSelectedSubject(null);
      setSelectedCycle(null);
      setSelectedChapter(null);
      
      fetchCodes();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong adding codes");
    }
  };

  const handleDelete = async (id: string, codeName: string) => {
    if (!confirm(`Are you sure you want to delete code ${codeName}?`)) return;
    try {
      const { error } = await supabase.from("enrollment_codes").delete().eq("id", id);
      if (error) throw error;
      toast.success("Code deleted");
      fetchCodes();
    } catch (err: any) {
      toast.error("Failed to delete: " + err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} codes?`)) return;
    
    try {
      const arr = Array.from(selectedIds);
      const { error } = await supabase.from("enrollment_codes").delete().in("id", arr);
      if (error) throw error;
      toast.success(`${selectedIds.size} codes deleted`);
      fetchCodes();
    } catch (err: any) {
      toast.error("Failed to bulk delete: " + err.message);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied ${code} to clipboard`);
  };

  const exportCSV = () => {
    if (codes.length === 0) return;
    
    const headers = ["ID", "Code", "Label", "Type", "Target", "Uses", "Max Uses", "Status", "Expires At", "Created At"];
    const rows = filteredCodes.map(c => {
      let parentSubject = "";
      let targetName = "";
      if (c.cycle_id) {
         const cycles = Array.isArray(c.cycles) ? c.cycles[0] : c.cycles;
         const subjects = Array.isArray(cycles?.subjects) ? cycles.subjects[0] : cycles?.subjects;
         parentSubject = subjects?.name || "";
         targetName = cycles?.name || "";
      } else if (c.chapter_id) {
         const chapters = Array.isArray(c.chapters) ? c.chapters[0] : c.chapters;
         const cycles = Array.isArray(chapters?.cycles) ? chapters.cycles[0] : chapters?.cycles;
         const subjects = Array.isArray(cycles?.subjects) ? cycles.subjects[0] : cycles?.subjects;
         parentSubject = subjects?.name || "";
         targetName = chapters?.name || "";
      }
      
      return [
        c.id,
        c.code,
        c.label || "",
        c.cycle_id ? "Cycle" : "Chapter",
        parentSubject ? `${parentSubject} > ${targetName}` : targetName,
        c.uses,
      c.max_uses,
      c.is_active ? "Active" : "Inactive",
      c.expires_at || "Never",
      c.created_at
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `enrollment_codes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCodeStatus = (c: EnrollmentCode) => {
    if (c.uses >= c.max_uses) return "full";
    if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return "expired";
    if (!c.is_active) return "expired"; // treat inactive as expired/disabled
    return "active";
  };

  const filteredCodes = useMemo(() => {
    return codes.filter(c => {
      // text search
      if (searchTerm && !c.code.toLowerCase().includes(searchTerm.toLowerCase()) && !(c.label && c.label.toLowerCase().includes(searchTerm.toLowerCase()))) {
        return false;
      }
      // type filter
      if (typeFilter === "chapter" && !c.chapter_id) return false;
      if (typeFilter === "cycle" && !c.cycle_id) return false;
      
      // status filter
      const status = getCodeStatus(c);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      
      return true;
    });
  }, [codes, searchTerm, typeFilter, statusFilter]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCodes.length && filteredCodes.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCodes.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Enrollment Codes</h1>
          <p className="text-foreground-muted text-sm mt-1">Generate and manage access codes for chapters and cycles.</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" className="h-9" onClick={handleBulkDelete}>
              <Trash className="w-4 h-4 mr-2" /> Delete Selected ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-9" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {isSelectorOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-background border border-border p-6 rounded-xl w-full max-w-md flex flex-col gap-4 shadow-2xl max-h-[80vh]">
            <div className="flex justify-between items-center bg-surface p-2 rounded-lg mb-2">
              <h2 className="font-bold flex-1 text-center text-sm">
                Step 1: Subject
              </h2>
              <ChevronDown className="w-4 h-4 text-muted mx-2 -rotate-90" />
              <h2 className={`font-bold flex-1 text-center text-sm ${step === 'cycle' || step === 'chapter' ? '' : 'opacity-30'}`}>
                Step 2: Cycle
              </h2>
              {codeType === "chapter" && (
                <>
                  <ChevronDown className="w-4 h-4 text-muted mx-2 -rotate-90" />
                  <h2 className={`font-bold flex-1 text-center text-sm ${step === 'chapter' ? '' : 'opacity-30'}`}>
                    Step 3: Chapter
                  </h2>
                </>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3">
              {step === "subject" && subjects.map(s => (
                <button key={s.id} onClick={() => handleSubjectSelect(s)} className="text-left w-full p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-white/5 transition-colors flex flex-row items-center">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center text-xl overflow-hidden">
                    {s.icon || '📚'}
                  </div>
                  <div className="flex-1 ml-3 font-medium">
                    {s.name}
                  </div>
                </button>
              ))}

              {step === "cycle" && cycles.map(c => (
                <button key={c.id} onClick={() => handleCycleSelect(c)} className="text-left w-full p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-white/5 transition-colors flex flex-row items-center">
                  <div className="flex-1 font-medium">{c.name}</div>
                </button>
              ))}
              {step === "cycle" && cycles.length === 0 && <p className="text-center text-muted-foreground p-4">No cycles found in this subject.</p>}

              {step === "chapter" && chapters.map(c => (
                <button key={c.id} onClick={() => handleChapterSelect(c)} className="text-left w-full p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-white/5 transition-colors flex flex-row items-center">
                  <div className="flex-1 font-medium">{c.name}</div>
                </button>
              ))}
              {step === "chapter" && chapters.length === 0 && <p className="text-center text-muted-foreground p-4">No chapters found. Please check cycles or add content.</p>}
            </div>

            <div className="flex justify-end pt-2 border-t border-border mt-2">
              <Button variant="ghost" onClick={() => setIsSelectorOpen(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-surface/40 border-white/5 backdrop-blur-xl">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base flex items-center gap-2">
                <Ticket className="w-4 h-4 text-primary" />
                Quick Generation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex bg-black/20 p-1 rounded-lg">
                <button 
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${codeType === 'chapter' ? 'bg-primary text-primary-foreground shadow' : 'text-foreground/60 hover:text-foreground hover:bg-white/5'}`}
                  onClick={() => { setCodeType("chapter"); setSelectedCycle(null); setSelectedChapter(null); }}
                >
                  Chapter Code
                </button>
                <button 
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${codeType === 'cycle' ? 'bg-primary text-primary-foreground shadow' : 'text-foreground/60 hover:text-foreground hover:bg-white/5'}`}
                  onClick={() => { setCodeType("cycle"); setSelectedChapter(null); setSelectedCycle(selectedSubject ? null : null); /* quick reset logic */ }}
                >
                  Cycle Code
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-foreground-muted block">Target {codeType === "cycle" ? "Cycle" : "Chapter"}</label>
                <Button 
                  variant="outline" 
                  className={`w-full justify-between font-normal flex items-center gap-2 ${getTargetId() ? "border-primary/50 text-foreground" : "text-foreground-muted bg-black/20"}`}
                  onClick={openSelector}
                >
                  <span className="truncate">{getTargetName()}</span>
                  <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-foreground-muted">Custom Label (Optional)</label>
                <Input 
                  placeholder="e.g. HSC 2026 Batch A" 
                  className="h-9 bg-black/20" 
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-foreground-muted">Count to Generate</label>
                  <Input type="number" value={count} onChange={(e) => setCount(parseInt(e.target.value) || 1)} min={1} max={100} className="h-9 bg-black/20" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-foreground-muted">Max Uses Per Code</label>
                  <Input type="number" value={maxUses} onChange={(e) => setMaxUses(parseInt(e.target.value) || 1)} min={1} max={1000} className="h-9 bg-black/20" />
                </div>
              </div>
              <div className="space-y-2 pb-2">
                <label className="text-xs text-foreground-muted">Expiration Date (Optional)</label>
                <Input 
                  type="date" 
                  className="h-9 bg-black/20" 
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={handleGenerate} disabled={!canGenerate}>Generate</Button>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="bg-surface/40 border-white/5 backdrop-blur-xl h-full flex flex-col">
            <div className="p-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" />
                <Input 
                  placeholder="Search code or label..." 
                  className="w-[200px] sm:w-[250px] pl-9 h-9 bg-black/20 border-white/10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <select className="h-9 rounded-md bg-black/20 border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                >
                  <option value="all">All Types</option>
                  <option value="chapter">Chapter Codes</option>
                  <option value="cycle">Cycle Codes</option>
                </select>
                <select className="h-9 rounded-md bg-black/20 border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="full">Full Capacity</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-surface/20 min-h-[400px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-foreground/50 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p>Loading codes...</p>
                </div>
              ) : filteredCodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-foreground/50 py-20 px-4 text-center">
                  <Ticket className="w-12 h-12 mb-4 text-foreground/20" />
                   <p className="text-lg font-medium text-foreground">No codes found</p>
                   <p className="text-sm">Generate some codes using the form to get started.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5 hover:bg-transparent bg-black/20">
                      <TableHead className="w-[40px] px-4">
                        <input type="checkbox" className="rounded" checked={selectedIds.size === filteredCodes.length && filteredCodes.length > 0} onChange={toggleSelectAll} />
                      </TableHead>
                      <TableHead>Code & Label</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCodes.map((c) => {
                      const status = getCodeStatus(c);
                      return (
                        <TableRow key={c.id} className={`border-white/5 hover:bg-white/[0.02] ${selectedIds.has(c.id) ? 'bg-primary/5' : ''}`}>
                          <TableCell className="px-4">
                            <input type="checkbox" className="rounded" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 items-start">
                              <div className="flex items-center gap-2 group">
                                <code className="px-1.5 py-0.5 rounded bg-black/30 font-mono text-sm text-primary font-bold border border-white/5">{c.code}</code>
                                <button onClick={() => copyCode(c.code)} className="text-foreground-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {c.label && <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-foreground/70">{c.label}</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                             <div className="flex flex-col gap-0.5">
                               {(() => {
                                 let subjectName = "";
                                 let targetName = "";
                                 if (c.cycle_id) {
                                   const cycles = Array.isArray(c.cycles) ? c.cycles[0] : c.cycles;
                                   const subjects = Array.isArray(cycles?.subjects) ? cycles.subjects[0] : cycles?.subjects;
                                   subjectName = subjects?.name || "";
                                   targetName = cycles?.name || "";
                                 } else if (c.chapter_id) {
                                   const chapters = Array.isArray(c.chapters) ? c.chapters[0] : c.chapters;
                                   const cycles = Array.isArray(chapters?.cycles) ? chapters.cycles[0] : chapters?.cycles;
                                   const subjects = Array.isArray(cycles?.subjects) ? cycles.subjects[0] : cycles?.subjects;
                                   subjectName = subjects?.name || "";
                                   targetName = chapters?.name || "";
                                 }
                                 return (
                                   <>
                                     {subjectName && (
                                       <span className="text-[10px] text-foreground-muted uppercase tracking-wider">{subjectName}</span>
                                     )}
                                     <span className="text-xs font-semibold text-foreground">
                                       {targetName}
                                     </span>
                                   </>
                                 );
                               })()}
                               <span className="text-[10px] text-primary/70 uppercase tracking-wider mt-0.5">{c.cycle_id ? 'Cycle Access' : 'Chapter Access'}</span>
                             </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-medium text-foreground/80 mb-1">
                              {c.uses} / <span className="text-foreground/50">{c.max_uses}</span>
                            </div>
                            <div className="w-16 h-1 bg-black/40 rounded-full overflow-hidden shadow-inner">
                              <div 
                                className={`h-full ${status === 'full' ? 'bg-foreground/50' : 'bg-primary'}`} 
                                style={{ width: `${Math.min(100, (c.uses / c.max_uses) * 100)}%` }} 
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-foreground-muted">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Never'}</TableCell>
                          <TableCell>
                            {status === "active" ? (
                              <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-400 bg-emerald-500/10 uppercase">Active</Badge>
                            ) : status === "expired" ? (
                              <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-400 bg-red-500/10 uppercase">Expired</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] border-white/10 text-foreground-muted uppercase">Full</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(c.id, c.code)}>
                              <Trash className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
            
            <div className="p-4 border-t border-white/5 text-xs text-foreground-muted flex justify-between items-center bg-black/10">
              <span>Total showing: {filteredCodes.length}</span>
              {selectedIds.size > 0 && <span>{selectedIds.size} selected</span>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
