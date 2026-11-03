import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { type Config, Layer, ManagedRuntime } from "effect";
import { Opendata } from "~/journey/opendata-client";
import { Swisstopo } from "~/terrain/swisstopo-client";
import { OpenMeteo } from "~/weather/open-meteo-client";
import { Reliability } from "./reliability-store";
import { Timetable } from "./timetable";

type ServerRuntime = ManagedRuntime.ManagedRuntime<
  Timetable | Opendata | Swisstopo | OpenMeteo | Reliability,
  Config.ConfigError
>;

declare global {
  // Next.js bundles pages and route handlers separately: keep a single
  // runtime per server process, made with the code of `version`
  var serverRuntime: { readonly runtime: ServerRuntime; readonly version: number } | undefined;
}

// In development, the time of the latest edit of the code: a reloaded module
// makes a new runtime, the old one would keep running the code before the
// edit until the server restarts
function codeVersion(): number {
  if (process.env.NODE_ENV === "production") return 0;
  const src = join(process.cwd(), "src");
  return Math.max(
    0,
    ...readdirSync(src, { recursive: true, encoding: "utf8" }).map(
      (file) => statSync(join(src, file)).mtimeMs
    )
  );
}

const version = codeVersion();
if (globalThis.serverRuntime?.version !== version) {
  globalThis.serverRuntime = {
    runtime: ManagedRuntime.make(
      Layer.mergeAll(
        Timetable.layer,
        Opendata.layer,
        Swisstopo.layer,
        OpenMeteo.layer,
        Reliability.layer
      )
    ),
    version,
  };
}

// Bridges the Effect services with Next.js route handlers and server
// components, so the stop cache and the in-memory sessions are shared between
// requests. Always the latest runtime, also from the modules not reloaded.
export const runtime: ServerRuntime = new Proxy({} as ServerRuntime, {
  get: (_, key) => {
    const current = globalThis.serverRuntime!.runtime;
    const value: unknown = Reflect.get(current, key, current);
    return typeof value === "function" ? value.bind(current) : value;
  },
});
