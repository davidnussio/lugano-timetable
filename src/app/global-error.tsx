"use client";

import "./globals.css";

// Last resort when even the root layout fails: the timer runs on every page,
// so a broken timer would break them all. Drop it and start again.
export default function GlobalError() {
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
    <html lang="it">
      <body className="grid min-h-dvh place-items-center bg-background px-6 font-sans text-foreground antialiased">
        <main className="max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">Qualcosa è andato storto</h1>
          <p className="text-sm text-muted-foreground">
            L&apos;app ha avuto un problema. Il timer attivo verrà annullato.
          </p>
          <button
            type="button"
            onClick={restart}
            className="h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
            Ricomincia
          </button>
        </main>
      </body>
    </html>
  );
}
