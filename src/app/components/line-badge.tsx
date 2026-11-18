"use client";

import { useLines } from "~/hooks/use-lines";
import { useI18n } from "~/i18n/i18n-provider";
import { cn } from "~/lib/utils";
import { RouteBadge } from "./route-badge";
import { TransportBadge } from "./transport-badge";

interface LineBadgeProps {
  // Itinerary `Img` ("20.jpg") or route id ("20"): empty when the trip is
  // not a TPL line of the real-time data
  readonly img: string;
  readonly route: string;
  readonly line?: string;
  readonly size?: number;
  readonly className?: string;
}

// The number of a TPL line on its color, as in the list of the lines.
// Without a route (a planned journey not found yet in the real-time data),
// the name of the line.
export function LineBadge({
  img,
  route,
  line,
  size = 44,
  className,
}: LineBadgeProps) {
  const { m } = useI18n();
  const { lines } = useLines();
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
  const known = lines?.find((candidate) => candidate.route === route);
  const code = known?.code ?? line ?? "";
  return (
    <RouteBadge
      code={code}
      route={route}
      color={known?.color}
      textColor={known?.textColor}
      label={m.common.line(code || undefined)}
      size={size}
      className={className}
    />
  );
}
