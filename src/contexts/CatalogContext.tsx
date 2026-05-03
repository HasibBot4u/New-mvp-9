import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Subject, Cycle, Chapter, Video } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

export interface CatalogChapter extends Chapter { videos: Video[]; }
export interface CatalogCycle extends Cycle { chapters: CatalogChapter[]; }
export interface CatalogSubject extends Subject { cycles: CatalogCycle[]; }
export interface Catalog { subjects: CatalogSubject[]; totalVideos: number; videoMap: Map<string, Video>; }

interface Ctx {
  catalog: Catalog | null;
  videoMap: Map<string, Video> | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const CatalogCtx = createContext<Ctx | undefined>(undefined);
const sb = supabase as any;

// Map raw DB rows (real columns) into the typed shape used by the app.
const mapSubject = (r: any): Subject => ({
  id: r.id, name: r.name, name_bn: r.name_bn, slug: r.slug,
  icon: r.icon ?? null, color: r.color ?? null,
  display_order: r.display_order ?? 0, is_active: r.is_active,
  created_at: r.created_at,
} as Subject);
const mapCycle = (r: any): Cycle => ({
  id: r.id, subject_id: r.subject_id, name: r.name, name_bn: r.name_bn,
  display_order: r.display_order ?? 0, is_active: r.is_active,
} as Cycle);
const mapChapter = (r: any): Chapter => ({
  id: r.id, cycle_id: r.cycle_id, name: r.name, name_bn: r.name_bn,
  description: r.description,
  requires_enrollment: !!r.requires_enrollment,
  display_order: r.display_order ?? 0, is_active: r.is_active,
} as Chapter);
const mapVideo = (r: any): Video => ({
  id: r.id, chapter_id: r.chapter_id, title: r.title, title_bn: r.title_bn,
  source_type: r.source_type,
  youtube_video_id: r.youtube_video_id ?? null,
  drive_file_id: r.drive_file_id,
  duration: typeof r.duration === "string" ? r.duration : (r.duration ? String(r.duration) : undefined),
  thumbnail_url: r.thumbnail_url,
  display_order: r.display_order ?? 0, is_active: r.is_active,
  size_mb: r.size_mb ?? null,
} as Video);

const fetchCatalog = async () => {
  const [s, c, ch, v] = await Promise.all([
    sb.from("subjects").select("id, name, name_bn, slug, icon, color, display_order, is_active").eq("is_active", true).order("display_order"),
    sb.from("cycles").select("id, subject_id, name, name_bn, display_order, is_active").eq("is_active", true).order("display_order"),
    sb.from("chapters").select("id, cycle_id, name, name_bn, description, requires_enrollment, display_order, is_active").eq("is_active", true).order("display_order"),
    sb.from("videos").select("id, chapter_id, title, title_bn, source_type, youtube_video_id, drive_file_id, duration, size_mb, thumbnail_url, display_order, is_active").eq("is_active", true).order("display_order"),
  ]);
  if (s.error || c.error || ch.error || v.error) {
    throw s.error || c.error || ch.error || v.error;
  }
  const subjects = (s.data ?? []).map(mapSubject);
  const cycles = (c.data ?? []).map(mapCycle);
  const chapters = (ch.data ?? []).map(mapChapter);
  const videos = (v.data ?? []).map(mapVideo);

  const videosByChapter = new Map<string, Video[]>();
  for (const vi of videos) {
    const arr = videosByChapter.get(vi.chapter_id) || [];
    arr.push(vi);
    videosByChapter.set(vi.chapter_id, arr);
  }

  const chaptersByCycle = new Map<string, CatalogChapter[]>();
  for (const cp of chapters) {
    const arr = chaptersByCycle.get(cp.cycle_id) || [];
    arr.push({ ...cp, videos: videosByChapter.get(cp.id) || [] });
    chaptersByCycle.set(cp.cycle_id, arr);
  }

  const cyclesBySubject = new Map<string, CatalogCycle[]>();
  for (const cy of cycles) {
    const arr = cyclesBySubject.get(cy.subject_id) || [];
    arr.push({ ...cy, chapters: chaptersByCycle.get(cy.id) || [] });
    cyclesBySubject.set(cy.subject_id, arr);
  }

  const built: CatalogSubject[] = subjects.map((subj: Subject) => ({
    ...subj,
    cycles: cyclesBySubject.get(subj.id) || []
  }));
  
  const videoMap = new Map<string, Video>();
  for (const vi of videos) {
    videoMap.set(vi.id, vi);
  }

  return { subjects: built, totalVideos: videos.length, videoMap } as Catalog;
};

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { isLoading: authLoading } = useAuth();

  const { data: catalog = null, isLoading: isCatalogLoading, error: queryError, refetch } = useQuery({
    queryKey: ['catalog'],
    queryFn: fetchCatalog,
    staleTime: 5 * 60 * 1000,
    enabled: !authLoading
  });

  const isLoading = authLoading || isCatalogLoading;
  const error = queryError ? (queryError as any).message ?? "Failed to load catalog" : null;
  
  const refresh = async () => {
    await refetch();
  };

  const videoMap = catalog?.videoMap ?? null;

  return <CatalogCtx.Provider value={{ catalog, videoMap, isLoading, error, refresh }}>{children}</CatalogCtx.Provider>;
}

export function useCatalog() {
  const v = useContext(CatalogCtx);
  if (!v) throw new Error("useCatalog must be used inside <CatalogProvider>");
  return v;
}
