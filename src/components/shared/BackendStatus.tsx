import { useBackendHealth } from "@/hooks/useBackendHealth";
import { cn } from "@/lib/utils";

/**
 * Compact backend status pill — colour + Bangla label per spec.
 */
export function BackendStatus({ className }: { className?: string }) {
  const health = useBackendHealth(30);
  
  let color = "red";
  let label = "সার্ভার বিচ্ছিন্ন";

  if (health.isOnline) {
    if (health.telegramConnected) {
      color = "green";
      label = "সার্ভার ও টেলিগ্রাম যুক্ত";
    } else {
      color = "orange";
      label = "সার্ভার যুক্ত, টেলিগ্রাম রিকানেক্টিং...";
    }
  } else {
    // If failed but < 5 times, probably cold start
    const fails = health.consecutiveFailures ?? 0;
    if (fails > 0 && fails < 5) {
      color = "orange";
      label = "সার্ভার চালু হচ্ছে...";
    } else if (fails >= 5) {
      color = "red";
      label = "সার্ভার বিচ্ছিন্ন";
    } else {
      color = "orange";
      label = "সার্ভার চেক হচ্ছে...";
    }
  }

  const dot =
    color === "green"
      ? "bg-success shadow-[0_0_8px_hsl(var(--success))]"
      : color === "red"
      ? "bg-destructive shadow-[0_0_8px_hsl(var(--destructive))]"
      : "bg-warning shadow-[0_0_8px_hsl(var(--warning))] animate-pulse";

  return (
    <div
      className={cn(
        "hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
        "bg-background-overlay/60 border border-border/50 backdrop-blur",
        className,
      )}
      title={label}
    >
      <span className={cn("w-2 h-2 rounded-full", dot)} />
      <span className="bangla text-xs text-foreground-dim">{label}</span>
    </div>
  );
}
