// Fits the detour of the streets over the straight line as a + b × slope
// (slope = |climb| / straight meters) on the routes collected with
// compare.mjs, and tells how many minutes each formula is off the walk on the
// shortest route and on the best one of Valhalla and OSRM.
//
//   node scripts/walk-detour/fit.mjs [routes.json ...]
//   FORMULAS="1.15,4.5,3;1.2,4,2.6" node scripts/walk-detour/fit.mjs
//
// A formula is "a,b,cap". Without FORMULAS, the fixed 1.35 of before and the
// formula of `detourFactor` in src/timer/plan.ts.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const files = process.argv.slice(2);
if (files.length === 0) files.push(join(dirname(fileURLToPath(import.meta.url)), "routes.json"));

const ROUTERS = ["valhalla", "osrm", "brouter"];
const seen = new Set();
const routes = files
  .flatMap((file) => JSON.parse(readFileSync(file, "utf8")))
  .filter((route) => route.climb !== null && ROUTERS.every((name) => route[name] && !route[name].error))
  .filter((route) => {
    const key = [route.from.name, route.to.name].sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

const points = routes.map((route) => ({
  route,
  slope: Math.abs(route.climb) / route.straight,
  shortest: route.brouter.meters / route.straight,
  best: Math.min(route.valhalla.meters, route.osrm.meters) / route.straight,
}));
console.log(`routes: ${points.length}`);

function quantile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const i = (sorted.length - 1) * p;
  return sorted[Math.floor(i)] + (sorted[Math.ceil(i)] - sorted[Math.floor(i)]) * (i % 1);
}
const spread = (values) =>
  [0.05, 0.25, 0.5, 0.75, 0.95]
    .map((p) => `p${String(p * 100).padStart(2, "0")} ${quantile(values, p).toFixed(2).padStart(6)}`)
    .join(" ");

// Least squares
function linear(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b) / n;
  const my = ys.reduce((a, b) => a + b) / n;
  let sxy = 0;
  let sxx = 0;
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my);
    sxx += (x - mx) ** 2;
  });
  const b = sxy / sxx;
  const a = my - b * mx;
  const residual = ys.reduce((s, y, i) => s + (y - a - b * xs[i]) ** 2, 0);
  const total = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  return { a, b, r2: 1 - residual / total };
}

// Least absolute deviations, by iteratively reweighted least squares: the
// median line, not pulled by the long detours of the routers
function median(xs, ys) {
  let { a, b } = linear(xs, ys);
  for (let k = 0; k < 50; k++) {
    const w = xs.map((x, i) => 1 / Math.max(1e-3, Math.abs(ys[i] - a - b * x)));
    const sw = w.reduce((s, v) => s + v, 0);
    const mx = xs.reduce((s, x, i) => s + w[i] * x, 0) / sw;
    const my = ys.reduce((s, y, i) => s + w[i] * y, 0) / sw;
    let sxy = 0;
    let sxx = 0;
    xs.forEach((x, i) => {
      sxy += w[i] * (x - mx) * (ys[i] - my);
      sxx += w[i] * (x - mx) ** 2;
    });
    b = sxy / sxx;
    a = my - b * mx;
  }
  return { a, b };
}

const slopes = points.map((point) => point.slope);
for (const target of ["shortest", "best"]) {
  const detours = points.map((point) => point[target]);
  const ols = linear(slopes, detours);
  const lad = median(slopes, detours);
  console.log(
    `${target.padEnd(8)} least squares ${ols.a.toFixed(3)} + ${ols.b.toFixed(2)} × slope (r² ${ols.r2.toFixed(2)})` +
      ` | median ${lad.a.toFixed(3)} + ${lad.b.toFixed(2)} × slope`
  );
}

// Minutes of the walk on `detour` × the straight line, as `walkingSeconds` at
// the normal pace: Tobler uphill, capped at a 25% slope
function minutes(route, detour) {
  const path = route.straight * detour;
  const grade = Math.min(0.25, Math.max(0, route.climb) / path);
  return ((path / 1.3) * Math.exp(3.5 * grade)) / 60;
}

const formulas = (process.env.FORMULAS ?? "1.35,0,0;1.15,4.5,3").split(";").map((formula) => {
  const [a, b, cap] = formula.split(",").map(Number);
  const name = b === 0 ? `fixed ${a}` : `${a} + ${b} × slope${cap ? ` ≤ ${cap}` : ""}`;
  // Over 200 m at least, as `detourFactor`
  const detour = (point) =>
    Math.min(cap || Infinity, a + (b * Math.abs(point.route.climb)) / Math.max(point.route.straight, 200));
  return { name, detour };
});

console.log("\nMinutes off the walk (+ longer, - shorter: late at the stop)");
for (const { name, detour } of formulas) {
  const shortest = points.map((point) => minutes(point.route, detour(point)) - minutes(point.route, point.shortest));
  const best = points.map((point) => minutes(point.route, detour(point)) - minutes(point.route, point.best));
  const late = shortest.filter((error) => error < -3).length;
  console.log(`${name}`);
  console.log(`  vs shortest ${spread(shortest)}`);
  console.log(`  vs best     ${spread(best)}`);
  console.log(`  more than 3 minutes shorter than the shortest route: ${late} of ${points.length}`);
}
