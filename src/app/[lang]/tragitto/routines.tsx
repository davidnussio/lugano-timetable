"use client";

import { BellPlus, CalendarClock, Pause, Play, Trash2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import { currentDevice, installed } from "~/app/[lang]/timer/notifications-card";
import { useI18n } from "~/i18n/i18n-provider";
import type { Messages } from "~/i18n/messages";
import type { Connection, Station } from "~/journey/models";
import { cn } from "~/lib/utils";
import { MAX_ROUTINES, type Routine } from "~/routines/models";
import {
  defaultArriveBy,
  defaultWalkMinutes,
  durationMinutes,
  inLanguage,
  newRoutineId,
  pushSubscription,
  routinesStore,
  saveRoutines,
  VAPID_PUBLIC_KEY,
  WORKDAYS,
} from "~/routines/routine-store";
import { formatDays } from "~/routines/schedule";

type Support = "ready" | "ios-install" | "unsupported" | "no-key";

// iPhones receive push messages only in the app added to the home screen
function pushSupport(): Support {
  if (!VAPID_PUBLIC_KEY) return "no-key";
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) {
    return "ready";
  }
  return currentDevice() === "ios" && !installed() ? "ios-install" : "unsupported";
}

const noop = () => () => {};

const SUPPORT_NOTES = {
  "ios-install": "iosInstall",
  unsupported: "unsupported",
  "no-key": "noKey",
} as const satisfies Record<Exclude<Support, "ready">, keyof Messages["routines"]>;

// The server knows the routines (503 when Redis or the push keys are missing)
const probe = (url: string) => fetch(url).then((response) => response.ok);

// Once per page load: the server copy is put right with the list of the
// browser (a renewed subscription, a lost entry, another language: the
// switch reloads the page)
let synced = false;

async function sync(routines: ReadonlyArray<Routine>): Promise<void> {
  const active = routines.some((routine) => !routine.paused);
  const granted = "Notification" in window && Notification.permission === "granted";
  const subscription = await pushSubscription(active && granted);
  if (subscription) await saveRoutines(subscription, routines);
}

const field =
  "h-10 rounded-xl border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

function RoutineForm({
  from,
  to,
  connection,
  routines,
  onClose,
}: {
  from: Station;
  to: Station;
  connection: Connection | undefined;
  routines: ReadonlyArray<Routine>;
  onClose: () => void;
}) {
  const { locale, m } = useI18n();
  const [days, setDays] = useState<ReadonlyArray<number>>(WORKDAYS);
  const [arriveBy, setArriveBy] = useState(() => defaultArriveBy(connection));
  const [walk, setWalk] = useState(() => String(defaultWalkMinutes(connection)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const walkMinutes = Number(walk);
  const valid =
    days.length > 0 &&
    /^\d{2}:\d{2}$/.test(arriveBy) &&
    Number.isInteger(walkMinutes) &&
    walkMinutes >= 0 &&
    walkMinutes <= 60;

  const toggle = (day: number) =>
    setDays((value) =>
      value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b)
    );

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      // Asked first, while handling the tap: browsers refuse it later
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError(permission === "denied" ? m.routines.denied : m.routines.noPermission);
        return;
      }
      const subscription = await pushSubscription(true);
      if (!subscription) throw new Error("No push subscription");
      const routine: Routine = {
        id: newRoutineId(),
        from: { id: from.id, name: from.name },
        to: { id: to.id, name: to.name },
        days,
        arriveBy,
        walkMinutes,
        durationMinutes: durationMinutes(connection),
        paused: false,
        lang: locale,
      };
      const next = inLanguage([...routines, routine], locale);
      await saveRoutines(subscription, next);
      routinesStore.set(next);
      onClose();
    } catch {
      setError(m.routines.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !busy) void save();
      }}>
      <p className="text-sm font-semibold">
        {from.name} → {to.name}
      </p>
      <fieldset>
        <legend className="pb-1.5 text-xs font-medium text-muted-foreground">
          {m.routines.days}
        </legend>
        <div className="flex gap-1.5">
          {m.routines.dayLetters.map((letter, index) => {
            const day = index + 1;
            const on = days.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                aria-label={m.routines.dayNames[index]}
                onClick={() => toggle(day)}
                className={cn(
                  "grid size-9 place-items-center rounded-full border text-sm font-semibold transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                )}>
                {letter}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">
            {m.routines.arriveBy}
          </span>
          <input
            type="time"
            required
            value={arriveBy}
            onChange={(event) => setArriveBy(event.target.value)}
            className={cn(field, "w-full")}
          />
        </label>
        <label className="space-y-1.5">
          <span className="block truncate text-xs font-medium text-muted-foreground">
            {m.routines.walkFromHome}
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            required
            value={walk}
            onChange={(event) => setWalk(event.target.value)}
            className={cn(field, "w-full")}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{m.routines.formNote(from.name)}</p>
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted">
          {m.routines.cancel}
        </button>
        <button
          type="submit"
          disabled={!valid || busy}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          <BellPlus className="size-4" />
          {busy ? m.routines.saving : m.routines.notify}
        </button>
      </div>
    </form>
  );
}

// The usual journeys saved on this device, and with a journey chosen the
// action to save it as one
export function Routines({
  from,
  to,
  connection,
  onPick,
}: {
  from?: Station;
  to?: Station;
  // The first connection shown: prefills the form
  connection?: Connection;
  onPick: (routine: Routine) => void;
}) {
  const { locale, m } = useI18n();
  const routines = routinesStore.useValue() ?? [];
  const support = useSyncExternalStore(noop, pushSupport, () => null);
  const { data: available } = useSWR("/api/routines", probe, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (synced || available !== true || support !== "ready") return;
    const stored = routinesStore.get();
    if (stored.length === 0) return;
    synced = true;
    const current = inLanguage(stored, locale);
    if (current !== stored) routinesStore.set(current);
    sync(current).catch(() => {
      synced = false;
    });
  }, [available, support, locale]);

  const change = (changed: ReadonlyArray<Routine>) => {
    const next = inLanguage(changed, locale);
    routinesStore.set(next);
    setError(undefined);
    if (support !== "ready") return;
    sync(next).catch(() => setError(m.routines.syncFailed));
  };

  const chosen = from !== undefined && to !== undefined && from.id !== to.id;
  if (routines.length === 0 && (available !== true || !chosen)) return null;

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <CalendarClock className="size-3.5" />
        {m.routines.title}
      </h2>
      {routines.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {routines.map((routine) => (
            <li key={routine.id} className="flex items-center">
              <button
                type="button"
                onClick={() => onPick(routine)}
                className={cn(
                  "min-w-0 flex-1 px-4 py-3 text-left transition-colors hover:bg-muted/60 active:bg-muted",
                  routine.paused && "opacity-60"
                )}>
                <span className="block truncate font-medium">
                  {routine.from.name} → {routine.to.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {routine.paused ? `${m.routines.paused} · ` : ""}
                  {m.routines.summary(
                    formatDays(m, routine.days),
                    routine.arriveBy,
                    routine.walkMinutes
                  )}
                </span>
              </button>
              <button
                type="button"
                aria-label={routine.paused ? m.routines.resume : m.routines.pause}
                onClick={() =>
                  change(
                    routines.map((r) => (r.id === routine.id ? { ...r, paused: !r.paused } : r))
                  )
                }
                className="grid size-11 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-muted">
                {routine.paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              </button>
              <button
                type="button"
                aria-label={m.routines.remove}
                onClick={() => change(routines.filter((r) => r.id !== routine.id))}
                className="grid size-11 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="px-1 text-xs text-destructive">{error}</p>}
      {chosen && available === true && support !== null && routines.length < MAX_ROUTINES && (
        support !== "ready" ? (
          <p className="px-1 text-xs text-muted-foreground">
            {m.routines[SUPPORT_NOTES[support]]}
          </p>
        ) : open ? (
          <RoutineForm
            from={from}
            to={to}
            connection={connection}
            routines={routines}
            onClose={() => setOpen(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-semibold shadow-sm transition-colors hover:bg-muted">
            <BellPlus className="size-4" />
            {m.routines.save}
          </button>
        )
      )}
    </section>
  );
}
