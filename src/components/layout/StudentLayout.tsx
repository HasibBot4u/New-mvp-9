import { Outlet, useLocation } from "react-router-dom";
import { Download as DownloadIcon, WifiOff } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { StudentSidebar } from "./StudentSidebar";
import { StudentTopbar } from "./StudentTopbar";
import { StudentBottomNav } from "./StudentBottomNav";
import { BackendStatus } from "@/components/shared/BackendStatus";
import { useDownloadQueue, DownloadQueuePanel } from "@/components/DownloadQueue";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { Button } from "@/components/ui/button";

export function StudentLayout() {
  const { pathname } = useLocation();
  const isPlayer = pathname.startsWith("/watch/");
  const { downloads, cancelAll, cancelOne } = useDownloadQueue();
  const isOffline = useOfflineStatus();
  const { isInstallable, promptInstall } = usePwaInstall();

  if (isPlayer) {
    // Full-bleed cinematic player — no shell chrome.
    return (
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div data-layout="app-shell" className="min-h-screen flex w-full bg-background relative">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-[999] bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium">
          Skip to main content / মূল কন্টেন্টে যান
        </a>
        
        {/* Offline Banner */}
        {isOffline && (
          <div className="fixed top-0 left-0 right-0 z-[1000] bg-destructive text-destructive-foreground px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
            <WifiOff className="w-4 h-4" /> You are offline. Some features may be unavailable.
          </div>
        )}

        {/* Desktop sidebar (icon-collapsible). Hidden on mobile via shadcn primitive. */}
        <StudentSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Desktop sub-header w/ trigger + backend health */}
          <div className={`hidden md:flex items-center gap-3 h-12 px-4 border-b border-border/40 bg-background/80 backdrop-blur sticky z-30 transition-all ${isOffline ? 'top-9' : 'top-0'}`}>
            <SidebarTrigger />
            <div className="flex-1" />
            {isInstallable && (
               <Button onClick={promptInstall} size="sm" variant="outline" className="mr-2 h-8">
                 <DownloadIcon className="w-3.5 h-3.5 mr-2" /> Install App
               </Button>
            )}
            <BackendStatus />
          </div>

          {/* Mobile keeps the existing topbar (logo + search + bell + avatar) */}
          <div className={`md:hidden sticky z-30 transition-all ${isOffline ? 'top-9' : 'top-0'}`}>
            <StudentTopbar />
            {isInstallable && (
               <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between">
                 <span className="text-xs font-medium text-primary">Get the NexusEdu App for a better experience!</span>
                 <Button onClick={promptInstall} size="sm" className="h-7 text-xs px-3">Install</Button>
               </div>
            )}
          </div>

          <main id="main-content" className="flex-1 pb-20 md:pb-0 relative">
            <Outlet />
          </main>
        </div>

        <StudentBottomNav />
        <DownloadQueuePanel downloads={downloads} onCancelAll={cancelAll} onCancelOne={cancelOne} />
      </div>
    </SidebarProvider>
  );
}
