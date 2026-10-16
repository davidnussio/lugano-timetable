"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useSyncExternalStore,
} from "react";
import {
  type GeolocationState,
  useGeolocation,
  useGeolocationGranted,
} from "~/hooks/use-geolocation";
import useSWR from "swr";
import { useMonitored } from "~/hooks/use-monitored";
import { useNow } from "~/hooks/use-now";
import { useWakeLock } from "~/hooks/use-wake-lock";
import { useClimb, useStopHeights } from "~/terrain/use-climb";
import type { Connection, LegUpdate, PlannedLeg, Station } from "~/journey/models";
import type { Coordinates, Departure, Target } from "~/timetable/models";
import { fetcher } from "~/utils/fetcher";
import {
  notificationPermission,
  notify,
  requestNotifications,
  unlockAudio,
} from "./alerts";
import {
  type Alternative,
  expected,
  fallbackPlan,
  formatTime,
  type JourneyState,
  journeyState,
  transferMessage,
} from "./journey";
import {
  alertMessage,
  approach,
  type Countdown,
  countdown,
  distanceMeters,
  dueAlert,
  type Envelope,
  type Fix,
  isFar,
  PACE_SPEED,
  peakHold,
  reliableFix,
  type Stage,
  type WalkSource,
  walkingRelease,
  walkingSeconds,
} from "./plan";
import {
  type ActiveTimer,
  applyLegUpdates,
  createJourneyTimer,
  createTimer,
  dueTransferAlert,
  findTimerDeparture,
  legsQuery,
  liveLegs,
  planAlerts,
  type ScheduledDeparture,
  settingsStore,
  type TimerSettings,
  timerEndsAt,
  timerStore,
} from "./store";

// The timer is gone this long after the departure (the arrival of a journey)
const EXPIRES_AFTER_MS = 10 * 60_000;
// The forecasts of the timetable change about every minute
const JOURNEY_REFRESH_MS = 30_000;

const defaultSettings: TimerSettings = { pace: "normal" };

export interface TimerContextValue {
  readonly timer: ActiveTimer | null;
  readonly settings: Required<TimerSettings>;
  readonly countdown: Countdown | undefined;
  readonly distance: number | undefined;
  // Meters to go up to the stop (negative downhill), when known
  readonly climb: number | undefined;
  // Meters from the stop when too far to walk there: the countdown is then
  // the bus, without a time to leave
  readonly far: number | undefined;
  readonly geolocation: GeolocationState;
  // Whether the user has left for the stop or is already there
  readonly stage: Stage;
  // Whether the bus is in the latest real-time data
  readonly live: boolean;
  readonly notifications: NotificationPermission | "unsupported";
  // A journey with transfers: its legs with the latest timings, and how the
  // transfers are going
  readonly legs: ReadonlyArray<PlannedLeg> | undefined;
  readonly journey: JourneyState | undefined;
  // The way to fall back on when a connection is lost, from its stop
  readonly fallback: { readonly index: number; readonly plan: Connection } | undefined;
  start(
    departure: ScheduledDeparture,
    stop: ActiveTimer["stop"],
    coordinates: Coordinates | undefined
  ): void;
  startJourney(
    connection: Connection,
    from: Station,
    to: Station,
    targets: ReadonlyArray<Target> | undefined
  ): void;
  // Continues the journey after the leg `index` with another plan
  reroute(index: number, plan: Connection): void;
  cancel(): void;
  updateSettings(patch: Partial<TimerSettings>): void;
  enableNotifications(): Promise<void>;
  dismissAlert(): void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function useTimer(): TimerContextValue {
  const value = useContext(TimerContext);
  if (value === null) throw new Error("useTimer outside of TimerProvider");
  return value;
}

const noop = () => () => {};

const isDefined = <A,>(value: A | undefined): value is A => value !== undefined;

interface DistanceSample {
  readonly raw: number;
  readonly envelope: Envelope;
  readonly timer: number | undefined;
}

// The distance smoothed with `peakHold`. The envelope is anchored at the
// latest GPS reading and decays from there on every tick of the clock.
function useSteadyDistance(
  raw: number | undefined,
  now: number,
  timer: number | undefined,
  release: number
): number | undefined {
  const [sample, setSample] = useState<DistanceSample>();
  if (raw === undefined || now === 0) {
    if (sample !== undefined) setSample(undefined);
    return raw;
  }
  const previous = sample?.timer === timer ? sample?.envelope : undefined;
  const envelope = peakHold(previous, raw, now, release);
  if (sample?.raw !== raw || sample.timer !== timer) {
    setSample({ raw, envelope, timer });
  }
  return envelope.value;
}

interface KeptFix {
  readonly fix: Fix;
  readonly timer: number;
}

// The fix to measure the walk of the timer started at `timer` with: the
// latest one when reliable, otherwise the last reliable one of this timer
function useReliableFix(
  position: Fix | undefined,
  timer: number | undefined
): Fix | undefined {
  const [kept, setKept] = useState<KeptFix>();
  if (position === undefined || timer === undefined) return undefined;
  if (reliableFix(position, timer)) {
    if (kept?.fix !== position || kept.timer !== timer) {
      setKept({ fix: position, timer });
    }
    return position;
  }
  return kept?.timer === timer ? kept.fix : undefined;
}

// Runs the active timer on every page: follows the bus with the real-time
// data, measures the walk to the stop and fires the alerts.
export function TimerProvider({ children }: { children: React.ReactNode }) {
  const timer = timerStore.useValue();
  const stored = settingsStore.useValue() ?? defaultSettings;
  const granted = useGeolocationGranted();
  const settings: Required<TimerSettings> = {
    ...stored,
    useLocation: stored.useLocation ?? granted,
  };
  const active = timer !== null && timer !== undefined;
  const now = useNow(active);
  const geolocation = useGeolocation(active && settings.useLocation);
  // Alerts can only fire while the page runs, whichever page it is
  useWakeLock(active);

  // The permission is read on every render: re-render after asking for it
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const notifications = useSyncExternalStore(
    noop,
    notificationPermission,
    () => "default" as const
  );

  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
  }, []);

  // Follow the bus: same polling (and SWR cache) as the stop page
  const { data: departures } = useMonitored<Departure>(
    "/api/timetable/itineraries",
    "itineraries",
    timer && timer.stop.identifiers.length > 0 ? timer.stop.identifiers : null
  );
  // Whether the bus should have left by now: changes once, not every second
  const departed = !!timer && now >= timer.departureAt;
  const found = useMemo(
    () => (timer ? findTimerDeparture(timer, departures, departed) : undefined),
    [timer, departures, departed]
  );
  useEffect(() => {
    if (found === undefined) return;
    timerStore.set((current) =>
      current &&
      (Math.abs(current.departureAt - found.DepartureAt) >= 1000 ||
        current.uid !== (found.Uid ?? current.uid) ||
        current.routing === "")
        ? {
            ...current,
            departureAt: found.DepartureAt,
            time: found.Time,
            uid: current.uid ?? found.Uid,
            // The bus of a journey, found by line and time
            ...(current.routing === ""
              ? {
                  target: found.Target,
                  route: found.Route,
                  dir: found.Dir,
                  routing: found.Routing,
                  img: found.Img,
                }
              : {}),
          }
        : current
    );
  }, [found]);

  // Follow the legs of a journey with the forecasts of the timetable
  const legsKey = timer?.journey && `/api/journey/legs?${legsQuery(timer.journey.legs)}`;
  const { data: legUpdates } = useSWR<ReadonlyArray<LegUpdate>>(
    legsKey ?? null,
    fetcher,
    { refreshInterval: JOURNEY_REFRESH_MS }
  );
  useEffect(() => {
    if (legUpdates === undefined || legsKey === undefined) return;
    timerStore.set((current) => {
      const journey = current?.journey;
      if (!journey || `/api/journey/legs?${legsQuery(journey.legs)}` !== legsKey) {
        return current;
      }
      const legs = applyLegUpdates(journey.legs, legUpdates);
      // Until its bus is in the real-time data, the first leg follows the
      // timetable
      const followed = current.routing !== "" || current.uid !== undefined;
      const departureAt = expected(legs[0].departure);
      const moved = !followed && departureAt !== current.departureAt;
      if (legs === journey.legs && !moved) return current;
      return {
        ...current,
        journey: { ...journey, legs },
        ...(moved ? { departureAt, time: formatTime(departureAt) } : {}),
      };
    });
  }, [legUpdates, legsKey]);

  const fix = useReliableFix(geolocation.position, timer?.startedAt);
  const rawDistance =
    timer?.coordinates && fix ? distanceMeters(fix, timer.coordinates) : undefined;
  const accuracy = fix?.accuracy;
  useEffect(() => {
    if (rawDistance === undefined || accuracy === undefined) return;
    timerStore.set((current) => {
      if (!current) return current;
      const next = approach(current.approach, rawDistance, accuracy);
      return next === current.approach ? current : { ...current, approach: next };
    });
  }, [rawDistance, accuracy]);
  const stage = timer?.approach?.stage ?? "away";
  // Too far to walk to the stop (on another bus, in another town): the walk
  // of the GPS would make the user hours late
  const far =
    rawDistance !== undefined && stage !== "arrived" && isFar(rawDistance)
      ? rawDistance
      : undefined;

  const distance = useSteadyDistance(
    far === undefined ? rawDistance : undefined,
    now,
    timer?.startedAt,
    // On the way the distance really shrinks: follow it, faster than any
    // pace, instead of holding it back as GPS noise
    walkingRelease(settings.pace) * (stage === "walking" ? 3 : 1)
  );
  // The walk to the stop slows down uphill
  const climb = useClimb(
    distance !== undefined && stage !== "arrived" ? fix : undefined,
    timer?.coordinates
  );
  // Without a usable position, a journey counts on the walk of the timetable
  const plannedWalk = timer?.journey?.legs[0].walkBeforeMs;
  const walkSource: WalkSource | undefined =
    stage === "arrived" || distance !== undefined
      ? "gps"
      : plannedWalk === undefined
        ? undefined
        : "timetable";
  const walk =
    stage === "arrived"
      ? 0
      : distance !== undefined
        ? walkingSeconds(distance, settings.pace, climb)
        : plannedWalk === undefined
          ? undefined
          : (plannedWalk / 1000) * (PACE_SPEED.normal / PACE_SPEED[settings.pace]);
  // Far away there is no time to leave yet: count down to the bus
  const current =
    timer && now > 0
      ? countdown(timer.departureAt, now, far === undefined ? walk : undefined)
      : undefined;

  const legs = useMemo(
    () => (timer && now > 0 ? liveLegs(timer, now) : undefined),
    [timer, now]
  );
  // The stops of the transfers, for the climb of the walks between them
  const heightOf = useStopHeights(
    (timer?.journey?.legs ?? []).flatMap((leg, index, all) =>
      index === 0 ? [] : [all[index - 1].to.position, leg.from.position].filter(isDefined)
    )
  );
  const journey = useMemo(
    () =>
      legs && legs.length > 1
        ? journeyState(legs, now, walk, { pace: settings.pace, heightOf })
        : undefined,
    [legs, now, walk, settings.pace, heightOf]
  );

  // A lost connection: look for another way from the stop of the transfer
  const lost = journey?.transfers.findIndex(
    (transfer, index) =>
      transfer.status === "missed" && legs !== undefined && expected(legs[index].arrival) >= now
  );
  const lostIndex = lost === undefined || lost === -1 ? undefined : lost;
  const lostLeg = lostIndex === undefined ? undefined : legs?.[lostIndex];
  const readyAt = lostLeg && Math.floor(expected(lostLeg.arrival) / 60_000) * 60_000;
  const { data: plans, error: plansError } = useSWR<ReadonlyArray<Connection>>(
    lostLeg && timer?.journey
      ? `/api/journey/connections?from=${lostLeg.to.id}&to=${timer.journey.to.id}&at=${readyAt}`
      : null,
    fetcher,
    { refreshInterval: JOURNEY_REFRESH_MS * 2 }
  );
  const fallback = useMemo(() => {
    if (lostIndex === undefined || !legs || !plans) return undefined;
    const plan = fallbackPlan(plans, legs[lostIndex], legs[lostIndex + 1], {
      pace: settings.pace,
      heightOf,
    });
    return plan && { index: lostIndex, plan };
  }, [lostIndex, legs, plans, settings.pace, heightOf]);

  // Plan and fire the alerts, then drop the timer some time after the
  // departure. Reads the stored timer: it may have changed since the render.
  useEffect(() => {
    const stored = timerStore.get();
    if (!stored || !current) return;
    if (timerEndsAt(stored, legs) < Date.now() - EXPIRES_AFTER_MS) {
      timerStore.set(null);
      return;
    }

    // Far from the stop the alerts wait for the user to be within walking
    // distance, then they are planned on the walk
    let next = far === undefined ? planAlerts(stored, walkSource, current.leaveMs) : stored;
    // Telling to leave is pointless once on the way
    const due =
      far !== undefined || current.departureMs < -60_000 || stage !== "away"
        ? undefined
        : dueAlert(next.thresholds, next.fired, current.leaveMs / 60_000);
    const message =
      due === undefined
        ? undefined
        : alertMessage(next.line, next.destination, current);
    if (due !== undefined && message !== undefined) {
      next = {
        ...next,
        fired: [...next.fired, due],
        lastAlert: { ...message, at: Date.now() },
      };
    }

    if (next !== stored) timerStore.set(next);
    if (message !== undefined) void notify(message);
  }, [current, walkSource, far, legs, stage]);

  // Alert when a connection gets worse. A lost one waits for the way to fall
  // back on, unless it cannot be found.
  useEffect(() => {
    const stored = timerStore.get();
    if (!stored?.journey || !journey || !legs) return;
    const due = dueTransferAlert(journey.transfers, legs, stored.journey.alerted, Date.now());
    if (due === undefined) return;
    const searching = due.status === "missed" && plans === undefined && plansError === undefined;
    if (searching) return;

    let alternative: Alternative | undefined;
    if (due.status === "missed" && fallback?.index === due.index) {
      const { plan } = fallback;
      alternative = {
        leg: plan.legs[0],
        laterMs:
          expected(plan.legs[plan.legs.length - 1].arrival) +
          (plan.walkAfterMs ?? 0) -
          (journey.arrivalAt + (stored.journey.walkAfterMs ?? 0)),
      };
    }
    const message = transferMessage(legs[due.index + 1], journey.transfers[due.index], alternative);
    timerStore.set({
      ...stored,
      journey: { ...stored.journey, alerted: [...stored.journey.alerted, due.key] },
      ...(message ? { lastAlert: { ...message, at: Date.now() } } : {}),
    });
    if (message !== undefined) void notify(message);
  }, [journey, legs, fallback, plans, plansError]);

  // Sound needs a gesture: unlock it on the first tap while a timer runs
  useEffect(() => {
    if (!active) return;
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, [active]);

  // The notifications are asked only from their button on the timer page:
  // Chrome blocks a site for a week once its request is dismissed three
  // times, as when asked on every start of a timer
  const start = useCallback<TimerContextValue["start"]>((departure, stop, coordinates) => {
    unlockAudio();
    timerStore.set(createTimer(departure, stop, coordinates, Date.now()));
  }, []);

  const startJourney = useCallback<TimerContextValue["startJourney"]>(
    (connection, from, to, targets) => {
      unlockAudio();
      timerStore.set(createJourneyTimer(connection, from, to, targets, Date.now()));
    },
    []
  );

  const reroute = useCallback<TimerContextValue["reroute"]>((index, plan) => {
    timerStore.set((current) => {
      if (!current?.journey) return current;
      const legs = [...current.journey.legs.slice(0, index + 1), ...plan.legs];
      return {
        ...current,
        journey: {
          ...current.journey,
          legs,
          walkAfterMs: plan.walkAfterMs,
          // The transfers after `index` are new
          alerted: current.journey.alerted.filter(
            (key) => Number(key.split(":")[0]) < index
          ),
        },
      };
    });
  }, []);

  const cancel = useCallback(() => timerStore.set(null), []);

  const updateSettings = useCallback((patch: Partial<TimerSettings>) => {
    settingsStore.set((s) => ({ ...s, ...patch }));
  }, []);

  const enableNotifications = useCallback(async () => {
    await requestNotifications();
    rerender();
  }, [rerender]);

  const dismissAlert = useCallback(
    () => timerStore.set((t) => t && { ...t, lastAlert: undefined }),
    []
  );

  const value: TimerContextValue = {
    timer: timer ?? null,
    settings,
    countdown: current,
    distance,
    climb,
    far,
    geolocation,
    stage,
    live:
      found !== undefined ||
      (timer?.routing === "" && legs?.[0].departure.estimated !== undefined),
    notifications,
    legs,
    journey,
    fallback,
    start,
    startJourney,
    reroute,
    cancel,
    updateSettings,
    enableNotifications,
    dismissAlert,
  };

  return <TimerContext value={value}>{children}</TimerContext>;
}
