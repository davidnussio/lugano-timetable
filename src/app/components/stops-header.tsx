"use client";

import { ChartColumn, List, MapIcon, Route, Waypoints } from "lucide-react";
import Link from "next/link";
import { logoGlyph } from "~/app/app-icon";
import { useI18n } from "~/i18n/i18n-provider";
import { cn } from "~/lib/utils";

const views = [
  { href: "/", label: "list", Icon: List },
  { href: "/tragitto", label: "journey", Icon: Route },
  { href: "/linee", label: "lines", Icon: Waypoints },
  { href: "/mappa", label: "map", Icon: MapIcon },
] as const;

type View = (typeof views)[number]["href"] | "/storico";

// The switch between the stop list, the journey planner, the lines and the
// map, below the name of the app, which names the view: its title is only
// for screen readers. Only the current view shows its label on narrow
// screens. The history of the trips, opened less often, is a button on the
// line of the name.
export function StopsHeader({ title, current }: { title: string; current: View }) {
  const { m } = useI18n();
  return (
    <header className="flex flex-col gap-3 px-4 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <LogoMark className="size-7 shrink-0" />
            <span>
              Lu<span className="text-primary">Go</span>
            </span>
          </p>
          <h1 className="sr-only">{title}</h1>
        </div>
        <Link
          href="/storico"
          aria-current={current === "/storico" ? "page" : undefined}
          aria-label={m.nav.history}
          title={m.nav.history}
          className={cn(
            "grid size-10 place-items-center rounded-full transition-colors",
            current === "/storico"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}>
          <ChartColumn className="size-5" />
        </Link>
      </div>
      <nav aria-label={m.nav.label} className="flex rounded-full bg-muted p-1">
        {views.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={href === current ? "page" : undefined}
            className={cn(
              "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
              href === current
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}>
            <Icon className="size-4" />
            <span className={cn(href !== current && "sr-only min-[420px]:not-sr-only")}>
              {m.nav[label]}
            </span>
          </Link>
        ))}
      </nav>
    </header>
  );
}

// The app icon, small
function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="logo-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f6bff" />
          <stop offset="1" stopColor="#2f3fd6" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#logo-mark)" />
      {logoGlyph}
    </svg>
  );
}
