"use client";

import { Bell, BellOff, ChevronDown, Smartphone } from "lucide-react";
import { useState } from "react";
import { useI18n } from "~/i18n/i18n-provider";
import type { Messages } from "~/i18n/messages";
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
// The names of the menus are the ones of the device in the language of the
// app, as most people use the two in the same language.
function unblockSteps(device: Device, m: Messages["notifications"]): ReadonlyArray<string> {
  const host = window.location.host;
  switch (device) {
    case "android":
      return [
        ...(installed() ? [m.androidInstalled(host)] : []),
        m.androidSiteIcon,
        m.androidSiteSettings(host),
        m.androidChrome,
      ];
    case "ios":
      return [m.ios];
    case "desktop":
      return [m.desktopSiteIcon, m.desktopReload];
  }
}

export function NotificationsCard({
  permission,
  onEnable,
}: {
  permission: NotificationPermission | "unsupported";
  onEnable: () => void;
}) {
  const { m } = useI18n();
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
        <p className="text-sm font-semibold">{m.notifications.title}</p>
        <p className="text-xs text-muted-foreground">
          {permission === "granted"
            ? m.notifications.granted
            : denied
              ? m.notifications.denied
              : permission === "unsupported"
                ? m.notifications.unsupported
                : m.notifications.ask}
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
              {m.notifications.enable}
            </button>
          )}
        </div>
      )}
      {denied && open && (
        <div className="space-y-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <p>{m.notifications.cannotAskAgain}</p>
          <ol className="list-decimal space-y-1 pl-4 text-foreground">
            {unblockSteps(currentDevice(), m.notifications).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p>{m.notifications.chooseAllow}</p>
        </div>
      )}
    </section>
  );
}
