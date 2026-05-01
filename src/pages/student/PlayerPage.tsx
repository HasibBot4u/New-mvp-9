import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, RotateCw, StickyNote, ChevronDown, ChevronUp } from "lucide-react";
import { useCatalog } from "@/contexts/CatalogContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useVideoProgress } from "@/hooks/useVideoProgress";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

type SourceKind = "youtube" | "drive" | "telegram";

function getVideoSource(video: any): { type: SourceKind; url: string } {
  if (video.source_type === "youtube" && (video.youtube_video_id || video.youtube_id)) {
    const id = video.youtube_video_id ?? video.youtube_id;
    return { type: "youtube", url: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1` };
  }
  if (video.source_type === "drive" && video.drive_file_id) {
    return { type: "drive", url: `https://drive.google.com/file/d/${video.drive_file_id}/preview` };
  }
  const url = video.source_url || `${API_BASE}/api/stream/${video.id}`;
  return { type: "telegram", url };
}

export default function PlayerPage() {
  const { videoId } = useParams();
  const { catalog, isLoading } = useCatalog();
  const { user } = useAuth();
  const nav = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const noteSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [errored, setErrored] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const { video, chapter } = useMemo(() => {
    let foundVideo: any = null;
    let foundChapter: any = null;
    if (catalog && videoId) {
      for (const s of catalog.subjects) {
        for (const cyc of s.cycles) {
          for (const ch of cyc.chapters) {
            for (const vid of ch.videos) {
              if (vid.id === videoId) {
                foundVideo = vid;
                foundChapter = ch;
                break;
              }
            }
            if (foundVideo) break;
          }
          if (foundVideo) break;
        }
        if (foundVideo) break;
      }
    }
    return { video: foundVideo, chapter: foundChapter };
  }, [catalog, videoId]);

  const source = video ? getVideoSource(video) : null;

  const { handleTimeUpdate: updateProgressHook, loadProgressFromSupabase, saveProgressToSupabase } = useVideoProgress(videoId || '', duration);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) {
        setSessionToken(data.session.access_token);
      }
    });
    
    // Subscribe to auth changes (handles token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (newSession?.access_token) {
          setSessionToken(newSession.access_token);
          // Removed manual video source swapping to avoid resetting playback
        }
      }
    );
    
    return () => subscription.unsubscribe();
  }, []);

  // Return early if no video
  // Wake telegram backend up on mount
  useEffect(() => {
    if (source?.type === "telegram") {
      fetch(`${API_BASE}/api/health`).catch(() => {});
    }
  }, [source?.type]);

  const fetchedProgress = useRef(0);

  // Load existing watch progress + notes
  useEffect(() => {
    if (!user || !video) return;
    
    loadProgressFromSupabase().then((progress) => {
      fetchedProgress.current = progress;
      if (videoRef.current && videoRef.current.readyState >= 1 && progress > 0) {
        try { videoRef.current.currentTime = progress; } catch (e) { console.error("Error setting time:", e); }
      }
    });

    (supabase as any).from("video_notes")
      .select("content")
      .eq("user_id", user.id)
      .eq("video_id", video.id)
      .maybeSingle()
      .then(({ data }: any) => { if (data?.content) setNotes(data.content); });
  }, [user, video, loadProgressFromSupabase]);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !user || !video) return;
    updateProgressHook(videoRef.current.currentTime);
  }, [user, video, updateProgressHook]);

  const handleVideoEnded = useCallback(async () => {
    if (!user || !video) return;
    await saveProgressToSupabase(videoRef.current?.duration || 0, videoRef.current?.duration || 0);
  }, [user, video, saveProgressToSupabase]);

  const retryPlayback = useCallback(() => {
    setErrored(false);
    if (videoRef.current) {
      try { videoRef.current.load(); videoRef.current.play().catch(() => {}); } catch (e) { console.error("Retry playback error:", e); }
    }
  }, []);

  const handleVideoError = useCallback(() => {
    setErrored(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in notes textarea
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (!videoRef.current) return;
      
      const v = videoRef.current;
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        if (v.paused) v.play(); else v.pause();
      } else if (e.key === 'ArrowRight' || e.key === 'l') {
        e.preventDefault();
        v.currentTime += 5;
      } else if (e.key === 'ArrowLeft' || e.key === 'j') {
        e.preventDefault();
        v.currentTime -= 5;
      } else if (e.key === 'f') {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          v.requestFullscreen().catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Removed auto retry countdown as per F13

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobLoading, setBlobLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (source?.type === "telegram" && sessionToken && source.url) {
      setBlobLoading(true);
      setBlobUrl(null);
      setErrored(false);
      
      fetch(source.url, {
        headers: {
          "Authorization": `Bearer ${sessionToken}`
        }
      })
      .then(res => {
        if (!res.ok) throw new Error("stream fetch failed");
        return res.blob();
      })
      .then(blob => {
        if (!active) return;
        setBlobUrl(URL.createObjectURL(blob));
        setBlobLoading(false);
      })
      .catch((e) => {
        console.error("Blob load error", e);
        if (active) {
          setErrored(true);
          setBlobLoading(false);
        }
      });
    } else {
      setBlobUrl(null);
    }
    
    return () => {
      active = false;
    };
  }, [source?.url, source?.type, sessionToken]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Notes auto-save (2s after typing pause)
  const onNotesChange = (val: string) => {
    setNotes(val);
    if (!user || !video) return;
    if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
    setNoteSaving(true);
    noteSaveTimeout.current = setTimeout(async () => {
      await (supabase as any).from("video_notes").upsert({
        user_id: user.id,
        video_id: video.id,
        content: val,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,video_id" });
      setNoteSaving(false);
    }, 2000);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
    };
  }, []);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>;
  }
  if (!video || !source) {
    return <div className="min-h-screen flex items-center justify-center text-foreground-muted">Video not found.</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between glass-strong">
        <button onClick={() => nav(-1)} className="inline-flex items-center gap-2 text-sm text-foreground-dim hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <Link to={`/chapter/${chapter?.id}`} className="text-xs text-foreground-muted hover:text-foreground truncate max-w-[60%]">
          {chapter?.name}
        </Link>
      </div>

      <div className="container max-w-6xl py-6">
        <div className="rounded-2xl overflow-hidden bg-black border border-border aspect-video relative">
          {source.type === "youtube" || source.type === "drive" ? (
            <iframe
              className="w-full h-full"
              src={source.url}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : errored ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="rounded-2xl glass-strong border border-border p-8 max-w-md text-center">
                <p className="font-bangla text-foreground mb-3">
                  ভিডিও লোড হচ্ছে না। ব্যাকএন্ড সার্ভার চালু হতে কিছু সময় লাগছে।
                </p>
                <Button onClick={retryPlayback} className="rounded-full bg-primary hover:bg-primary-glow shadow-glow mt-2">
                  <RotateCw className="w-4 h-4 mr-2" /> আবার চেষ্টা করুন
                </Button>
              </div>
            </div>
          ) : blobLoading || (!blobUrl && source.type === "telegram") ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="font-bangla text-foreground-muted">ভিডিও লোড হচ্ছে...</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={source.type === "telegram" ? blobUrl! : source.url}
              controls
              autoPlay
              preload="auto"
              className="w-full h-full"
              onLoadedMetadata={() => {
                setDuration(videoRef.current?.duration || 0);
                if (fetchedProgress.current > 0 && videoRef.current) {
                  try { videoRef.current.currentTime = fetchedProgress.current; } catch (e) { console.error("Could not seek to resume position", e); }
                }
              }}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
              onError={handleVideoError}
            />
          )}
        </div>

        <div className="mt-6 flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{video.title}</h1>
            {video.title_bn && <p className="font-bangla text-foreground-dim mt-1">{video.title_bn}</p>}
            {video.description && <p className="text-foreground-dim mt-4 max-w-3xl">{video.description}</p>}
          </div>
          {source.type !== 'youtube' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground-muted font-medium">Speed:</span>
              <select 
                className="bg-surface border border-border rounded-lg text-sm px-2 py-1 focus:outline-none focus:border-primary"
                onChange={(e) => {
                  if (videoRef.current) videoRef.current.playbackRate = parseFloat(e.target.value);
                }}
                defaultValue="1"
              >
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1">1x (Normal)</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
              </select>
            </div>
          )}
        </div>

        {/* Notes panel */}
        <div className="mt-8 rounded-2xl bg-background-elevated border border-border overflow-hidden">
          <button
            onClick={() => setNotesOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-background-overlay transition-colors"
          >
            <span className="flex items-center gap-2 font-medium">
              <StickyNote className="w-4 h-4 text-primary" />
              <span className="font-bangla">নোট লিখুন</span>
              {noteSaving && <Loader2 className="w-3 h-3 animate-spin text-foreground-muted ml-2" />}
            </span>
            {notesOpen ? <ChevronUp className="w-4 h-4 text-foreground-muted" /> : <ChevronDown className="w-4 h-4 text-foreground-muted" />}
          </button>
          {notesOpen && (
            <div className="p-5 border-t border-border">
              <Textarea
                value={notes}
                onChange={e => onNotesChange(e.target.value)}
                placeholder="এই ভিডিও সম্পর্কে আপনার নোট এখানে লিখুন..."
                className="font-bangla min-h-[160px] bg-background border-border focus:border-primary"
                maxLength={5000}
              />
              <p className="text-xs text-foreground-muted mt-2 text-right">{notes.length} / 5000</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
