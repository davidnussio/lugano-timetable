import Image from "next/image";
import { lineColor, lineImage } from "~/lib/lines";
import { cn } from "~/lib/utils";

interface LineBadgeProps {
  // Itinerary `Img` ("20.jpg") or route id ("20")
  readonly img: string;
  readonly route: string;
  readonly line?: string;
  readonly size?: number;
  readonly className?: string;
}

// The official square badge of a TPL line
export function LineBadge({
  img,
  route,
  line,
  size = 44,
  className,
}: LineBadgeProps) {
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
