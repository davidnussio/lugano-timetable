"use client";

import {
  Bell,
  Bus,
  ChartColumn,
  ChevronRight,
  Flag,
  Footprints,
  History,
  LocateFixed,
  MapPin,
  Route,
  TimerOff,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { type ComponentProps, type RefObject, useCallback, useRef, useState } from "react";
import { AlertBanner } from "~/app/components/alert-banner";
import { PageHeader } from "~/app/components/page-header";
import { PhaseIcon } from "~/app/components/phase-icon";
import { TimerBadge } from "~/app/components/timer-badge";
import { Switch } from "~/components/ui/switch";
import type { GeolocationState } from "~/hooks/use-geolocation";
import { useInView } from "~/hooks/use-in-view";
import { useNow } from "~/hooks/use-now";
import { useReliability } from "~/hooks/use-reliability";
import { useI18n } from "~/i18n/i18n-provider";
import type { Messages } from "~/i18n/messages";
import {
  formatClimb,
  formatClock,
  formatDistance,
  formatDuration,
  formatSpeed,
  formatWeather,
} from "~/lib/format";
import { cn } from "~/lib/utils";
import { getOffHeadline, rideSummary } from "~/timer/get-off";
import { formatTime, journeyHeadline } from "~/timer/journey";
import { learnedSpeed, MIN_WALKS } from "~/timer/pace";
import { type Countdown, distanceMeters, minutesLeft, type Pace, type Stage } from "~/timer/plan";
import { type NextStop, nextStop, type TravelStats, travelStats } from "~/timer/progress";
import { reliabilityNote } from "~/timer/reliability";
import type { ActiveTimer } from "~/timer/store";
import { useTimer } from "~/timer/timer-provider";
import { type Tone, timerHeadline, timerTone, toneBackground, toneText } from "~/timer/tone";
import { BusApproach } from "./bus-approach";
import { JourneySection, LaterSuggestion } from "./journey-view";
import { NextBusCard } from "./next-bus-card";
import { NotificationsCard } from "./notifications-card";
import { TripLog } from "./trip-log";

// MapLibre needs the browser (WebGL) and is large: load it only when shown
const WalkMap = dynamic(() => import("./walk-map").then((module) => module.WalkMap), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-muted" />,
});

// The map sits at the bottom of the page: load MapLibre and its tiles only
// when the user scrolls near it
function LazyWalkMap(props: ComponentProps<typeof WalkMap>) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="h-56 border-t border-border">
      {inView ? <WalkMap {...props} /> : <div className="size-full bg-muted" />}
    </div>
  );
}

const paces: ReadonlyArray<Pace> = ["slow", "normal", "fast"];

// Share of the time left since the timer started: the ring, or the bar of the
// compact countdown. Until leaving it counts down to leave, then to the bus.
function timerProgress(
  m: Messages,
  active: ActiveTimer,
  countdown: Countdown,
  stage: Stage
): number {
  if (timerTone(countdown, stage) === "gone") return 0;
  const total = active.departureAt - active.startedAt;
  if (stage !== "away") {
    return Math.min(1, Math.max(0, total > 0 ? countdown.departureMs / total : 0));
  }
  if (countdown.leaveMs < 0) return 1;
  const leaveTotal = total - (countdown.walkingMs ?? 0);
  return Math.min(1, Math.max(0, leaveTotal > 0 ? timerHeadline(m, countdown).ms / leaveTotal : 0));
}

// The countdown to leave, or what comes next once on board: of a journey, or
// of a single bus with a stop to get off
function useHeadline(countdown: Countdown) {
  const { timer, legs, stage, ride, walkAfterMs } = useTimer();
  const { m } = useI18n();
  const now = useNow();
  const getOff = timer?.journey === undefined ? timer?.getOff : undefined;
  const travel =
    now === 0
      ? undefined
      : legs
        ? journeyHeadline(m, legs, now, walkAfterMs)
        : getOff && timer
          ? getOffHeadline(m, getOff, ride, now >= timer.departureAt, now)
          : undefined;
  return {
    headline: travel ?? timerHeadline(m, countdown, stage),
    travel: travel !== undefined,
    now,
  };
}

// The pace learned from the walks to the stop, or how far it is from it
function PaceLearning() {
  const { learnedPace, resetPace } = useTimer();
  const { m } = useI18n();
  const speed = learnedSpeed(learnedPace);
  return (
    <div className="flex items-center gap-2 px-4 pb-3 pl-12 text-xs text-muted-foreground">
      <p className="min-w-0 flex-1">
        {speed === undefined ? (
          m.timer.learningPace(learnedPace.speeds.length, MIN_WALKS)
        ) : (
          <>
            {m.timer.measuredPace}{" "}
            <span className="font-medium text-foreground">{formatSpeed(m, speed)}</span> ·{" "}
            {m.timer.walks(learnedPace.count)}
          </>
        )}
      </p>
      {learnedPace.count > 0 && (
        <button
          type="button"
          onClick={resetPace}
          className="shrink-0 rounded-md px-2 py-1 font-medium text-primary transition-colors hover:bg-muted">
          {m.timer.resetPace}
        </button>
      )}
    </div>
  );
}

// Once the bus has left there is nothing to cancel: the timer is just over
function cancelLabel(tone: Tone, m: Messages): string {
  return tone === "gone" ? m.timer.end : m.timer.cancel;
}

function marginLabel({ walkingMs, leaveMs }: Countdown): string {
  if (walkingMs === undefined) return "—";
  return leaveMs < 0
    ? `−${minutesLeft(-leaveMs)} min`
    : `+${Math.floor(leaveMs / 60_000)} min`;
}

export default function TimerPage() {
  const timer = useTimer();
  const { m } = useI18n();
  const { timer: active, countdown } = timer;
  // Whether the ring has scrolled away under the header
  const [compact, setCompact] = useState(false);
  const header = useRef<HTMLDivElement>(null);

  return (
    <main className="flex flex-1 flex-col">
      <div ref={header} className="sticky top-0 z-20">
        <PageHeader
          back="/"
          title={m.timer.title}
          actions={
            <>
              <Link
                href="/storico"
                aria-label={m.history.open}
                title={m.history.open}
                className="grid size-10 place-items-center rounded-full transition-colors hover:bg-muted active:bg-muted">
                <ChartColumn className="size-5" />
              </Link>
              {active && countdown && (
                <button
                  type="button"
                  onClick={timer.cancel}
                  aria-label={cancelLabel(timerTone(countdown, timer.stage), m)}
                  className="grid size-10 place-items-center rounded-full text-destructive transition-colors hover:bg-destructive/10 active:bg-destructive/10">
                  <TimerOff className="size-5" />
                </button>
              )}
            </>
          }
        />
        {active && countdown && (
          <CompactCountdown active={active} countdown={countdown} show={compact} />
        )}
      </div>
      {active && countdown ? (
        <ActiveTimerView
          active={active}
          countdown={countdown}
          header={header}
          onRingHidden={setCompact}
        />
      ) : active ? null : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 pb-24 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-muted">
            <Bell className="size-7 text-muted-foreground" />
          </span>
          <h2 className="text-lg font-semibold">{m.timer.none}</h2>
          <p className="text-sm text-muted-foreground">{m.timer.noneHint}</p>
          <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
              <MapPin className="size-4" />
              {m.timer.chooseStop}
            </Link>
            <Link
              href="/tragitto"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold transition-colors hover:bg-muted/60 active:bg-muted">
              <Route className="size-4 text-primary" />
              {m.timer.chooseJourney}
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

// The countdown once the ring has scrolled away: stays under the header, over
// the page, so that the map and the settings can be seen with the time left
function CompactCountdown({
  active,
  countdown,
  show,
}: {
  active: ActiveTimer;
  countdown: Countdown;
  show: boolean;
}) {
  const { stage } = useTimer();
  const { m } = useI18n();
  const tone = timerTone(countdown, stage);
  const { headline, travel } = useHeadline(countdown);
  // At the stop the headline is already the bus
  const walking = countdown.walkingMs !== undefined && stage !== "arrived";

  return (
    <div
      inert={!show}
      className={cn(
        "absolute inset-x-0 top-full border-b border-border/60 bg-background/85 backdrop-blur-xl transition-[opacity,translate] duration-200",
        show ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
      )}>
      <button
        type="button"
        aria-label={m.timer.backToTimer}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="flex w-full items-center gap-4 px-4 py-2 text-left">
        <PhaseIcon
          phase={headline.phase}
          className={cn("size-7 shrink-0", travel ? "text-primary" : toneText[tone])}
        />
        <div className="-ml-1 flex min-w-0 flex-col">
          <span className={cn("truncate text-xs font-semibold", travel ? "text-primary" : toneText[tone])}>
            {headline.label}
          </span>
          <span className="font-mono text-3xl font-semibold leading-none tracking-tight tabular-nums">
            {formatClock(headline.ms)}
          </span>
        </div>
        <dl className="ml-auto flex gap-4 text-right">
          {travel ? null : walking ? (
            <>
              <CompactStat label={m.timer.busIn} value={formatClock(Math.max(0, countdown.departureMs))} />
              <CompactStat
                label={m.timer.margin}
                value={marginLabel(countdown)}
                className={toneText[tone]}
              />
            </>
          ) : (
            <CompactStat label={m.timer.departure} value={active.time} />
          )}
        </dl>
      </button>
      <div className="h-1 bg-muted">
        <div
          className={cn("h-full transition-[width] duration-1000 ease-linear", toneBackground[tone])}
          style={{ width: `${timerProgress(m, active, countdown, stage) * 100}%` }}
        />
      </div>
    </div>
  );
}

function CompactStat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("font-mono text-base font-semibold tabular-nums", className)}>
        {value}
      </dd>
    </div>
  );
}

function ActiveTimerView({
  active,
  countdown,
  header,
  onRingHidden,
}: {
  active: ActiveTimer;
  countdown: Countdown;
  header: RefObject<HTMLDivElement | null>;
  onRingHidden: (hidden: boolean) => void;
}) {
  const {
    settings,
    distance,
    climb,
    weather,
    far,
    geolocation,
    stage,
    live,
    notifications,
    cancel,
    updateSettings,
    enableNotifications,
    ride,
    legs,
    walkAfterMs,
  } = useTimer();
  const { m } = useI18n();
  const tone = timerTone(countdown, stage);
  const { headline, travel, now } = useHeadline(countdown);
  const clock = formatClock(headline.ms);
  const walking = countdown.walkingMs;
  // From the stop, also when too far to count the walk
  const meters = distance ?? far;

  const progress = timerProgress(m, active, countdown, stage);
  // Once on board the map leads to the next stop
  const next = now === 0 ? undefined : nextStop(active, legs, now);
  // On board the stats are about the ride, not the walk to the stop
  const stats = travel && now > 0 ? travelStats(active, legs, ride?.stopsLeft, now, walkAfterMs) : undefined;
  const showMap = settings.useLocation && active.coordinates !== undefined && !geolocation.error;
  // On board the pace does not matter: it comes back for the walk of a transfer
  const showPace = showMap && (next === undefined || next.kind === "board");
  const routingHref = `/routing/${active.target}/${active.route}/${active.dir}/${active.routing}`;

  // Switch to the compact countdown once a fifth of the ring is under the
  // header, measured as it is (it is taller with the notch of the iPhone)
  const observeRing = useCallback(
    (ring: HTMLDivElement | null) => {
      if (ring === null) return;
      const update = () => {
        const bottom = header.current?.getBoundingClientRect().bottom ?? 0;
        const { top, height } = ring.getBoundingClientRect();
        onRingHidden(bottom - top > height * 0.2);
      };
      update();
      window.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      return () => {
        window.removeEventListener("scroll", update);
        window.removeEventListener("resize", update);
        onRingHidden(false);
      };
    },
    [header, onRingHidden]
  );

  const reference = countdown.leaveMs / 60_000;
  const nextAlert = active.thresholds.find(
    (t) => t < reference && !active.fired.includes(t)
  );

  return (
    <div className="space-y-3 px-4 pb-8 pt-3">
      <AlertBanner />
      {/* The bus: where it is, once known */}
      <BusCard href={active.routing !== "" ? routingHref : undefined}>
        <TimerBadge timer={active} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{active.destination}</p>
          <p className="truncate text-xs text-muted-foreground">
            {m.timer.fromAt(
              active.stop.name,
              <span className="font-mono tabular-nums">{active.time}</span>
            )}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            live ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
          )}>
          {live ? m.timer.live : m.timer.lastData}
        </span>
        {active.routing !== "" && (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
      </BusCard>

      <TripLog timer={active} now={now} />

      {/* Countdown */}
      <section className="flex flex-col items-center rounded-3xl border border-border bg-card px-4 py-6 shadow-sm">
        {/* Before boarding: where the bus is on its way to the stop. Once
            gone the routing shows the next run. */}
        {!travel && tone !== "gone" && <BusApproach active={active} now={now} />}
        <div ref={observeRing} className="relative size-64">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            <circle cx="50" cy="50" r="45" fill="none" strokeWidth="6" className="stroke-muted" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${progress * 100} 100`}
              className={cn("stroke-current transition-[stroke-dasharray] duration-1000 ease-linear", toneText[tone])}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Keyed to show the change of step with a little zoom */}
            <PhaseIcon
              key={headline.phase}
              phase={headline.phase}
              className={cn(
                "mb-1 size-8 animate-in fade-in zoom-in-50 duration-300",
                travel ? "text-primary" : toneText[tone]
              )}
            />
            <span
              className={cn(
                "max-w-52 truncate text-center text-sm font-semibold",
                travel ? "text-primary" : toneText[tone]
              )}>
              {headline.label}
            </span>
            <span
              className={cn(
                "font-mono font-semibold tracking-tight tabular-nums",
                // Hours do not fit in the ring at full size
                clock.length > 7 ? "text-4xl" : clock.length > 5 ? "text-5xl" : "text-6xl"
              )}>
              {clock}
            </span>
            {/* Short enough to stay in the ring */}
            <span className="mt-1 max-w-48 truncate text-center text-xs text-muted-foreground">
              {travel
                ? active.journey === undefined && active.getOff
                  ? rideSummary(m.ride, active.getOff, ride)
                  : stats?.extra.kind === "duration"
                    ? active.journey?.to.name
                    : m.timer.towards(active.journey?.to.name ?? active.destination)
                : tone === "gone"
                ? m.timer.busLeft
                : countdown.departureMs <= 0
                  ? m.timer.busComing
                  : far !== undefined
                    ? m.timer.farFromStop(formatDistance(m, far))
                    : stage === "arrived"
                      ? m.timer.atYourStop(active.stop.name)
                      : walking === undefined
                        ? m.timer.atStop(active.stop.name)
                        : m.timer.busInClock(formatClock(countdown.departureMs))}
            </span>
          </div>
        </div>

        <dl className="mt-5 grid w-full grid-cols-3 divide-x divide-border text-center">
          {stats ? (
            <TravelStatList stats={stats} />
          ) : (
            <>
              <Stat label={m.timer.departure} value={active.time} mono />
              <Stat
                label={m.timer.onFoot}
                value={
                  stage === "arrived"
                    ? m.timer.arrived
                    : walking === undefined
                      ? "—"
                      : `${Math.max(1, Math.round(walking / 60_000))} min`
                }
                hint={
                  stage === "arrived" || meters === undefined
                    ? undefined
                    : [
                        formatDistance(m, meters),
                        far === undefined ? formatClimb(climb) : undefined,
                        formatWeather(m, weather),
                      ]
                        .filter(Boolean)
                        .join(" · ")
                }
              />
              <Stat
                label={m.timer.margin}
                value={marginLabel(countdown)}
                className={walking === undefined ? undefined : toneText[tone]}
              />
            </>
          )}
        </dl>

        {/* A journey follows the times of SBB, not of the stop */}
        {!active.journey && (
          <ReliabilityLine active={active} showMargin={stage === "away" && tone !== "gone"} />
        )}
      </section>

      {nextAlert !== undefined && tone !== "gone" && stage === "away" && far === undefined && (
        <p className="px-1 text-center text-xs text-muted-foreground">
          {m.timer.nextAlert(
            <span className="font-medium text-foreground">
              {formatClock((reference - nextAlert) * 60_000)}
            </span>,
            nextAlert,
            walking !== undefined
          )}
        </p>
      )}

      {/* Missed, or too late to make it: offer the next bus of the line.
          With a stop to get off the timer follows the ride once the bus has
          left: only the GPS can tell that the user was not on board. */}
      {!active.journey &&
        ((tone === "gone" &&
          (active.getOff === undefined || (walking !== undefined && stage !== "arrived"))) ||
          (walking !== undefined && countdown.leaveMs < 0 && stage !== "arrived")) && (
          <NextBusCard now={now} />
        )}
      {active.journey === undefined && active.routing !== "" && (
        <GetOffLink active={active} href={routingHref} />
      )}

      {active.journey && (
        <>
          <LaterSuggestion leaving={countdown.leaveMs <= 0 || stage !== "away"} />
          <JourneySection now={now} />
        </>
      )}

      {/* Location */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 p-4">
          <LocateFixed className="size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{m.timer.whenToLeave}</p>
            <p className="text-xs text-muted-foreground">
              {!active.coordinates
                ? m.timer.stopPositionUnavailable
                : !settings.useLocation
                  ? m.timer.useGpsHint
                  : geolocation.error === "denied"
                    ? m.timer.locationDeniedBrowser
                    : geolocation.error
                      ? m.common.locationUnavailable
                      : geolocation.position
                        ? m.timer.accuracy(Math.round(geolocation.position.accuracy))
                        : m.timer.locating}
            </p>
          </div>
          <Switch
            label={m.timer.useMyLocation}
            checked={settings.useLocation}
            disabled={!active.coordinates}
            onCheckedChange={(useLocation) => updateSettings({ useLocation })}
          />
        </div>
        {showPace && (
          <div className="flex items-center gap-3 border-t border-border px-4 py-3">
            <Footprints className="size-5 shrink-0 text-muted-foreground" />
            <div className="grid flex-1 grid-cols-3 gap-1 rounded-xl bg-muted p-1">
              {paces.map((pace) => (
                <button
                  key={pace}
                  type="button"
                  aria-pressed={settings.pace === pace}
                  onClick={() => updateSettings({ pace })}
                  className={cn(
                    "rounded-lg py-1.5 text-xs font-medium transition-colors",
                    settings.pace === pace
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}>
                  {m.timer.paces[pace]}
                </button>
              ))}
            </div>
          </div>
        )}
        {showPace && <PaceLearning />}
        {showMap && next && <NextStopRow stop={next} position={geolocation.position} />}
        {showMap && active.coordinates && (
          <LazyWalkMap
            stop={next?.position ?? active.coordinates}
            kind={next?.kind}
            position={geolocation.position}
          />
        )}
      </section>

      <NotificationsCard
        permission={notifications}
        onEnable={() => void enableNotifications()}
      />

      <p className="px-2 text-center text-xs text-muted-foreground">{m.timer.keepOpen}</p>

      <div className={cn("grid gap-2 pt-1", active.routing !== "" && "grid-cols-2")}>
        {active.routing !== "" && (
        <Link
          href={routingHref}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold shadow-sm transition-colors hover:bg-muted">
          <Bus className="size-4" />
          {m.timer.whereIsBus}
        </Link>
        )}
        <button
          type="button"
          onClick={cancel}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-destructive/10 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/15">
          <TimerOff className="size-4" />
          {cancelLabel(tone, m)}
        </button>
      </div>
    </div>
  );
}

// How late the bus left on the past days, with the margin to keep once out
// of the door when the delay changes a lot
function ReliabilityLine({ active, showMargin }: { active: ActiveTimer; showMargin: boolean }) {
  const stats = useReliability(
    active.target === "" || active.routing === ""
      ? null
      : { target: active.target, route: active.route, dir: active.dir, time: active.time }
  );
  const { m } = useI18n();
  const note = reliabilityNote(m, stats);
  if (note === undefined) return null;

  return (
    <div className="mt-4 w-full space-y-1 border-t border-border pt-3 text-center text-xs">
      <p className="flex items-center justify-center gap-1.5 text-muted-foreground">
        <History className="size-3.5 shrink-0" />
        {note.summary}
      </p>
      {showMargin && note.margin !== undefined && (
        <p className="font-medium text-warning">
          {m.timer.suggestedMargin(note.margin)}
        </p>
      )}
    </div>
  );
}

function BusCard({ href, children }: { href: string | undefined; children: React.ReactNode }) {
  const className =
    "flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm";
  return href === undefined ? (
    <section className={className}>{children}</section>
  ) : (
    <Link
      href={href}
      className={cn(className, "transition-colors hover:bg-muted/60 active:bg-muted")}>
      {children}
    </Link>
  );
}

// The ride under the countdown once on board: when it left and arrives, with
// its delay, the stops left, or the trip once over
function TravelStatList({ stats }: { stats: TravelStats }) {
  const { m } = useI18n();
  const { departureAt, arrivalAt, extra } = stats;
  let third: ComponentProps<typeof Stat>;
  switch (extra.kind) {
    case "delay": {
      const minutes = extra.ms === undefined ? undefined : Math.round(extra.ms / 60_000);
      third = {
        label: m.timer.delay,
        value:
          minutes === undefined
            ? "—"
            : minutes === 0
              ? m.timer.punctual
              : minutes > 0
                ? `+${minutes} min`
                : `−${-minutes} min`,
        className:
          minutes === undefined
            ? undefined
            : minutes <= 0
              ? "text-success"
              : minutes < 5
                ? "text-warning"
                : "text-destructive",
      };
      break;
    }
    case "stops":
      third = { label: m.timer.stops, value: extra.stops === undefined ? "—" : `${extra.stops}` };
      break;
    case "duration":
      third = { label: m.timer.duration, value: formatDuration(extra.ms) };
      break;
    case "walk":
      third = {
        label: m.timer.onFoot,
        value: `${Math.max(1, Math.round(extra.ms / 60_000))} min`,
      };
      break;
  }
  return (
    <>
      <Stat label={m.timer.departure} value={formatTime(departureAt)} mono />
      <Stat
        label={m.timer.arrival}
        value={arrivalAt === undefined ? "—" : formatTime(arrivalAt)}
        mono={arrivalAt !== undefined}
      />
      <Stat {...third} />
    </>
  );
}

// The stop the map leads to once on board, with how far it is
function NextStopRow({
  stop,
  position,
}: {
  stop: NextStop;
  position: GeolocationState["position"];
}) {
  const { m } = useI18n();
  const title =
    stop.kind === "board"
      ? m.timer.boardAt(stop.name)
      : stop.kind === "getOff"
        ? m.timer.getOffAt(stop.name)
        : m.timer.destinationAt(stop.name);
  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-3">
      {stop.kind === "board" ? (
        <Bus className="size-5 shrink-0 text-primary" />
      ) : (
        <Flag className="size-5 shrink-0 text-primary" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        {position && (
          <p className="text-xs text-muted-foreground">
            {m.timer.fromYou(formatDistance(m, distanceMeters(position, stop.position)))}
          </p>
        )}
      </div>
    </div>
  );
}

// Where to get off the bus, chosen on the line page
function GetOffLink({ active, href }: { active: ActiveTimer; href: string }) {
  const { ride } = useTimer();
  const { m } = useI18n();
  const { getOff } = active;
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/60">
      <Flag className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {getOff ? m.timer.getOffAt(getOff.name) : m.timer.whereGetOff}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {getOff
            ? [
                getOff.arrivalAt === undefined
                  ? undefined
                  : getOff.arrivedAt === undefined
                    ? m.timer.arrivalAt(formatTime(getOff.arrivalAt))
                    : m.timer.arrivedAt(formatTime(getOff.arrivedAt)),
                ride ? rideSummary(m.ride, getOff, ride) : m.timer.willAlert,
              ]
                .filter(Boolean)
                .join(" · ")
            : m.timer.chooseGetOff}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function Stat({
  label,
  value,
  hint,
  mono,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-2">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("text-lg font-semibold tabular-nums", mono && "font-mono", className)}>
        {value}
      </dd>
      {hint && <dd className="text-[11px] text-muted-foreground">{hint}</dd>}
    </div>
  );
}
