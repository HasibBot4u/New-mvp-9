import { useEffect, useMemo, useState } from "react";
import { Flame, Clock, CheckCircle2, Pin, Calendar, Radio, Atom, FlaskConical, Sigma } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCatalog } from "@/contexts/CatalogContext";
import { format } from "date-fns";

const IconMap: Record<string, React.ElementType> = {
  Atom: Atom,
  FlaskConical: FlaskConical,
  Calculator: Sigma, // Let's use Sigma for math
  Sigma: Sigma
};

interface ContinueRow {
  video_id: string;
  progress_seconds: number;
  updated_at: string;
  videos: {
    id: string; title: string; thumbnail_url: string | null;
    duration: string | null;
    chapters?: { name: string } | null;
  } | null;
}
interface AnnouncementRow {
  id: string; title: string; title_bn: string | null; body: string | null; body_bn: string | null;
  is_pinned: boolean; created_at: string; type: string;
}
interface LiveRow {
  id: string; title: string; title_bn: string | null; scheduled_at: string;
  meeting_url: string | null; stream_url: string | null;
}

const sb = supabase as any;

function parseDur(s: string | null): number {
  if (!s) return 0;
  const p = s.split(":").map(Number); if (p.some(isNaN)) return 0;
  if (p.length === 3) return p[0]*3600 + p[1]*60 + p[2];
  if (p.length === 2) return p[0]*60 + p[1];
  return p[0] ?? 0;
}
function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h} ঘণ্টা ${m} মিনিট`;
}

import { SubjectCard } from "@/components/cards/SubjectCard";
import { VideoCard } from "@/components/cards/VideoCard";

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const { catalog } = useCatalog();
  const [streak, setStreak] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [continueWatching, setContinueWatching] = useState<ContinueRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [liveClasses, setLiveClasses] = useState<LiveRow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Stats
      const [hist, cw, ann, live] = await Promise.all([
        sb.from("watch_history").select("watched_at, progress_seconds, completed").eq("user_id", user.id).limit(1000),
        sb.from("watch_history")
          .select("video_id, progress_seconds, updated_at, videos(id, title, thumbnail_url, duration, chapters(name))")
          .eq("user_id", user.id).eq("completed", false).gt("progress_seconds", 0)
          .order("updated_at", { ascending: false }).limit(6),
        sb.from("announcements").select("*").eq("is_active", true)
          .order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(3),
        sb.from("live_classes").select("id, title, title_bn, scheduled_at, meeting_url, stream_url")
          .eq("is_active", true).gt("scheduled_at", new Date().toISOString())
          .order("scheduled_at").limit(3),
      ]);

      const allHist = (hist.data ?? []) as { watched_at: string; progress_seconds: number; completed: boolean }[];
      setTotalSeconds(allHist.reduce((s, r) => s + (r.progress_seconds ?? 0), 0));
      setCompleted(allHist.filter(r => r.completed).length);

      // Streak: count consecutive days back from today/yesterday
      const dates = new Set(allHist.map(r => format(new Date(r.watched_at), "yyyy-MM-dd")));
      let s = 0;
      const today = new Date();
      const todayKey = format(today, "yyyy-MM-dd");
      const yKey = format(new Date(today.getTime() - 86400000), "yyyy-MM-dd");
      let cursor = dates.has(todayKey) ? today : (dates.has(yKey) ? new Date(today.getTime() - 86400000) : null);
      while (cursor) {
        const k = format(cursor, "yyyy-MM-dd");
        if (dates.has(k)) { s++; cursor = new Date(cursor.getTime() - 86400000); }
        else break;
      }
      setStreak(s);

      setContinueWatching((cw.data ?? []) as ContinueRow[]);
      setAnnouncements((ann.data ?? []) as AnnouncementRow[]);
      setLiveClasses((live.data ?? []) as LiveRow[]);
    })();
  }, [user]);

  const subjectsWithCounts = useMemo(() => {
    if (!catalog) return [];
    return catalog.subjects.map(s => ({
      ...s,
      videoCount: s.cycles.reduce((a, c) => a + c.chapters.reduce((b, ch) => b + ch.videos.length, 0), 0),
    }));
  }, [catalog]);

  const now = Date.now();

  return (
    <div className="space-y-10">
      {/* Welcome */}
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-primary">শুভেচ্ছা</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold">
          আবার স্বাগতম, {profile?.display_name || "শিক্ষার্থী"}!
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
          <Stat icon={<Flame className="w-4 h-4 text-warning" />} label="স্ট্রিক" value={`${streak} দিন`} />
          <Stat icon={<Clock className="w-4 h-4 text-info" />} label="দেখার সময়" value={formatHM(totalSeconds)} />
          <Stat icon={<CheckCircle2 className="w-4 h-4 text-success" />} label="সম্পন্ন" value={`${completed}`} />
        </div>
      </header>

      {/* Continue watching */}
      {continueWatching.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">চালিয়ে যান</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {continueWatching.map(row => {
              const v = row.videos; if (!v) return null;
              const dur = parseDur(v.duration);
              const pct = dur > 0 ? Math.min(100, Math.round((row.progress_seconds / dur) * 100)) : 0;
              return (
                <VideoCard
                  key={row.video_id}
                  id={v.id}
                  title={v.title}
                  thumbnailUrl={v.thumbnail_url}
                  duration={v.duration}
                  progressPercent={pct}
                  chapterName={v.chapters?.name}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Subjects */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">বিষয়সমূহ</h2>
        {subjectsWithCounts.length === 0 ? (
          <p className="text-foreground-muted text-sm">এখনো কোনো বিষয় নেই।</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {subjectsWithCounts.map(s => {
              const DynamicIcon = s.icon && IconMap[s.icon] ? IconMap[s.icon] : null;
              const IconComp = DynamicIcon ? <DynamicIcon className="w-8 h-8" /> : <span>📚</span>;
              return (
                <SubjectCard
                  key={s.id}
                  to={`/subject/${s.slug}`}
                  icon={IconComp}
                  title={s.name_bn ?? s.name}
                  subtitle={`${s.videoCount} ভিডিও`}
                />
              )
            })}
          </div>
        )}
      </section>

      {/* Announcements */}
      {announcements.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">ঘোষণা</h2>
          <div className="space-y-3">
            {announcements.map(a => (
              <div key={a.id} className="rounded-2xl border border-white/5 bg-surface p-5">
                <div className="flex items-start gap-3">
                  {a.is_pinned && <Pin className="w-4 h-4 text-warning shrink-0 mt-1" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold">{a.title_bn ?? a.title}</p>
                    {(a.body_bn ?? a.body) && <p className="text-sm text-foreground-dim mt-1">{a.body_bn ?? a.body}</p>}
                    <p className="text-[11px] text-foreground-muted mt-2">{format(new Date(a.created_at), "dd MMM yyyy")}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming live */}
      {liveClasses.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">আসন্ন লাইভ ক্লাস</h2>
          <div className="space-y-3">
            {liveClasses.map(l => {
              const start = new Date(l.scheduled_at).getTime();
              const canJoin = start - now <= 15 * 60 * 1000;
              const url = l.meeting_url ?? l.stream_url ?? null;
              return (
                <div key={l.id} className="rounded-2xl border border-white/5 bg-surface p-5 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-3 rounded-xl bg-destructive/15 text-destructive shrink-0"><Radio className="w-5 h-5" /></div>
                    <div className="min-w-0">
                      <p className="font-display font-semibold truncate">{l.title_bn ?? l.title}</p>
                      <p className="text-xs text-foreground-muted inline-flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" /> {format(new Date(l.scheduled_at), "dd MMM, HH:mm")}
                      </p>
                    </div>
                  </div>
                  {canJoin && url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="px-4 h-9 rounded-full bg-primary text-primary-foreground hover:bg-primary-glow text-sm font-medium inline-flex items-center">
                      যোগ দিন
                    </a>
                  ) : (
                    <span className="text-xs text-foreground-muted">শীঘ্রই শুরু</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-surface p-3">
      <div className="flex items-center gap-2">{icon}<span className="text-[11px] text-foreground-muted uppercase tracking-wider">{label}</span></div>
      <p className="font-display font-bold mt-1 text-sm md:text-base">{value}</p>
    </div>
  );
}
