"use client";

import {
  Bell,
  BellOff,
  Bus,
  Footprints,
  LocateFixed,
  Smartphone,
  TimerOff,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { type RefObject, useCallback, useRef, useState } from "react";
import { AlertBanner } from "~/app/components/alert-banner";
import { LineBadge } from "~/app/components/line-badge";
import { PageHeader } from "~/app/components/page-header";
import { Switch } from "~/components/ui/switch";
import { useWakeLock } from "~/hooks/use-wake-lock";
import { formatClock, formatDistance } from "~/lib/format";
import { cn } from "~/lib/utils";
import { type Countdown, minutesLeft, type Pace } from "~/timer/plan";
import type { ActiveTimer } from "~/timer/store";
import { useTimer } from "~/timer/timer-provider";
import { timerHeadline, timerTone, toneBackground, toneText } from "~/timer/tone";

// MapLibre needs the browser (WebGL) and is large: load it only when shown
const WalkMap = dynamic(() => import("./walk-map").then((module) => module.WalkMap), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-muted" />,
});

const paces: ReadonlyArray<{ value: Pace; label: string }> = [
  { value: "slow", label: "Con calma" },
  { value: "normal", label: "Normale" },
  { value: "fast", label: "Di fretta" },
];

// Share of the time left since the timer started: the ring, or the bar of the
// compact countdown
function timerProgress(active: ActiveTimer, countdown: Countdown): number {
  if (timerTone(countdown) === "gone") return 0;
  if (countdown.leaveMs < 0) return 1;
  const total = active.departureAt - active.startedAt - (countdown.walkingMs ?? 0);
  return Math.min(1, Math.max(0, total > 0 ? timerHeadline(countdown).ms / total : 0));
}

function marginLabel({ walkingMs, leaveMs }: Countdown): string {
  if (walkingMs === undefined) return "—";
  return leaveMs < 0
    ? `−${minutesLeft(-leaveMs)} min`
    : `+${Math.floor(leaveMs / 60_000)} min`;
}

export default function TimerPage() {
  const timer = useTimer();
  const { timer: active, countdown } = timer;
  useWakeLock(active !== null);
  // Whether the ring has scrolled away under the header
  const [compact, setCompact] = useState(false);
  const header = useRef<HTMLDivElement>(null);

  return (
    <main className="flex flex-1 flex-col">
      <div ref={header} className="sticky top-0 z-20">
        <PageHeader back="/" title="Timer" />
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
          <h2 className="text-lg font-semibold">Nessun timer attivo</h2>
          <p className="text-sm text-muted-foreground">
            Apri una fermata e tocca la campanella accanto a una partenza: ti
            avviseremo quando è ora di uscire.
          </p>
          <Link
            href="/"
            className="mt-2 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
            Scegli una fermata
          </Link>
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
  const tone = timerTone(countdown);
  const headline = timerHeadline(countdown);
  const walking = countdown.walkingMs !== undefined;

  return (
    <div
      inert={!show}
      className={cn(
        "absolute inset-x-0 top-full border-b border-border/60 bg-background/85 backdrop-blur-xl transition-[opacity,translate] duration-200",
        show ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
      )}>
      <button
        type="button"
        aria-label="Torna al timer"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="flex w-full items-center gap-4 px-4 py-2 text-left">
        <div className="flex min-w-0 flex-col">
          <span className={cn("text-xs font-semibold", toneText[tone])}>
            {headline.label}
          </span>
          <span className="font-mono text-3xl font-semibold leading-none tracking-tight tabular-nums">
            {formatClock(headline.ms)}
          </span>
        </div>
        <dl className="ml-auto flex gap-4 text-right">
          {walking ? (
            <>
              <CompactStat label="Bus tra" value={formatClock(Math.max(0, countdown.departureMs))} />
              <CompactStat
                label="Margine"
                value={marginLabel(countdown)}
                className={toneText[tone]}
              />
            </>
          ) : (
            <CompactStat label="Partenza" value={active.time} />
          )}
        </dl>
      </button>
      <div className="h-1 bg-muted">
        <div
          className={cn("h-full transition-[width] duration-1000 ease-linear", toneBackground[tone])}
          style={{ width: `${timerProgress(active, countdown) * 100}%` }}
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
    geolocation,
    live,
    notifications,
    cancel,
    updateSettings,
    enableNotifications,
  } = useTimer();
  const tone = timerTone(countdown);
  const headline = timerHeadline(countdown);
  const walking = countdown.walkingMs;

  const progress = timerProgress(active, countdown);

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
      {/* The bus */}
      <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <LineBadge img={active.img} route={active.route} line={active.line} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{active.destination}</p>
          <p className="truncate text-xs text-muted-foreground">
            da {active.stop.name} · alle{" "}
            <span className="font-mono tabular-nums">{active.time}</span>
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            live ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
          )}>
          {live ? "Live" : "Ultimo dato"}
        </span>
      </section>

      {/* Countdown */}
      <section className="flex flex-col items-center rounded-3xl border border-border bg-card px-4 py-6 shadow-sm">
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
            <span className={cn("text-sm font-semibold", toneText[tone])}>
              {headline.label}
            </span>
            <span className="font-mono text-6xl font-semibold tracking-tight tabular-nums">
              {formatClock(headline.ms)}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              {tone === "gone"
                ? "Il bus è partito"
                : countdown.departureMs <= 0
                  ? "Il bus sta arrivando"
                  : walking === undefined
                    ? `alla fermata ${active.stop.name}`
                    : `Bus tra ${formatClock(countdown.departureMs)}`}
            </span>
          </div>
        </div>

        <dl className="mt-5 grid w-full grid-cols-3 divide-x divide-border text-center">
          <Stat label="Partenza" value={active.time} mono />
          <Stat
            label="A piedi"
            value={walking === undefined ? "—" : `${Math.max(1, Math.round(walking / 60_000))} min`}
            hint={distance === undefined ? undefined : formatDistance(distance)}
          />
          <Stat
            label="Margine"
            value={marginLabel(countdown)}
            className={walking === undefined ? undefined : toneText[tone]}
          />
        </dl>
      </section>

      {nextAlert !== undefined && tone !== "gone" && (
        <p className="px-1 text-center text-xs text-muted-foreground">
          Prossimo avviso tra{" "}
          <span className="font-medium text-foreground">
            {formatClock((reference - nextAlert) * 60_000)}
          </span>
          {nextAlert === 0
            ? walking === undefined
              ? ", alla partenza"
              : ", quando devi uscire"
            : `, a ${nextAlert} min ${walking === undefined ? "dalla partenza" : "dall'uscita"}`}
        </p>
      )}

      {/* Location */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 p-4">
          <LocateFixed className="size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Calcola quando uscire</p>
            <p className="text-xs text-muted-foreground">
              {!active.coordinates
                ? "Posizione della fermata non disponibile"
                : !settings.useLocation
                  ? "Usa il GPS per stimare il tempo a piedi fino alla fermata"
                  : geolocation.error === "denied"
                    ? "Posizione non autorizzata nelle impostazioni del browser"
                    : geolocation.error
                      ? "Posizione non disponibile"
                      : geolocation.position
                        ? `Precisione ±${Math.round(geolocation.position.accuracy)} m`
                        : "Localizzazione in corso…"}
            </p>
          </div>
          <Switch
            label="Usa la mia posizione"
            checked={settings.useLocation}
            disabled={!active.coordinates}
            onCheckedChange={(useLocation) => updateSettings({ useLocation })}
          />
        </div>
        {settings.useLocation && active.coordinates && !geolocation.error && (
          <div className="flex items-center gap-3 border-t border-border px-4 py-3">
            <Footprints className="size-5 shrink-0 text-muted-foreground" />
            <div className="grid flex-1 grid-cols-3 gap-1 rounded-xl bg-muted p-1">
              {paces.map((pace) => (
                <button
                  key={pace.value}
                  type="button"
                  aria-pressed={settings.pace === pace.value}
                  onClick={() => updateSettings({ pace: pace.value })}
                  className={cn(
                    "rounded-lg py-1.5 text-xs font-medium transition-colors",
                    settings.pace === pace.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}>
                  {pace.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {settings.useLocation && active.coordinates && !geolocation.error && (
          <div className="h-56 border-t border-border">
            <WalkMap stop={active.coordinates} position={geolocation.position} />
          </div>
        )}
      </section>

      {/* Notifications */}
      <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        {notifications === "granted" ? (
          <Bell className="size-5 shrink-0 text-primary" />
        ) : notifications === "unsupported" ? (
          <Smartphone className="size-5 shrink-0 text-muted-foreground" />
        ) : (
          <BellOff className="size-5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Notifiche</p>
          <p className="text-xs text-muted-foreground">
            {notifications === "granted"
              ? "Avvisi sempre più frequenti man mano che si avvicina l'ora"
              : notifications === "denied"
                ? "Bloccate: riattivale dalle impostazioni del browser"
                : notifications === "unsupported"
                  ? "Su iPhone aggiungi l'app alla schermata Home per riceverle"
                  : "Ricevi un avviso anche con l'app in secondo piano"}
          </p>
        </div>
        {notifications === "default" && (
          <button
            type="button"
            onClick={() => void enableNotifications()}
            className="h-9 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground">
            Attiva
          </button>
        )}
      </section>

      <p className="px-2 text-center text-xs text-muted-foreground">
        Tieni aperta questa pagina: lo schermo resta acceso e gli avvisi arrivano
        puntuali.
      </p>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Link
          href={`/routing/${active.target}/${active.route}/${active.dir}/${active.routing}`}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold shadow-sm transition-colors hover:bg-muted">
          <Bus className="size-4" />
          Dov&apos;è il bus?
        </Link>
        <button
          type="button"
          onClick={cancel}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-destructive/10 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/15">
          <TimerOff className="size-4" />
          {tone === "gone" ? "Chiudi" : "Annulla timer"}
        </button>
      </div>
    </div>
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
