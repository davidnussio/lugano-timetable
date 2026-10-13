import type { Monitored } from "~/timetable/models";

// Every phone on the same stop polls every few seconds: the CDN answers them
// for a few seconds once the monitor is ready (departure times are absolute,
// so a slightly old answer is still right). A session still warming up
// (`ready: false`) is never cached, so that the next poll gets the data.
export const monitoredCacheControl = ({ ready }: Monitored<unknown>) =>
  ready ? "public, s-maxage=5, stale-while-revalidate=5" : "no-store";
