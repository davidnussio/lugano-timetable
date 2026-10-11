import type { ActiveTimer } from "~/timer/store";
import { LineBadge } from "./line-badge";
import { TransportBadge } from "./transport-badge";

// The line of the first bus of the timer: the TPL badge once the bus is in
// the real-time data, the line of the timetable before
export function TimerBadge({ timer, size }: { timer: ActiveTimer; size?: number }) {
  const first = timer.journey?.legs[0];
  if (timer.img === "" && first) {
    return (
      <TransportBadge
        line={first.line}
        category={first.category}
        operator={first.operator}
        size={size}
        className="rounded-xl"
      />
    );
  }
  return <LineBadge img={timer.img} route={timer.route} line={timer.line} size={size} />;
}
