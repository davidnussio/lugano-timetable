import { type Config, Layer, ManagedRuntime } from "effect";
import { Opendata } from "~/journey/opendata-client";
import { RoutineStore } from "~/routines/store";
import { WebPush } from "~/routines/web-push-client";
import { Swisstopo } from "~/terrain/swisstopo-client";
import { OpenMeteo } from "~/weather/open-meteo-client";
import { Timetable } from "./timetable";

declare global {
  // Next.js bundles pages and route handlers separately (and reloads modules
  // in development): keep a single runtime per server process.
  var serverRuntime:
    | ManagedRuntime.ManagedRuntime<
        Timetable | Opendata | Swisstopo | OpenMeteo | RoutineStore | WebPush,
        Config.ConfigError
      >
    | undefined;
}

// Bridges the Effect services with Next.js route handlers and server
// components, so the stop cache and the in-memory sessions are shared between
// requests.
export const runtime = (globalThis.serverRuntime ??= ManagedRuntime.make(
  Layer.mergeAll(
    Timetable.layer,
    Opendata.layer,
    Swisstopo.layer,
    OpenMeteo.layer,
    RoutineStore.layer,
    WebPush.layer
  )
));
