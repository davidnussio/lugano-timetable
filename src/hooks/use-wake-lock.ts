"use client";

import { useEffect } from "react";

// Keeps the screen on while mounted: alerts can only fire while the page runs.
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | undefined;
    let released = false;

    const request = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (released) void sentinel.release();
      } catch {
        // Denied (e.g. low battery): nothing to do
      }
    };
    // The lock is dropped when the page is hidden: take it again on return
    const onVisibility = () => void request();

    void request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release();
    };
  }, [enabled]);
}
