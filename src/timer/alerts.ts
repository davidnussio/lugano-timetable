"use client";

import type { AlertMessage } from "./plan";

// Browsers only play sound after a user gesture: the context is created (or
// resumed) from a click, then reused for the alerts.
let audio: AudioContext | undefined;

export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    // No Web Audio: alerts stay silent
  }
}

function beep() {
  if (audio?.state !== "running") return;
  for (const delay of [0, 0.25]) {
    const start = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.22);
  }
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return typeof window !== "undefined" && "Notification" in window
    ? Notification.permission
    : "unsupported";
}

export async function requestNotifications(): Promise<void> {
  if (notificationPermission() !== "default") return;
  try {
    await Notification.requestPermission();
  } catch {
    // Old Safari only supports the callback form, ignore
  }
}

// Shows an alert with every channel available: system notification (through
// the service worker, required on mobile), vibration and a beep.
export async function notify({ title, body }: AlertMessage): Promise<void> {
  beep();
  navigator.vibrate?.([250, 120, 250]);
  if (notificationPermission() !== "granted") return;

  // `renotify` and `vibrate` are missing from the DOM typings
  const options = {
    body,
    tag: "bus-timer",
    renotify: true,
    vibrate: [250, 120, 250],
    icon: "/icon",
    badge: "/icon",
    data: { url: "/timer" },
  } as NotificationOptions;
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch {
    // The in-app banner is still shown
  }
}
