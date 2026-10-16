import { ArrowRightLeft, BusFront, DoorOpen, Flag, Footprints, TimerOff } from "lucide-react";
import type { Phase } from "~/timer/tone";

// One picture per step of the timer, so that what it counts down to shows
// without reading the label: leave home, walk, wait for the bus, ride on
const icons = {
  leave: DoorOpen,
  walk: Footprints,
  bus: BusFront,
  gone: TimerOff,
  transfer: ArrowRightLeft,
  arrival: Flag,
} satisfies Record<Phase, unknown>;

export function PhaseIcon({ phase, className }: { phase: Phase; className?: string }) {
  const Icon = icons[phase];
  return <Icon aria-hidden className={className} />;
}
