import { cn } from "~/lib/utils";
import { delayMs, expected, formatTime, type Timing } from "~/timer/journey";

// The expected time, with the delay when there is one
export function Time({ timing, className }: { timing: Timing; className?: string }) {
  const delay = Math.round(delayMs(timing) / 60_000);
  return (
    <span className={cn("inline-flex items-baseline gap-1 font-mono tabular-nums", className)}>
      {formatTime(expected(timing))}
      {delay !== 0 && (
        <span
          className={cn(
            "font-sans text-[11px] font-semibold",
            delay > 0 ? "text-destructive" : "text-success"
          )}>
          {delay > 0 ? `+${delay}` : delay}
        </span>
      )}
    </span>
  );
}
