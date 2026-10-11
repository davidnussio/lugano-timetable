import Image from "next/image";
import { lineColor, lineImage } from "~/lib/lines";
import { cn } from "~/lib/utils";
import { TransportBadge } from "./transport-badge";

interface LineBadgeProps {
  // Itinerary `Img` ("20.jpg") or route id ("20")
  readonly img: string;
  readonly route: string;
  readonly line?: string;
  readonly size?: number;
  readonly className?: string;
}

// The official square badge of a TPL line. Without an image (a planned
// journey not found yet in the real-time data), the name of the line.
export function LineBadge({
  img,
  route,
  line,
  size = 44,
  className,
}: LineBadgeProps) {
  if (img === "") {
    return (
      <TransportBadge
        line={line ?? "?"}
        category="B"
        operator="TPL"
        size={size}
        className={cn("rounded-xl", className)}
      />
    );
  }
  return (
    <div
      className={cn("shrink-0 overflow-hidden rounded-xl shadow-sm", className)}
      style={{ width: size, height: size, backgroundColor: lineColor(route) }}>
      <Image
        src={lineImage(img)}
        alt={line ? `Linea ${line}` : "Linea"}
        width={size}
        height={size}
      />
    </div>
  );
}
