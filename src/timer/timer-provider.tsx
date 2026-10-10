"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useSyncExternalStore,
} from "react";
import { type GeolocationState, useGeolocation } from "~/hooks/use-geolocation";
import { useMonitored } from "~/hooks/use-monitored";
import { useNow } from "~/hooks/use-now";
import type { Coordinates, Departure } from "~/timetable/models";
import {
  notificationPermission,
  notify,
  requestNotifications,
  unlockAudio,
} from "./alerts";
import {
  alertMessage,
  alertThresholds,
  type Countdown,
  countdown,
  distanceMeters,
  dueAlert,
  walkingSeconds,
} from "./plan";
import {
  type ActiveTimer,
  createTimer,
  findTimerDeparture,
  type ScheduledDeparture,
  settingsStore,
  type TimerSettings,
  timerStore,
} from "./store";

// The timer is gone this long after the departure
const EXPIRES_AFTER_MS = 10 * 60_000;

const defaultSettings: TimerSettings = { useLocation: false, pace: "normal" };

export interface TimerContextValue {
  readonly timer: ActiveTimer | null;
  readonly settings: TimerSettings;
  readonly countdown: Countdown | undefined;
  readonly distance: number | undefined;
  readonly geolocation: GeolocationState;
  // Whether the bus is in the latest real-time data
  readonly live: boolean;
  readonly notifications: NotificationPermission | "unsupported";
  start(
    departure: ScheduledDeparture,
    stop: ActiveTimer["stop"],
    coordinates: Coordinates | undefined
  ): void;
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

// Runs the active timer on every page: follows the bus with the real-time
// data, measures the walk to the stop and fires the alerts.
export function TimerProvider({ children }: { children: React.ReactNode }) {
  const timer = timerStore.useValue();
  const settings = settingsStore.useValue() ?? defaultSettings;
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
    timer ? timer.stop.identifiers : null
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
        current.uid !== (found.Uid ?? current.uid))
        ? {
            ...current,
            departureAt: found.DepartureAt,
            time: found.Time,
            uid: current.uid ?? found.Uid,
          }
        : current
    );
  }, [found]);

  const distance =
    timer?.coordinates && geolocation.position
      ? distanceMeters(geolocation.position, timer.coordinates)
      : undefined;
  const walk =
    distance === undefined ? undefined : walkingSeconds(distance, settings.pace);
  const current =
    timer && now > 0 ? countdown(timer.departureAt, now, walk) : undefined;

  // Plan and fire the alerts, then drop the timer some time after the
  // departure. Reads the stored timer: it may have changed since the render.
  useEffect(() => {
    const stored = timerStore.get();
    if (!stored || !current) return;
    if (current.departureMs < -EXPIRES_AFTER_MS) {
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
  }, [current, walk]);

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
    []
  );

  const cancel = useCallback(() => timerStore.set(null), []);

  const updateSettings = useCallback((patch: Partial<TimerSettings>) => {
    settingsStore.set((s) => ({ ...s, ...patch }));
  }, []);

  const enableNotifications = useCallback(async () => {
    await requestNotifications();
    rerender();
  }, []);

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
    live: found !== undefined,
    notifications,
    start,
    cancel,
    updateSettings,
    enableNotifications,
    dismissAlert,
  };

  return <TimerContext value={value}>{children}</TimerContext>;
}
