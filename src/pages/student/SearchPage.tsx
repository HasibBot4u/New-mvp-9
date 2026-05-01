import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, BookOpen, FolderOpen, PlayCircle } from "lucide-react";
import { useCatalog } from "@/contexts/CatalogContext";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Hit {
  kind: "subject" | "chapter" | "video";
  id: string;
  title: string;
  title_bn?: string | null;
  href: string;
  subtitle?: string;
}

export default function SearchPage() {
  const { catalog, isLoading } = useCatalog();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { subjects, chapters, videos } = useMemo(() => {
    const subjects: Hit[] = [];
    const chapters: Hit[] = [];
    const videos: Hit[] = [];
    if (!catalog || debounced.length < 2) return { subjects, chapters, videos };
    const needle = debounced.toLowerCase();
    catalog.subjects.forEach(s => {
      if (s.name.toLowerCase().includes(needle) || (s.name_bn ?? "").toLowerCase().includes(needle)) {
        subjects.push({ kind: "subject", id: s.id, title: s.name, title_bn: s.name_bn, href: `/subject/${s.slug}` });
      }
      s.cycles.forEach(c => c.chapters.forEach(ch => {
        if (ch.name.toLowerCase().includes(needle) || (ch.name_bn ?? "").toLowerCase().includes(needle)) {
          chapters.push({
            kind: "chapter", id: ch.id, title: ch.name, title_bn: ch.name_bn,
            href: `/chapter/${ch.id}`, subtitle: `${s.name} · ${c.name}`,
          });
        }
        ch.videos.forEach(v => {
          if (v.title.toLowerCase().includes(needle) || (v.title_bn ?? "").toLowerCase().includes(needle)) {
            videos.push({
              kind: "video", id: v.id, title: v.title, title_bn: v.title_bn,
              href: `/watch/${v.id}`, subtitle: `${s.name} · ${ch.name}`,
            });
          }
        });
      }));
    });
    return { subjects, chapters: chapters.slice(0, 50), videos: videos.slice(0, 100) };
  }, [catalog, debounced]);

  const totalCount = subjects.length + chapters.length + videos.length;
  const hasQuery = debounced.length >= 2;

  return (
    <div className="container max-w-3xl py-10 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2 font-bangla">খুঁজুন</p>
        <h1 className="font-display text-4xl font-bold tracking-tighter mb-6 font-bangla">পাঠ অনুসন্ধান করুন</h1>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
          <Input
            aria-label="Search content / পাঠ অনুসন্ধান করুন"
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="বিষয়, অধ্যায় বা ভিডিও..."
            className="pl-12 h-14 text-lg font-bangla"
          />
        </div>
      </div>

      {hasQuery && (
        <p className="text-xs text-foreground-muted font-bangla">{totalCount} টি ফলাফল</p>
      )}

      {isLoading && (
        <div className="rounded-2xl p-12 bg-background-elevated border border-border text-center">
          <p className="font-bangla text-foreground-dim">ক্যাটালগ লোড হচ্ছে...</p>
        </div>
      )}

      {!isLoading && hasQuery && totalCount === 0 ? (
        <div className="rounded-2xl p-12 bg-background-elevated border border-border text-center">
          <p className="font-bangla text-foreground-dim">কোনো ফলাফল পাওয়া যায়নি</p>
        </div>
      ) : hasQuery ? (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid grid-cols-4 w-full bg-background-elevated">
            <TabsTrigger value="all">সব ({totalCount})</TabsTrigger>
            <TabsTrigger value="subjects" className="font-bangla">বিষয় ({subjects.length})</TabsTrigger>
            <TabsTrigger value="chapters" className="font-bangla">অধ্যায় ({chapters.length})</TabsTrigger>
            <TabsTrigger value="videos" className="font-bangla">ভিডিও ({videos.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4 space-y-2">
            {[...subjects, ...chapters, ...videos].map(h => <Row key={h.kind + h.id} hit={h} />)}
          </TabsContent>
          <TabsContent value="subjects" className="mt-4 space-y-2">
            {subjects.map(h => <Row key={h.id} hit={h} />)}
          </TabsContent>
          <TabsContent value="chapters" className="mt-4 space-y-2">
            {chapters.map(h => <Row key={h.id} hit={h} />)}
          </TabsContent>
          <TabsContent value="videos" className="mt-4 space-y-2">
            {videos.map(h => <Row key={h.id} hit={h} />)}
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}

function Row({ hit }: { hit: Hit }) {
  const Icon = hit.kind === "subject" ? FolderOpen : hit.kind === "chapter" ? BookOpen : PlayCircle;
  return (
    <Link
      to={hit.href}
      className="flex items-center gap-3 p-4 rounded-xl bg-background-elevated border border-border hover:border-primary/40 transition-colors"
    >
      <Icon className="w-5 h-5 text-primary shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{hit.title}</p>
        {hit.title_bn && <p className="font-bangla text-xs text-foreground-muted truncate">{hit.title_bn}</p>}
        {hit.subtitle && <p className="text-xs text-foreground-muted mt-0.5 truncate">{hit.subtitle}</p>}
      </div>
    </Link>
  );
}
