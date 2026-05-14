import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, RotateCw, StickyNote, ChevronDown, ChevronUp } from "lucide-react";
import { useSwipeable } from "react-swipeable";
import { useCatalog } from "@/contexts/CatalogContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBatchProgress } from "@/hooks/useBatchProgress";
import { trackEvent } from "@/lib/analytics";
import { logActivity } from "@/lib/activityLogger";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://nexusedu-backend-0bjq.onrender.com";
if (!API_BASE) throw new Error("VITE_API_BASE_URL is required but not set in environment variables");

type SourceKind = "youtube" | "drive" | "telegram";

interface VideoSource {
  type: SourceKind;
  url: string;
  poster?: string;
}

interface VideoData {
  id: string;
  title: string;
  title_bn?: string;
  description?: string;
  source_type?: string;
  youtube_video_id?: string;
  youtube_id?: string;
  drive_file_id?: string;
}

interface ChapterData {
  id: string;
  name: string;
}

function getVideoSource(video: VideoData): VideoSource {
  if (video.source_type === "youtube" && (video.youtube_video_id || video.youtube_id)) {
    const id = video.youtube_video_id ?? video.youtube_id;
    return { 
      type: "youtube", 
      url: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1` 
    };
  }
  if (video.source_type === "drive" && video.drive_file_id) {
    return { 
      type: "drive", 
      url: `https://drive.google.com/file/d/${video.drive_file_id}/preview` 
    };
  }
  // Use direct MP4 stream endpoint for Telegram Source
  const url = `${API_BASE}/api/stream/${video.id}`;
  return { 
    type: "telegram", 
    url, 
    poster: `${API_BASE}/api/thumbnail/${video.id}` 
  };
}

export default function PlayerPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const { catalog, isLoading } = useCatalog();
  const { user } = useAuth();
  const nav = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const noteSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressFlushTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedProgress = useRef(0);
  const wasPlayingBeforeHidden = useRef(false);

  const [errored, setErrored] = useState(false);
  const [errorType, setErrorType] = useState<"403" | "404" | "network" | "unknown" | null>(null);
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const { video, chapter, nextVideoId, prevVideoId } = useMemo(() => {
    let foundVideo: VideoData | null = null;
    let foundChapter: ChapterData | null = null;
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
      if (videoRef.current) {
        if (direction === 'left') {
          videoRef.current.currentTime -= 10;
        } else {
          videoRef.current.currentTime += 10;
        }
      }
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const source = video ? getVideoSource(video) : null;

  const { updateProgress, flush } = useBatchProgress();

  // Session token management
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session?.access_token) {
        setSessionToken(data.session.access_token);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;
        if (newSession?.access_token) {
          setSessionToken(newSession.access_token);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Wake telegram backend up on mount
  useEffect(() => {
    if (source?.type === "telegram") {
      const controller = new AbortController();
      fetch(`${API_BASE}/api/health`, { signal: controller.signal }).catch(() => {});
      return () => controller.abort();
    }
  }, [source?.type]);

  // Load existing watch progress + notes
  const loadProgressFromSupabase = useCallback(async () => {
    if (!user || !video) return 0;
    try {
      const { data, error } = await supabase
        .from('watch_history')
        .select('progress_seconds')
        .eq('user_id', user.id)
        .eq('video_id', video.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') {
        console.error('Error loading progress:', error);
        return 0;
      }
      return data?.progress_seconds || 0;
    } catch (e) {
      console.error('Exception loading progress:', e);
      return 0;
    }
  }, [user, video]);

  useEffect(() => {
    if (!user || !video) return;
    let mounted = true;

    loadProgressFromSupabase().then((progress) => {
      if (!mounted) return;
      fetchedProgress.current = progress;
      if (videoRef.current && videoRef.current.readyState >= 1 && progress > 0) {
        try { 
          videoRef.current.currentTime = progress; 
        } catch (e) { 
          console.error("Error setting time:", e); 
        }
      }
    });

    (supabase as any).from("video_notes")
      .select("content")
      .eq("user_id", user.id)
      .eq("video_id", video.id)
      .maybeSingle()
      .then(({ data }: any) => { 
        if (!mounted) return;
        if (data?.content) setNotes(data.content); 
      });

    return () => { mounted = false; };
  }, [user, video, loadProgressFromSupabase]);

  // Visibility API - pause when tab hidden, resume when visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      const v = videoRef.current;
      if (!v) return;
      if (document.hidden) {
        wasPlayingBeforeHidden.current = !v.paused;
        if (!v.paused) {
          v.pause();
          flush(); // Save progress when user leaves tab
        }
      } else {
        if (wasPlayingBeforeHidden.current && v.paused) {
          v.play().catch(() => {});
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [flush]);

  // Save progress on page close/navigate away
  useEffect(() => {
    const handleBeforeUnload = () => {
      flush();
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    };
    const handlePageHide = () => {
      flush();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [flush]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (!videoRef.current) return;
      const v = videoRef.current;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          v.paused ? v.play() : v.pause();
          break;
        case 'ArrowRight':
        case 'l':
          e.preventDefault();
          v.currentTime += 5;
          break;
        case 'ArrowLeft':
        case 'j':
          e.preventDefault();
          v.currentTime -= 5;
          break;
        case 'f':
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            v.requestFullscreen().catch(() => {});
          }
          break;
        case 'm':
          e.preventDefault();
          v.muted = !v.muted;
          break;
        case 'ArrowUp':
          e.preventDefault();
          v.volume = Math.min(1, v.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          v.volume = Math.max(0, v.volume - 0.1);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleVideoEnded = useCallback(() => {
    if (!user || !video) return;
    if (videoRef.current) {
      updateProgress(video.id, videoRef.current.duration, videoRef.current.duration);
      flush();
    }
  }, [user, video, updateProgress, flush]);

  const retryPlayback = useCallback(() => {
    setErrored(false);
    setErrorType(null);
    if (videoRef.current) {
      try { 
        videoRef.current.load(); 
        videoRef.current.play().catch(() => {}); 
      } catch (e) { 
        console.error("Retry playback error:", e); 
      }
    }
  }, []);

  const handleVideoError = useCallback(async () => {
    setErrored(true);
    if (source?.type === "telegram" && sessionToken) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const checkUrl = `${source.url}?token=${encodeURIComponent(sessionToken)}`;
        const res = await fetch(checkUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.status === 401 || res.status === 403) setErrorType("403");
        else if (res.status === 404) setErrorType("404");
        else setErrorType("unknown");
      } catch (err) {
        clearTimeout(timeoutId);
        setErrorType("network");
      }
    } else {
      setErrorType("unknown");
    }
  }, [source, sessionToken]);

  // Notes auto-save (2s after typing pause)
  const onNotesChange = (val: string) => {
    setNotes(val);
    if (!user || !video) return;
    if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
    setNoteSaving(true);
    noteSaveTimeout.current = setTimeout(async () => {
      try {
        await (supabase as any).from("video_notes").upsert({
          user_id: user.id,
          video_id: video.id,
          content: val,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,video_id" });
      } catch (e) {
        console.error("Notes save error:", e);
      } finally {
        setNoteSaving(false);
      }
    }, 2000);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      flush(); // Final progress save
      if (noteSaveTimeout.current) clearTimeout(noteSaveTimeout.current);
      if (progressFlushTimeout.current) clearTimeout(progressFlushTimeout.current);
      const v = videoRef.current;
      if (v) {
        try {
          v.pause();
          v.removeAttribute('src');
          v.load();
        } catch (e) {
          console.error("Cleanup error:", e);
        }
      }
    };
  }, [flush]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!video || !source) {
    return (
      <div className="min-h-screen flex items-center justify-center text-foreground-muted">
        Video not found.
      </div>
    );
  }

  const videoSrc = source.type === "telegram" && sessionToken
    ? `${source.url}?token=${encodeURIComponent(sessionToken)}`
    : source.url;

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between glass-strong">
        <button 
          onClick={() => nav(-1)} 
          className="inline-flex items-center gap-2 text-sm text-foreground-dim hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <Link 
          to={`/chapter/${chapter?.id}`} 
          className="text-xs text-foreground-muted hover:text-foreground truncate max-w-[60%]"
        >
          {chapter?.name}
        </Link>
      </div>

      <div className="container max-w-6xl py-6" {...swipeHandlers}>
        <div 
          className="rounded-2xl overflow-hidden bg-black border border-border aspect-video relative group" 
          data-watermark={user?.email}
        >
          {/* Double Tap Areas for Telegram videos */}
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
              title={video.title}
            />
          ) : source.type === "telegram" && !sessionToken ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-black z-20">
              <div className="rounded-2xl glass-strong border border-border p-8 max-w-md text-center">
                <p className="font-bangla text-white mb-3 text-lg">
                  Please log in to watch this video.
                </p>
                <Button 
                  onClick={() => nav('/login')} 
                  className="rounded-full bg-primary hover:bg-primary-glow shadow-glow mt-4"
                >
                  লগইন করুন
                </Button>
              </div>
            </div>
          ) : errored ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-black z-20">
              <div className="rounded-2xl glass-strong border border-border p-8 max-w-md text-center">
                <p className="font-bangla text-white mb-3 text-lg">
                  {errorType === "403" && "Access denied. Please log in again."}
                  {errorType === "404" && "Video not found."}
                  {errorType === "network" && "Connection failed. Please check your internet."}
                  {(!errorType || errorType === "unknown") && "ভিডিও লোড হচ্ছে না। ব্যাকএন্ড সার্ভার কাজ করছে ঘন বা ফাইল এরর।"}
                </p>
                <Button 
                  onClick={() => errorType === "403" ? nav('/login') : retryPlayback()} 
                  className="rounded-full bg-primary hover:bg-primary-glow shadow-glow mt-4"
                >
                  <RotateCw className="w-4 h-4 mr-2" /> 
                  {errorType === "403" ? "লগইন করুন" : "আবার চেষ্টা করুন"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full bg-black group flex items-center justify-center">
              {isBuffering && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-black/50">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
              )}
              <video
                ref={videoRef}
                src={videoSrc}
                poster={source.poster}
                className="w-full h-full object-contain"
                controls
                autoPlay
                muted
                playsInline
                preload="metadata"
                crossOrigin="anonymous"
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                disableRemotePlayback
                onLoadStart={() => setIsBuffering(true)}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => setIsBuffering(false)}
                onLoadedData={() => setIsBuffering(false)}
                onCanPlay={() => setIsBuffering(false)}
                onCanPlayThrough={() => setIsBuffering(false)}
                onLoadedMetadata={(e) => {
                  const dur = e.currentTarget.duration;
                  if (!isNaN(dur)) setDuration(dur);
                  trackEvent("video_play", { video_id: video.id, title: video.title });
                  logActivity("video_start", { video_id: video.id, title: video.title });
                }}
                onTimeUpdate={(e) => {
                  updateProgress(video.id, e.currentTarget.currentTime, duration);
                }}
                onPause={() => {
                  trackEvent("video_pause", { 
                    video_id: video.id, 
                    title: video.title, 
                    timestamp: videoRef.current?.currentTime 
                  });
                  logActivity("video_pause", { 
                    video_id: video.id, 
                    timestamp: videoRef.current?.currentTime 
                  });
                  // Debounced flush on pause
                  if (progressFlushTimeout.current) clearTimeout(progressFlushTimeout.current);
                  progressFlushTimeout.current = setTimeout(() => flush(), 3000);
                }}
                onEnded={() => {
                  trackEvent("video_complete", { video_id: video.id, title: video.title });
                  logActivity("video_complete", { video_id: video.id, duration });
                  handleVideoEnded();
                }}
                onError={(e) => {
                  console.error("Video error:", e.currentTarget.error);
                  handleVideoError();
                }}
                onStalled={() => setIsBuffering(true)}
                onSuspend={() => setIsBuffering(false)}
              />
            </div>
          )}
        </div>

        <div className="mt-6 flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{video.title}</h1>
            {video.title_bn && <p className="font-bangla text-foreground-dim mt-1">{video.title_bn}</p>}
            {video.description && <p className="text-foreground-dim mt-4 max-w-3xl">{video.description}</p>}
          </div>
          {source.type !== 'youtube' && (
            <div className="flex items-center gap-2">
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

        {/* Prev/Next Navigation */}
        {(prevVideoId || nextVideoId) && (
          <div className="mt-4 flex justify-between items-center">
            {prevVideoId ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => nav(`/watch/${prevVideoId}`, { replace: true })}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Previous
              </Button>
            ) : <div />}
            {nextVideoId ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => nav(`/watch/${nextVideoId}`, { replace: true })}
              >
                Next <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
              </Button>
            ) : <div />}
          </div>
        )}

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
            {notesOpen ? (
              <ChevronUp className="w-4 h-4 text-foreground-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-foreground-muted" />
            )}
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
