"use client";

import { List, MapIcon, Route } from "lucide-react";
import Link from "next/link";
import { logoGlyph } from "~/app/app-icon";
import { useI18n } from "~/i18n/i18n-provider";
import { cn } from "~/lib/utils";

const views = [
  { href: "/", label: "list", Icon: List },
  { href: "/mappa", label: "map", Icon: MapIcon },
  { href: "/tragitto", label: "journey", Icon: Route },
] as const;

type View = (typeof views)[number]["href"];

// The switch between the stop list, the map and the journey planner, which
// names the view: its title is only for screen readers. Only the current
// view shows its label on narrow screens; labels too long to share the line
// push the switch below the name of the app rather than being cut.
export function StopsHeader({ title, current }: { title: string; current: View }) {
  const { m } = useI18n();
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div>
        <p className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <LogoMark className="size-7 shrink-0" />
          <span>
            Lu<span className="text-primary">Go</span>
          </span>
        </p>
        <h1 className="sr-only">{title}</h1>
      </div>
      <nav aria-label={m.nav.label} className="flex shrink-0 rounded-full bg-muted p-1">
        {views.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={href === current ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
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
