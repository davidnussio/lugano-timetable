// Copies the MapLibre worker to public/, which the bundler does not serve,
// under the version of the library: the files are cached as immutable, so a
// new version needs a new path (see `headers` in next.config.mjs).
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const manifest = require.resolve("maplibre-gl/package.json");
const { version } = JSON.parse(readFileSync(manifest, "utf8"));
const dist = join(dirname(manifest), "dist");
const target = join("public", "maplibre", version);

rmSync(join("public", "maplibre"), { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  cpSync(join(dist, file), join(target, file));
}
