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
import { useI18n } from "~/i18n/i18n-provider";
import { useNow } from "~/hooks/use-now";
import { useWakeLock } from "~/hooks/use-wake-lock";
import { useClimb, useStopHeights } from "~/terrain/use-climb";
import type { Connection, LegUpdate, PlannedLeg, Station } from "~/journey/models";
import type { Coordinates, Departure, RoutingStop, Target } from "~/timetable/models";
import { fetcher } from "~/utils/fetcher";
import { useWeather } from "~/weather/use-weather";
import {
  notificationPermission,
  notify,
  requestNotifications,
  unlockAudio,
} from "./alerts";
import {
  clockAt,
  dueGetOffAlert,
  followRide,
  getOffMessage,
  type Ride,
  rideState,
} from "./get-off";
import {
  type Alternative,
  expected,
  fallbackPlan,
  formatTime,
  type JourneyState,
  journeyState,
  plannedWalkMs,
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
  type WeatherDelay,
  walkingRelease,
  walkingSeconds,
  weatherDelay,
  weatherWalk,
} from "./plan";
import { reachStop } from "./progress";
import { recordStart, ridesStore } from "./rides";
import {
  followWalk,
  type LearnedPace,
  learnPace,
  NO_PACE,
  type PaceSpeeds,
  paceSpeeds,
} from "./pace";
import {
  type ActiveTimer,
  applyLegUpdates,
  createJourneyTimer,
  createOnBoardTimer,
  createTimer,
  dueTransferAlert,
  findTimerDeparture,
  legsQuery,
  liveLegs,
  nextTimerDeparture,
  paceStore,
  planAlerts,
  rerouteJourney,
  type GetOffChoice,
  type OnBoard,
  type ScheduledDeparture,
  settingsStore,
  type TimerSettings,
  timerEndsAt,
  timerStore,
} from "./store";

// The timer is gone this long after the departure (the arrival of a journey,
// or at the stop to get off)
const EXPIRES_AFTER_MS = 10 * 60_000;
// The ride is followed from shortly before the departure: earlier, the
// routing of the line may show the run before
const BOARDING_MS = 60_000;
// The forecasts of the timetable change about every minute
const JOURNEY_REFRESH_MS = 30_000;

const defaultSettings: TimerSettings = { pace: "normal" };

export interface TimerContextValue {
  readonly timer: ActiveTimer | null;
  readonly settings: Required<TimerSettings>;
  // The walks measured so far, and the walking speed of each pace in meters
  // per second: the learned one once there are enough walks
  readonly learnedPace: LearnedPace;
  readonly speeds: PaceSpeeds;
  readonly countdown: Countdown | undefined;
  readonly distance: number | undefined;
  // Meters to go up to the stop (negative downhill), when known
  readonly climb: number | undefined;
  // What the rain or the snow add to the walk measured with the GPS, from a
  // minute up
  readonly weather: WeatherDelay | undefined;
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
  // The walk from the last stop to the destination of a journey, at the pace
  // of the user and slower uphill
  readonly walkAfterMs: number | undefined;
  // The way to fall back on when a connection is lost, from its stop
  readonly fallback: { readonly index: number; readonly plan: Connection } | undefined;
  // The next bus of the same line from the stop that can still be caught, to
  // move a single departure on once missed
  readonly next: ScheduledDeparture | undefined;
  // A single bus with a stop to get off: where it is on the way there, once
  // followed with the routing
  readonly ride: Ride | undefined;
  start(
    departure: ScheduledDeparture,
    stop: ActiveTimer["stop"],
    coordinates: Coordinates | undefined
  ): void;
  // A bus the user is already on, getting off at the stop chosen
  board(ride: OnBoard): void;
  startJourney(
    connection: Connection,
    from: Station,
    to: Station,
    targets: ReadonlyArray<Target> | undefined
  ): void;
  // Continues the journey after the leg `index` with another plan, to
  // another destination `to` when given
  reroute(index: number, plan: Connection, to?: Station): void;
  // Sets the stop to get off a single bus, with its time in the routing, or
  // clears it
  chooseGetOff(stop: GetOffChoice | undefined): void;
  cancel(): void;
  updateSettings(patch: Partial<TimerSettings>): void;
  // Forgets the walks measured: back to the default paces
  resetPace(): void;
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
  // The alerts are written in the language of the page
  const { m } = useI18n();
  const timer = timerStore.useValue();
  const stored = settingsStore.useValue() ?? defaultSettings;
  const granted = useGeolocationGranted();
  const settings: Required<TimerSettings> = {
    ...stored,
    useLocation: stored.useLocation ?? granted,
  };
  const learnedPace = paceStore.useValue() ?? NO_PACE;
  const speeds = useMemo(() => paceSpeeds(learnedPace), [learnedPace]);
  const speed = speeds[settings.pace];
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
  const stage = timer?.approach?.stage ?? "away";
  // Too far to walk to the stop (on another bus, in another town): the walk
  // of the GPS would make the user hours late
  const far =
    rawDistance !== undefined && stage !== "arrived" && isFar(rawDistance)
      ? rawDistance
      : undefined;

  // The walk to the stop is longer and slower uphill, and slower in the rain
  // or the snow
  const walkingFix =
    rawDistance !== undefined && far === undefined && stage !== "arrived" ? fix : undefined;
  const climb = useClimb(walkingFix, timer?.coordinates);
  const weatherNow = weatherWalk(useWeather(walkingFix));

  const distance = useSteadyDistance(
    far === undefined ? rawDistance : undefined,
    now,
    timer?.startedAt,
    // On the way the distance really shrinks: follow it, faster than any
    // pace, instead of holding it back as GPS noise. The longer and steeper
    // the way of the streets, the slower the distance as the crow flies
    // shrinks.
    walkingRelease(speed, rawDistance, climb) * (stage === "walking" ? 3 : 1)
  );

  // Move forward on the way to the stop, and measure the walk there to learn
  // the pace of the user. Runs again with the same fix when the climb, the
  // pace or the weather change: both steps then return what they had.
  const fixAt = fix?.at;
  const pace = settings.pace;
  const weatherFactor = weatherNow.factor;
  useEffect(() => {
    if (rawDistance === undefined || accuracy === undefined || fixAt === undefined) return;
    const current = timerStore.get();
    if (!current) return;
    const next = approach(current.approach, rawDistance, accuracy);
    const { walk, speed: walked } = followWalk(current.walk, current.approach, next, {
      meters: rawDistance,
      accuracy,
      at: fixAt,
      climb,
      pace,
    });
    // The walk ends at the stop: keep when it started, for the trip so far
    const atStop = reachStop(current.atStop, current.approach?.stage ?? "away", next.stage, current.walk, {
      meters: rawDistance,
      at: fixAt,
    });
    if (next !== current.approach || walk !== current.walk || atStop !== current.atStop) {
      timerStore.set({ ...current, approach: next, walk, atStop });
    }
    // A walk in the rain is slower than the pace of the user: learn it as dry
    if (walked !== undefined) {
      paceStore.set((learned) => learnPace(learned, walked * weatherFactor));
    }
  }, [rawDistance, accuracy, fixAt, climb, pace, weatherFactor]);
  // Without a usable position, a journey counts on the walk of the timetable
  const plannedWalk = timer?.journey?.legs[0].walkBeforeMs;
  const walkSource: WalkSource | undefined =
    stage === "arrived" || distance !== undefined
      ? "gps"
      : plannedWalk === undefined
        ? undefined
        : "timetable";
  // The timetable plans its walks at the default normal pace
  const walk =
    stage === "arrived"
      ? 0
      : distance !== undefined
        ? walkingSeconds(distance, speed, climb) * weatherNow.factor
        : plannedWalk === undefined
          ? undefined
          : (plannedWalk / 1000) * (PACE_SPEED.normal / speed);
  // Without the GPS the weather is not asked: the walk stays as dry
  const weather = walk === undefined ? undefined : weatherDelay(walk, weatherNow);
  // Far away there is no time to leave yet: count down to the bus
  const current =
    timer && now > 0
      ? countdown(timer.departureAt, now, far === undefined ? walk : undefined)
      : undefined;

  // A bus that can still be caught once at the stop, walking from now
  const next =
    timer && current
      ? nextTimerDeparture(timer, departures, now + (current.walkingMs ?? 0))
      : undefined;

  const legs = useMemo(
    () => (timer && now > 0 ? liveLegs(timer, now) : undefined),
    [timer, now]
  );
  // The stops of the transfers and of the walk to the destination, for the
  // climb of the walks between them
  const lastStop = timer?.journey?.legs.at(-1)?.to;
  const destination = timer?.journey?.to;
  const plannedWalkAfter = timer?.journey?.walkAfterMs;
  const heightOf = useStopHeights([
    ...(timer?.journey?.legs ?? []).flatMap((leg, index, all) =>
      index === 0 ? [] : [all[index - 1].to.position, leg.from.position].filter(isDefined)
    ),
    ...(plannedWalkAfter === undefined
      ? []
      : [lastStop?.position, destination?.position].filter(isDefined)),
  ]);
  const walkAfterMs =
    plannedWalkAfter === undefined || lastStop === undefined || destination === undefined
      ? plannedWalkAfter
      : plannedWalkMs(plannedWalkAfter, lastStop, destination, speed, heightOf);
  const journey = useMemo(
    () =>
      legs && legs.length > 1
        ? journeyState(legs, now, walk, { speed, heightOf })
        : undefined,
    [legs, now, walk, speed, heightOf]
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
      speed,
      heightOf,
    });
    return plan && { index: lostIndex, plan };
  }, [lostIndex, legs, plans, speed, heightOf]);

  // Follow the ride to the stop to get off: same polling (and SWR cache) as
  // the line page
  const getOff = timer?.journey === undefined ? timer?.getOff : undefined;
  const boarding = !!timer && now >= timer.departureAt - BOARDING_MS;
  const { data: routingStops, isError: routingError } = useMonitored<RoutingStop>(
    "/api/timetable/routing",
    "routing",
    timer && getOff && boarding && timer.routing !== ""
      ? [timer.target, timer.route, timer.dir, timer.routing]
      : null
  );
  // Data kept from before an error would show the bus standing still
  const mine = timer?.target;
  const getOffTarget = getOff?.target;
  const getOffLeft = getOff?.left;
  const ride = useMemo(
    () =>
      mine !== undefined && getOffTarget !== undefined && boarding && !routingError
        ? rideState(routingStops, mine, { target: getOffTarget, left: getOffLeft })
        : undefined,
    [mine, getOffTarget, getOffLeft, boarding, routingError, routingStops]
  );
  useEffect(() => {
    if (ride === undefined) return;
    timerStore.set((current) => {
      if (!current?.getOff) return current;
      const next = followRide(current.getOff, ride, Date.now());
      return next === current.getOff ? current : { ...current, getOff: next };
    });
  }, [ride]);
  // Without the routing, how close the bus is to the stop by the GPS
  const getOffDistance =
    getOff?.position && fix ? distanceMeters(fix, getOff.position) : undefined;

  // Tell when the stop to get off is next, then when it is reached
  useEffect(() => {
    const stored = timerStore.get();
    const getOff = stored?.journey === undefined ? stored?.getOff : undefined;
    if (!stored || !getOff) return;
    const due = dueGetOffAlert(ride, getOffDistance, getOff.alerted, departed);
    if (due === undefined) return;
    const message = getOffMessage(m, due, getOff, stored.line, stored.destination);
    timerStore.set({
      ...stored,
      getOff: { ...getOff, alerted: [...getOff.alerted, due] },
      lastAlert: { ...message, at: Date.now() },
    });
    void notify(message);
  }, [ride, getOffDistance, departed, m]);

  // Plan and fire the alerts, then drop the timer some time after the
  // departure. Reads the stored timer: it may have changed since the render.
  useEffect(() => {
    const stored = timerStore.get();
    if (!stored || !current) return;
    if (timerEndsAt(stored, legs, walkAfterMs) < Date.now() - EXPIRES_AFTER_MS) {
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
        : alertMessage(m, next.line, next.destination, current, weather?.kind);
    if (due !== undefined && message !== undefined) {
      next = {
        ...next,
        fired: [...next.fired, due],
        lastAlert: { ...message, at: Date.now() },
      };
    }

    if (next !== stored) timerStore.set(next);
    if (message !== undefined) void notify(message);
  }, [current, walkSource, far, legs, walkAfterMs, stage, weather?.kind, m]);

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
    const message = transferMessage(
      m,
      legs[due.index + 1],
      journey.transfers[due.index],
      alternative
    );
    timerStore.set({
      ...stored,
      journey: { ...stored.journey, alerted: [...stored.journey.alerted, due.key] },
      ...(message ? { lastAlert: { ...message, at: Date.now() } } : {}),
    });
    if (message !== undefined) void notify(message);
  }, [journey, legs, fallback, plans, plansError, m]);

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
    const now = Date.now();
    timerStore.set(createTimer(departure, stop, coordinates, now));
    // The hour of the start puts the favorite ride first around that time
    ridesStore.set((rides) =>
      recordStart(
        rides,
        { identifiers: stop.identifiers, route: departure.Route, dir: departure.Dir },
        new Date(now).getHours()
      )
    );
  }, []);

  const board = useCallback<TimerContextValue["board"]>((ride) => {
    unlockAudio();
    timerStore.set(createOnBoardTimer(ride, Date.now()));
  }, []);

  const startJourney = useCallback<TimerContextValue["startJourney"]>(
    (connection, from, to, targets) => {
      unlockAudio();
      timerStore.set(createJourneyTimer(connection, from, to, targets, Date.now()));
    },
    []
  );

  const reroute = useCallback<TimerContextValue["reroute"]>((index, plan, to) => {
    timerStore.set(
      (current) =>
        current?.journey
          ? { ...current, journey: rerouteJourney(current.journey, index, plan, to) }
          : current
    );
  }, []);

  const chooseGetOff = useCallback<TimerContextValue["chooseGetOff"]>((stop) => {
    timerStore.set(
      (current) =>
        current && {
          ...current,
          // Whether the bus has left is about the ride, whatever the stop
          getOff: stop && {
            target: stop.target,
            name: stop.name,
            position: stop.position,
            arrivalAt: clockAt(stop.time, Date.now()),
            left: current.getOff?.left,
            alerted: [],
          },
        }
    );
  }, []);

  const cancel = useCallback(() => timerStore.set(null), []);

  const updateSettings = useCallback((patch: Partial<TimerSettings>) => {
    settingsStore.set((s) => ({ ...s, ...patch }));
  }, []);

  const resetPace = useCallback(() => paceStore.set(NO_PACE), []);

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
    learnedPace,
    speeds,
    countdown: current,
    distance,
    climb,
    weather,
    far,
    geolocation,
    stage,
    live:
      found !== undefined ||
      (timer?.routing === "" && legs?.[0].departure.estimated !== undefined),
    notifications,
    legs,
    journey,
    walkAfterMs,
    fallback,
    next,
    ride,
    start,
    board,
    startJourney,
    reroute,
    chooseGetOff,
    cancel,
    updateSettings,
    resetPace,
    enableNotifications,
    dismissAlert,
  };

  return <TimerContext value={value}>{children}</TimerContext>;
}
