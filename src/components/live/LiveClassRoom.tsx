import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, MonitorUp } from 'lucide-react';
import { ChatPanel } from './ChatPanel';
import { LiveClass } from '@/hooks/useLiveClass';

interface LiveClassRoomProps {
  liveClass: LiveClass;
  onLeave: () => void;
}

export function LiveClassRoom({ liveClass, onLeave }: LiveClassRoomProps) {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);

  useEffect(() => {
    // In a real implementation we would load the Jitsi Meet external API script
    // For this mockup, we'll just display a placeholder wrapper
    
    // Example Jitsi initialization:
    /*
    const domain = 'meet.jit.si';
    const options = {
        roomName: liveClass.roomName,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerRef.current,
        userInfo: { displayName: 'Student' }
    };
    jitsiApiRef.current = new window.JitsiMeetExternalAPI(domain, options);
    */

    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
      }
    };
  }, [liveClass.roomName]);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] gap-4 p-4 animate-in fade-in zoom-in-95 duration-300">
      <Card className="flex-1 overflow-hidden bg-black border-white/10 flex flex-col relative rounded-xl">
        {/* Top Overlay Bar */}
        <div className="absolute top-0 w-full z-10 px-4 py-3 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center">
            <div>
                <h2 className="font-bold text-lg">{liveClass.title}</h2>
                <p className="text-sm text-foreground-muted">Instructor: {liveClass.instructorName}</p>
            </div>
            <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm" className="hidden sm:flex gap-2">
                    <MonitorUp className="w-4 h-4" /> Share Screen
                </Button>
                <Button variant="destructive" size="sm" onClick={onLeave} className="flex gap-2">
                    <LogOut className="w-4 h-4" /> Leave
                </Button>
            </div>
        </div>

        {/* Video Area (Jitsi placeholder) */}
        <div ref={jitsiContainerRef} className="flex-1 w-full bg-zinc-900 flex items-center justify-center relative">
          <div className="text-center space-y-4">
             <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4 border border-primary/50">
                 <span className="text-3xl font-bold text-primary">{liveClass.instructorName.charAt(0)}</span>
             </div>
             <p className="text-foreground-muted">Waiting for instructor to share screen/camera...</p>
          </div>
        </div>
      </Card>

      <div className="w-full lg:w-[400px] h-full sm:h-[400px] lg:h-auto shrink-0">
        <ChatPanel roomName={liveClass.roomName} />
      </div>
    </div>
  );
}
