import { cn } from "~/lib/utils";

const TRAINS = new Set(["S", "R", "RE", "IR", "IC", "ICE", "EC", "EN", "NJ", "PE", "TGV", "RJX", "EXT"]);

// Colors of the operators: TPL in the app color, trains in red, regional
// buses (ARL, PostBus) in yellow
function badgeColors(category: string, operator: string | undefined) {
  if (operator?.toUpperCase() === "TPL") {
    return "bg-primary text-primary-foreground";
  }
  if (TRAINS.has(category.toUpperCase())) return "bg-[#d82e20] text-white";
  if (category.toUpperCase() === "B") return "bg-[#fcc800] text-black";
  return "bg-muted-foreground text-background";
}

// The line of a planned leg, for any operator
export function TransportBadge({
  line,
  category,
  operator,
  size = 28,
  className,
}: {
  readonly line: string;
  readonly category: string;
  readonly operator?: string;
  readonly size?: number;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg px-1.5 font-bold leading-none tabular-nums shadow-sm",
        badgeColors(category, operator),
        className
      )}
      style={{ minWidth: size, height: size, fontSize: Math.round(size * 0.45) }}>
      {line}
    </span>
  );
}
