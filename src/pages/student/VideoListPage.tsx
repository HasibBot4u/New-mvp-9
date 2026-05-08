import { useState, useEffect, useMemo } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { Lock, KeyRound, Loader2, ArrowUpDown, Search } from "lucide-react";
import { useCatalog } from "@/contexts/CatalogContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { VirtualVideoList } from "@/components/virtual/VirtualVideoList";

export default function VideoListPage() {
  const { chapterId } = useParams();
  const { catalog, isLoading } = useCatalog();
  const { toast } = useToast();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");

  let chapter: any, cycle: any, subject: any;
  catalog?.subjects.forEach(s => s.cycles.forEach(cy => cy.chapters.forEach(ch => {
    if (ch.id === chapterId) { chapter = ch; cycle = cy; subject = s; }
  })));

  const { hasAccess, submitCode, checkAccess } = useChapterAccess();
  const hasChapterAccess = chapter?.id ? hasAccess(chapter.id) : null;

  useEffect(() => {
    if (chapter?.id) {
       checkAccess(chapter.id);
    }
  }, [chapter?.id, checkAccess]);

  const formatCode = (raw: string) => {
    const stripped = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 24);
    return stripped.match(/.{1,4}/g)?.join("-") ?? stripped;
  };

  const redeem = async () => {
    if (!code.trim() || !chapter?.id) return;
    setBusy(true);
    const res = await submitCode(chapter.id, code);
    setBusy(false);
    if (!res.success) {
      toast({ title: "ত্রুটি", description: (res.message_bn || "Error"), variant: "destructive" });
      return;
    }
    toast({ title: "অধ্যায় আনলক হয়েছে" });
    setShowCodeModal(false);
    setCode("");
  };

  const displayedVideos = useMemo(() => {
    if (!chapter?.videos) return [];
    
    let filtered = [...chapter.videos];
    
    if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(v => 
            v.title.toLowerCase().includes(query) || 
            (v.title_bn && v.title_bn.includes(query))
        );
    }

    return filtered.sort((a, b) => {
      if (sortOrder === "asc") return a.display_order - b.display_order;
      return b.display_order - a.display_order;
    });
  }, [chapter?.videos, sortOrder, searchQuery]);

  if (isLoading) return (
    <div className="container py-20 space-y-4">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="space-y-4 mt-8">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    </div>
  );
  
  if (!chapter) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b border-border">
        <div className="container py-10">
          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground-muted mb-6">
             <Link to="/dashboard" className="hover:text-foreground transition-colors">Home</Link>
             <span>/</span>
             <Link to={`/subject/${subject.slug}`} className="hover:text-foreground transition-colors">{subject.name}</Link>
             <span>/</span>
             <Link to={`/cycle/${cycle.id}`} className="hover:text-foreground transition-colors">{cycle.name}</Link>
             <span>/</span>
             <span className="text-foreground">{chapter.name}</span>
          </div>

          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">{subject.name}</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tighter flex items-center gap-3">
            {chapter.name}
            {chapter.requires_enrollment && <Lock className="w-6 h-6 text-warning" />}
          </h1>
          {chapter.description && <p className="text-foreground-dim mt-3 max-w-2xl">{chapter.description}</p>}
        </div>
      </div>

      <div className="container py-8 flex flex-col flex-1 pb-20 max-h-[1000px]">
        {/* Toolbar */}
        {(!chapter.requires_enrollment || hasChapterAccess) && chapter.videos.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4 mb-4 bg-background-elevated p-3 rounded-2xl border border-border items-center">
            <p className="text-sm font-medium pl-2 whitespace-nowrap">{displayedVideos.length} videos</p>
            
            <div className="flex-1 w-full relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                <Input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search videos..."
                    className="pl-9 bg-background h-9 border-border text-sm"
                />
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setSortOrder(v => v === "asc" ? "desc" : "asc")} className="text-foreground-muted hover:text-foreground flex-1 sm:flex-none">
                <ArrowUpDown className="w-4 h-4 mr-2" /> Sort {sortOrder === "asc" ? "↑" : "↓"}
              </Button>
            </div>
          </div>
        )}

        {chapter.requires_enrollment && hasChapterAccess === null ? (
          <div className="space-y-2 max-w-md mx-auto mt-8 w-full">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-10 w-2/3 mx-auto rounded-full" />
          </div>
        ) : chapter.requires_enrollment && hasChapterAccess === false ? (
          <div className="rounded-2xl p-10 bg-gradient-card border border-warning/30 text-center max-w-md mx-auto mt-8 w-full">
            <div className="w-14 h-14 rounded-full bg-warning/10 border border-warning/30 flex items-center justify-center mx-auto mb-5">
              <Lock className="w-6 h-6 text-warning" />
            </div>
            <h2 className="font-display text-xl font-bold mb-2 font-bangla">প্রিমিয়াম অধ্যায়</h2>
            <p className="text-foreground-dim mb-6 text-sm font-bangla">
              এই অধ্যায়টি আনলক করতে আপনার এনরোলমেন্ট কোড লিখুন।
            </p>
            <Button onClick={() => setShowCodeModal(true)} className="rounded-full bg-primary hover:bg-primary-glow shadow-glow font-bangla">
              <KeyRound className="w-4 h-4 mr-2" /> কোড দিয়ে আনলক করুন
            </Button>
          </div>
        ) : chapter.videos.length === 0 ? (
          <p className="text-foreground-muted mt-8 text-center">No videos in this chapter yet.</p>
        ) : displayedVideos.length === 0 && searchQuery ? (
          <p className="text-foreground-muted mt-8 text-center">No videos match your search.</p>
        ) : (
          <div className="flex-1 w-full max-w-5xl mx-auto overflow-hidden">
             <VirtualVideoList videos={displayedVideos} />
          </div>
        )}
      </div>

      {isDesktop ? (
        <Dialog open={showCodeModal} onOpenChange={setShowCodeModal}>
          <DialogContent className="glass-strong border-border">
            <DialogHeader><DialogTitle className="font-bangla">এনরোলমেন্ট কোড লিখুন</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input
                aria-label="Enrollment Code / এনরোলমেন্ট কোড"
                value={code}
                onChange={e => setCode(formatCode(e.target.value))}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                className="h-14 font-mono tracking-widest text-center text-lg"
              />
              <Button onClick={redeem} disabled={busy} className="min-h-[44px] w-full rounded-full bg-primary hover:bg-primary-glow font-semibold shadow-glow font-bangla">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "কোড দিয়ে আনলক করুন"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={showCodeModal} onOpenChange={setShowCodeModal}>
          <DrawerContent className="bg-background-elevated border-t-border">
            <DrawerHeader className="text-left">
              <DrawerTitle className="font-bangla text-xl">এনরোলমেন্ট কোড লিখুন</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 mb-4 space-y-4">
              <Input
                aria-label="Enrollment Code / এনরোলমেন্ট কোড"
                value={code}
                onChange={e => setCode(formatCode(e.target.value))}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                className="h-14 font-mono tracking-widest text-center text-lg"
              />
              <Button onClick={redeem} disabled={busy} className="min-h-[44px] w-full rounded-full bg-primary hover:bg-primary-glow font-semibold shadow-glow font-bangla">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "কোড দিয়ে আনলক করুন"}
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
