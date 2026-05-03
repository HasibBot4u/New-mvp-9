import { useEffect } from "react";
import { useToast } from "./use-toast";

export function usePwaUpdate() {
  const { toast } = useToast();
  useEffect(() => {
    // Check for updates periodically
    const interval = setInterval(async () => {
      try {
        await fetch('/api/health', { method: 'HEAD' });
      } catch (e) {
        console.error("Update check failed", e);
      }
    }, 1000 * 60 * 60); // 1 hour
    return () => clearInterval(interval);
  }, [toast]);
}
