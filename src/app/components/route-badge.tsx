import { lineColor } from "~/lib/lines";
import { cn } from "~/lib/utils";

interface RouteBadgeProps {
  // "6", as written on the bus
  readonly code: string;
  // RTPI id of the line: its color when the server sends none
  readonly route: string;
  readonly color?: string;
  readonly textColor?: string;
  // Read by screen readers; the badge is decorative without it
  readonly label?: string;
  readonly size?: number;
  readonly className?: string;
}

// Black on light backgrounds (the yellow lines), white otherwise
function contrastText(background: string): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(background)?.[1];
  if (hex === undefined) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#000000" : "#ffffff";
}

// The number of a line on its color, as sent by the RTPI server
export function RouteBadge({
  code,
  route,
  color,
  textColor,
  label,
  size = 40,
  className,
}: RouteBadgeProps) {
  const background = color ?? lineColor(route);
  return (
    <span
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={cn(
        "grid shrink-0 place-items-center rounded-xl font-bold tracking-tight shadow-sm",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * (code.length > 2 ? 0.34 : 0.45)),
        backgroundColor: background,
        color: textColor ?? contrastText(background),
      }}>
      {code}
    </span>
  );
}
