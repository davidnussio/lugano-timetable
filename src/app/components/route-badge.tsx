import { lineColor } from "~/lib/lines";
import { cn } from "~/lib/utils";

interface RouteBadgeProps {
  // "6", as written on the bus
  readonly code: string;
  // RTPI id of the line: its color when the server sends none
  readonly route: string;
  readonly color?: string;
  readonly textColor?: string;
  readonly size?: number;
  readonly className?: string;
}

// The number of a line on its color, as sent by the RTPI server
export function RouteBadge({
  code,
  route,
  color,
  textColor,
  size = 40,
  className,
}: RouteBadgeProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-xl font-bold tracking-tight shadow-sm",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * (code.length > 2 ? 0.34 : 0.45)),
        backgroundColor: color ?? lineColor(route),
        color: textColor ?? "#ffffff",
      }}>
      {code}
    </span>
  );
}
