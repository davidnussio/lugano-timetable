"use client";

import { cn } from "~/lib/utils";
import { LOCALE_COOKIE, locales, type Locale } from "./config";
import { languageNames } from "./messages";

const ONE_YEAR = 60 * 60 * 24 * 365;

// The choice is kept in a cookie, read by the proxy on every request. A full
// reload: the pages already in memory are in the old language.
function choose(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  window.location.reload();
}

export function LanguageSwitcher({ current, label }: { current: Locale; label: string }) {
  return (
    <nav aria-label={label} className="flex justify-center gap-1 pt-2">
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-label={languageNames[locale]}
          aria-current={locale === current ? "true" : undefined}
          disabled={locale === current}
          onClick={() => choose(locale)}
          className={cn(
            "rounded-full px-2.5 py-1 font-medium uppercase tracking-wide transition-colors",
            locale === current
              ? "bg-muted text-foreground"
              : "hover:text-foreground"
          )}>
          {locale}
        </button>
      ))}
    </nav>
  );
}
