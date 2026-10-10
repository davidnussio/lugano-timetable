import { type Config, ManagedRuntime } from "effect";
import { Timetable } from "./timetable";

declare global {
  // Next.js bundles pages and route handlers separately (and reloads modules
  // in development): keep a single runtime per server process.
  var timetableRuntime:
    | ManagedRuntime.ManagedRuntime<Timetable, Config.ConfigError>
    | undefined;
}

// Bridges the Effect services with Next.js route handlers and server
// components, so the stop cache and the in-memory sessions are shared between
// requests.
export const runtime = (globalThis.timetableRuntime ??= ManagedRuntime.make(
  Timetable.layer
));
