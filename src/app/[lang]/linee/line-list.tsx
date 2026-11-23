"use client";

import Link from "next/link";
import { RouteBadge } from "~/app/components/route-badge";
import { useLines } from "~/hooks/use-lines";
import { useI18n } from "~/i18n/i18n-provider";

// The lines of TPL as their badges, each with its two ends. The ends go on
// more lines rather than being cut, since they are what tells the lines
// apart: on a 320px phone the two columns leave them about 68px, enough for
// the longest single word (Breganzona) to stay whole.
export function LineList() {
  const { m } = useI18n();
  const { lines, isError } = useLines();

  if (lines === undefined) {
    if (isError) {
      return (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          {m.common.serviceUnavailable}
        </p>
      );
    }
    return (
      <ul className="grid grid-cols-2 gap-2 px-4 pt-1" aria-busy="true" aria-label={m.common.loading}>
        {Array.from({ length: 8 }, (_, index) => (
          <li key={index} className="h-[68px] animate-pulse rounded-2xl bg-muted" />
        ))}
      </ul>
    );
  }

  if (lines.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-sm text-muted-foreground">{m.lines.none}</p>
    );
  }

  return (
    <div className="px-4 pb-6">
      <p className="px-1 pb-2 text-xs text-muted-foreground">{m.lines.choose}</p>
      <ul className="grid grid-cols-2 gap-2">
        {lines.map((line) => (
          <li key={line.route}>
            <Link
              href={`/linee/${line.route}`}
              aria-label={m.common.line(line.code)}
              className="flex h-full items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm transition-colors hover:bg-muted/60 active:bg-muted">
              <RouteBadge
                code={line.code}
                route={line.route}
                color={line.color}
                textColor={line.textColor}
              />
              <span className="flex min-w-0 flex-col gap-1 text-xs leading-snug text-muted-foreground">
                {line.directions.length > 0
                  ? line.directions.map((direction) => (
                      <span key={direction.dir} className="break-words">
                        {direction.dest}
                      </span>
                    ))
                  : line.description && <span className="line-clamp-2">{line.description}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
