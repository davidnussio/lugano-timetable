"use client";

import { Bell, BellOff, ChevronDown, Smartphone } from "lucide-react";
import { useState } from "react";
import { cn } from "~/lib/utils";

type Device = "android" | "ios" | "desktop";

function currentDevice(): Device {
  const agent = navigator.userAgent;
  if (/Android/i.test(agent)) return "android";
  // iPadOS tells it is a Mac, with a touch screen
  if (/iPhone|iPad/i.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  return "desktop";
}

const installed = () => window.matchMedia("(display-mode: standalone)").matches;

// Once denied, a site cannot ask again: only the user can allow it from the
// settings, which are hard to find. The steps for the device in use.
function unblockSteps(device: Device): ReadonlyArray<string> {
  const host = window.location.host;
  switch (device) {
    case "android":
      return [
        ...(installed()
          ? [`Apri ${host} in Chrome: l'app installata usa le autorizzazioni di Chrome.`]
          : []),
        "Tocca l'icona a sinistra dell'indirizzo, poi Autorizzazioni → Notifiche → Consenti.",
        `Se non compare: menu ⋮ → Impostazioni → Impostazioni sito → Notifiche → ${host} → Consenti.`,
        "Controlla che Chrome possa inviare notifiche: Impostazioni Android → App → Chrome → Notifiche.",
      ];
    case "ios":
      return ["Apri Impostazioni → Notifiche → Lugano Bus e attiva Consenti notifiche."];
    case "desktop":
      return [
        "Clicca sull'icona a sinistra dell'indirizzo, poi Notifiche → Consenti.",
        "Ricarica la pagina.",
      ];
  }
}

export function NotificationsCard({
  permission,
  onEnable,
}: {
  permission: NotificationPermission | "unsupported";
  onEnable: () => void;
}) {
  const [open, setOpen] = useState(false);
  const denied = permission === "denied";

  const summary = (
    <>
      {permission === "granted" ? (
        <Bell className="size-5 shrink-0 text-primary" />
      ) : permission === "unsupported" ? (
        <Smartphone className="size-5 shrink-0 text-muted-foreground" />
      ) : (
        <BellOff className="size-5 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Notifiche</p>
        <p className="text-xs text-muted-foreground">
          {permission === "granted"
            ? "Avvisi sempre più frequenti man mano che si avvicina l'ora"
            : denied
              ? "Bloccate: tocca per vedere come riattivarle"
              : permission === "unsupported"
                ? "Su iPhone aggiungi l'app alla schermata Home per riceverle"
                : "Ricevi un avviso anche con l'app in secondo piano"}
        </p>
      </div>
    </>
  );

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      {denied ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-3 p-4 text-left">
          {summary}
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      ) : (
        <div className="flex items-center gap-3 p-4">
          {summary}
          {permission === "default" && (
            <button
              type="button"
              onClick={onEnable}
              className="h-9 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground">
              Attiva
            </button>
          )}
        </div>
      )}
      {denied && open && (
        <div className="space-y-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <p>
            Il browser non lascia all&apos;app chiedere di nuovo il permesso: va dato dalle
            impostazioni.
          </p>
          <ol className="list-decimal space-y-1 pl-4 text-foreground">
            {unblockSteps(currentDevice()).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p>
            Scegli Consenti: lasciare &quot;Chiedi&quot; non basta se il browser ha bloccato il
            sito per qualche giorno. Poi torna qui, la scheda si aggiorna da sola.
          </p>
        </div>
      )}
    </section>
  );
}
