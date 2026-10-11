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
  alertThresholds,
  type Countdown,
  countdown,
  distanceMeters,
  dueAlert,
  type Envelope,
  PACE_SPEED,
  peakHold,
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
  readonly geolocation: GeolocationState;
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
  const found = useMemo(
    () => (timer ? findTimerDeparture(timer, departures) : undefined),
    [timer, departures]
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

  const distance = useSteadyDistance(
    timer?.coordinates && geolocation.position
      ? distanceMeters(geolocation.position, timer.coordinates)
      : undefined,
    now,
    timer?.startedAt,
    walkingRelease(settings.pace)
  );
  // Without a position, a journey counts on the walk of the timetable
  const plannedWalk = timer?.journey?.legs[0].walkBeforeMs;
  const walk =
    distance !== undefined
      ? walkingSeconds(distance, settings.pace)
      : plannedWalk === undefined
        ? undefined
        : (plannedWalk / 1000) * (PACE_SPEED.normal / PACE_SPEED[settings.pace]);
  const current =
    timer && now > 0 ? countdown(timer.departureAt, now, walk) : undefined;

  const legs = useMemo(
    () => (timer && now > 0 ? liveLegs(timer, now) : undefined),
    [timer, now]
  );
  const journey = useMemo(
    () =>
      legs && legs.length > 1
        ? journeyState(legs, now, walk, { pace: settings.pace })
        : undefined,
    [legs, now, walk, settings.pace]
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
    if (lostIndex === undefined || readyAt === undefined || !plans) return undefined;
    const plan = fallbackPlan(plans, readyAt, { pace: settings.pace });
    return plan && { index: lostIndex, plan };
  }, [lostIndex, readyAt, plans, settings.pace]);

  // Plan and fire the alerts, then drop the timer some time after the
  // departure. Reads the stored timer: it may have changed since the render.
  useEffect(() => {
    const stored = timerStore.get();
    if (!stored || !current) return;
    if (timerEndsAt(stored, legs) < Date.now() - EXPIRES_AFTER_MS) {
      timerStore.set(null);
      return;
    }

    let next = stored;
    // Once the walking time is known, plan the alerts on the time to leave
    if (walk !== undefined && !next.plannedWithWalk && next.fired.length === 0) {
      next = {
        ...next,
        thresholds: alertThresholds(current.leaveMs / 60_000),
        plannedWithWalk: true,
      };
    }
    const due =
      current.departureMs < -60_000
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
  }, [current, walk, legs]);

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

  const start = useCallback<TimerContextValue["start"]>(
    (departure, stop, coordinates) => {
      unlockAudio();
      timerStore.set(createTimer(departure, stop, coordinates, Date.now()));
      // Asked right away, while handling the click
      void requestNotifications().then(() => rerender());
    },
    [rerender]
  );

  const startJourney = useCallback<TimerContextValue["startJourney"]>(
    (connection, from, to, targets) => {
      unlockAudio();
      timerStore.set(createJourneyTimer(connection, from, to, targets, Date.now()));
      void requestNotifications().then(() => rerender());
    },
    [rerender]
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
    geolocation,
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
