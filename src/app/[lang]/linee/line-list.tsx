"use client";

import Link from "next/link";
import { LineBadge } from "~/app/components/line-badge";
import { useLines } from "~/hooks/use-lines";
import { useI18n } from "~/i18n/i18n-provider";

// The lines of TPL as their badges, each with its two ends
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
      <p className="px-6 py-10 text-center text-sm text-muted-foreground">{m.lines.learning}</p>
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
              className="flex h-full items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition-colors hover:bg-muted/60 active:bg-muted">
              <LineBadge img={line.img} route={line.route} line={line.code} size={40} />
              <span className="flex min-w-0 flex-col text-xs leading-snug text-muted-foreground">
                {line.directions.map((direction) => (
                  <span key={direction.dir} className="truncate">
                    {direction.dest}
                  </span>
                ))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
