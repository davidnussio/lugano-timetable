"use client";

import { useSyncExternalStore } from "react";
import { defaultLocale, type Locale } from "~/i18n/config";
import { cookieLocale, pickLocale } from "~/i18n/negotiate";
import "./globals.css";

// Outside of the layout, so of the messages: the few words it needs
const texts: Record<Locale, { title: string; body: string; restart: string }> = {
  it: {
    title: "Qualcosa è andato storto",
    body: "L'app ha avuto un problema. Il timer attivo verrà annullato.",
    restart: "Ricomincia",
  },
  de: {
    title: "Etwas ist schiefgelaufen",
    body: "Die App hatte ein Problem. Der aktive Timer wird abgebrochen.",
    restart: "Neu starten",
  },
  en: {
    title: "Something went wrong",
    body: "The app ran into a problem. The running timer will be cancelled.",
    restart: "Start again",
  },
};

const noop = () => () => {};
const browserLocale = () =>
  pickLocale(cookieLocale(document.cookie), navigator.languages.join(","));

// Last resort when even the root layout fails: the timer runs on every page,
// so a broken timer would break them all. Drop it and start again.
export default function GlobalError() {
  const locale = useSyncExternalStore(noop, browserLocale, () => defaultLocale);
  const t = texts[locale];
  const restart = () => {
    try {
      localStorage.removeItem("lugano-timetable-timer");
    } catch {
      // Storage blocked: nothing saved to drop
    }
    // A full reload: the state in memory may be broken too
    window.location.reload();
  };

  return (
    <html lang={locale}>
      <body className="grid min-h-dvh place-items-center bg-background px-6 font-sans text-foreground antialiased">
        <main className="max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.body}</p>
          <button
            type="button"
            onClick={restart}
            className="h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
            {t.restart}
          </button>
        </main>
      </body>
    </html>
  );
}
