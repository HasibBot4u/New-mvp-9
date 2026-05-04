import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, RotateCw, StickyNote, ChevronDown, ChevronUp } from "lucide-react";
import { useSwipeable } from "react-swipeable";
import { useCatalog } from "@/contexts/CatalogContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useVideoProgress } from "@/hooks/useVideoProgress";
import { trackEvent } from "@/lib/analytics";

import { ProtectedPlayer } from "@/components/video/ProtectedPlayer";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;
if (!API_BASE) throw new Error("VITE_API_BASE_URL is required but not set in environment variables");

type SourceKind = "youtube" | "drive" | "telegram";

function getVideoSource(video: any): { type: SourceKind; url: string; poster?: string } {
  if (video.source_type === "youtube" && (video.youtube_video_id || video.youtube_id)) {
    const id = video.youtube_video_id ?? video.youtube_id;
    return { type: "youtube", url: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1` };
  }
  if (video.source_type === "drive" && video.drive_file_id) {
    return { type: "drive", url: `https://drive.google.com/file/d/${video.drive_file_id}/preview` };
  }
  // Use direct MP4 stream endpoint for Telegram Source
  const url = `${API_BASE}/api/stream/${video.id}`;
  return { type: "telegram", url, poster: `${API_BASE}/api/thumbnail/${video.id}` };
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

  const { video, chapter, nextVideoId, prevVideoId } = useMemo(() => {
    let foundVideo: any = null;
    let foundChapter: any = null;
    let next: string | null = null;
    let prev: string | null = null;
    if (catalog && videoId) {
      for (const s of catalog.subjects) {
        for (const cyc of s.cycles) {
          for (const ch of cyc.chapters) {
            for (let i = 0; i < ch.videos.length; i++) {
              if (ch.videos[i].id === videoId) {
                foundVideo = ch.videos[i];
                foundChapter = ch;
                if (i > 0) prev = ch.videos[i - 1].id;
                if (i < ch.videos.length - 1) next = ch.videos[i + 1].id;
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
    return { video: foundVideo, chapter: foundChapter, nextVideoId: next, prevVideoId: prev };
  }, [catalog, videoId]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => { if (nextVideoId) nav(`/watch/${nextVideoId}`, { replace: true }); },
    onSwipedRight: () => { if (prevVideoId) nav(`/watch/${prevVideoId}`, { replace: true }); },
    preventScrollOnSwipe: true,
    trackMouse: false
  });

  const lastTapRef = useRef<number>(0);
  const handleTap = (direction: 'left' | 'right') => (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap confirmed
      if (videoRef.current) {
        if (direction === 'left') {
          videoRef.current.currentTime -= 10;
        } else {
          videoRef.current.currentTime += 10;
        }
      }
      lastTapRef.current = 0; // reset
    } else {
      lastTapRef.current = now;
    }
  };

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

  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

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
    const videoElement = videoRef.current;
    return () => {
      if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
      if (videoElement) {
        try {
          videoElement.pause();
          videoElement.removeAttribute('src');
          videoElement.load();
        } catch (e) {
          console.error("Cleanup error:", e);
        }
      }
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

      <div className="container max-w-6xl py-6" {...swipeHandlers}>
        <div className="rounded-2xl overflow-hidden bg-black border border-border aspect-video relative group" data-watermark={user?.email}>
          {/* Double Tap Areas */}
          {source.type === "telegram" && !errored && (
            <>
              <div 
                className="absolute inset-y-0 left-0 w-1/3 z-10" 
                onClick={handleTap('left')} 
                onTouchStart={handleTap('left')}
              />
              <div 
                className="absolute inset-y-0 right-0 w-1/3 z-10" 
                onClick={handleTap('right')}
                onTouchStart={handleTap('right')}
              />
            </>
          )}

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
          ) : (
            <ProtectedPlayer
              src={source.type === "telegram" ? `${source.url}?token=${sessionToken}` : source.url}
              token={sessionToken || ""}
              onLoadedMetadata={(dur: number) => {
                setDuration(dur);
                trackEvent("video_play", { video_id: video.id, title: video.title });
              }}
              onTimeUpdate={(time: number) => {
                updateProgressHook(time);
              }}
              onEnded={() => {
                trackEvent("video_complete", { video_id: video.id, title: video.title });
                handleVideoEnded();
              }}
              onError={handleVideoError as () => void}
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
            <div className="flex items-center gap-2 mt-4 md:mt-0">
              <span className="text-xs text-foreground-muted font-medium">Speed:</span>
              <div className="flex gap-1">
                {[0.75, 1, 1.25, 1.5, 2].map(speed => (
                  <Button
                    key={speed}
                    variant={playbackSpeed === speed ? "default" : "ghost"}
                    size="sm"
                    className={playbackSpeed === speed ? "bg-primary text-primary-foreground" : ""}
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.playbackRate = speed;
                        setPlaybackSpeed(speed);
                      }
                    }}
                  >
                    {speed}x
                  </Button>
                ))}
              </div>
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
