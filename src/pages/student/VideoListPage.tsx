import { useState, useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, PlayCircle, Clock, KeyRound, Loader2, LayoutGrid, List as ListIcon, Filter, ArrowUpDown } from "lucide-react";
import { useCatalog } from "@/contexts/CatalogContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { Skeleton } from "@/components/ui/skeleton";
import { LazyImage } from "@/components/ui/LazyImage";
import { getThumbnailUrl } from "@/lib/thumbnails";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export default function VideoListPage() {
  const { chapterId } = useParams();
  const { catalog, isLoading } = useCatalog();
  const { toast } = useToast();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

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

  if (isLoading) return (
    <div className="container py-20 space-y-4">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="space-y-4 mt-8">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    </div>
  );
  if (!chapter) return <Navigate to="/dashboard" replace />;

  const displayedVideos = [...(chapter.videos || [])].sort((a, b) => {
    if (sortOrder === "asc") return a.display_order - b.display_order;
    return b.display_order - a.display_order;
  });

  return (
    <div>
      <div className="border-b border-border">
        <div className="container py-10">
          {/* Breadcrumb */}
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

      <div className="container py-10 space-y-4">
        {/* Toolbar */}
        {(!chapter.requires_enrollment || hasChapterAccess) && chapter.videos.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 bg-background-elevated p-3 rounded-2xl border border-border">
            <p className="text-sm font-medium pl-2">{chapter.videos.length} videos</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSortOrder(v => v === "asc" ? "desc" : "asc")} className="text-foreground-muted hover:text-foreground">
                <ArrowUpDown className="w-4 h-4 mr-2" /> Sort {sortOrder === "asc" ? "↑" : "↓"}
              </Button>
              <Button variant="ghost" size="sm" className="hidden sm:flex text-foreground-muted hover:text-foreground">
                <Filter className="w-4 h-4 mr-2" /> Filter
              </Button>
              <div className="flex bg-background border border-border rounded-lg overflow-hidden p-0.5 ml-2">
                <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-foreground-muted hover:text-foreground"}`}>
                  <ListIcon className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-foreground-muted hover:text-foreground"}`}>
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {chapter.requires_enrollment && hasChapterAccess === null ? (
          <div className="space-y-2 max-w-md mx-auto mt-8">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-10 w-2/3 mx-auto rounded-full" />
          </div>
        ) : chapter.requires_enrollment && hasChapterAccess === false ? (
          <div className="rounded-2xl p-10 bg-gradient-card border border-warning/30 text-center max-w-md mx-auto mt-8">
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
          <p className="text-foreground-muted mt-8">No videos in this chapter yet.</p>
        ) : (
          <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-2"}>
            {displayedVideos.map((v: any, i: number) => {
              if (viewMode === "grid") {
                 return (
                    <motion.div key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.025 }}>
                      <Link to={`/watch/${v.id}`} className="block group">
                        <div className="aspect-video rounded-xl bg-gradient-card border border-border flex items-center justify-center overflow-hidden relative mb-3">
                          <LazyImage src={getThumbnailUrl(v)} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" fallbackSrc="/placeholder-video.jpg" />
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <PlayCircle className="w-10 h-10 text-white/80 group-hover:text-white transition-colors drop-shadow-md" />
                          </div>
                          <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-white">{v.duration || "—"}</div>
                        </div>
                        <p className="text-xs text-foreground-muted mb-1">Lesson {String(i + 1).padStart(2, "0")}</p>
                        <p className="font-semibold line-clamp-2">{v.title}</p>
                      </Link>
                    </motion.div>
                 );
              }

              return (
                <motion.div key={v.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.025 }}
                >
                  <Link to={`/watch/${v.id}`}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-background-elevated border border-border hover:border-primary/40 transition-colors group"
                  >
                    <div className="w-32 aspect-video rounded-lg bg-gradient-card border border-border flex items-center justify-center shrink-0 overflow-hidden relative">
                      <LazyImage src={getThumbnailUrl(v)} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" fallbackSrc="/placeholder-video.jpg" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <PlayCircle className="w-7 h-7 text-white/80 group-hover:text-white transition-colors drop-shadow-md" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground-muted">Lesson {String(i + 1).padStart(2, "0")}</p>
                      <p className="font-medium truncate">{v.title}</p>
                      {v.title_bn && <p className="font-bangla text-xs text-foreground-muted truncate">{v.title_bn}</p>}
                    </div>
                    <div className="hidden sm:flex items-center gap-1 text-xs text-foreground-muted shrink-0">
                      <Clock className="w-3.5 h-3.5" /> {v.duration ?? "—"}
                    </div>
                  </Link>
                </motion.div>
              );
            })}
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
