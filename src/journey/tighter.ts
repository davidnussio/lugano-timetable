// The router of transport.opendata.ch keeps the official minimum transfer
// times, generous at the large stations: a bus reaching Lugano a few
// minutes before the IC2 is given the S10 leaving three minutes later. A
// search from the stop of the transfer, starting when the previous leg gets
// there, finds the trains it leaves out; the app judges the transfer with
// its own walking times, as the timer does.
import { expected, transfer } from "~/timer/journey";
import type { Connection, PlannedLeg } from "./models";

// A search again from a transfer stop
export interface TransferProbe {
  readonly from: string;
  // Epoch milliseconds: the scheduled arrival of the previous leg
  readonly at: number;
}

// Below this wait at a transfer, nothing earlier is worth looking for
const WAIT_WORTH_PROBING_MS = 3 * 60_000;

export const probeKey = ({ from, at }: TransferProbe) =>
  `${from}@${Math.floor(at / 60_000)}`;

// Waiting at the transfer to `next` beyond the walk planned to its platform
function waitMs(arriving: PlannedLeg, next: PlannedLeg): number {
  return (
    next.departure.scheduled -
    arriving.arrival.scheduled -
    (next.walkBeforeMs ?? 0)
  );
}

// The transfers of `connections` with a long wait, one probe per stop and
// minute
export function transferProbes(
  connections: ReadonlyArray<Connection>
): ReadonlyArray<TransferProbe> {
  const probes = new Map<string, TransferProbe>();
  for (const { legs } of connections) {
    for (let i = 0; i + 1 < legs.length; i++) {
      if (waitMs(legs[i], legs[i + 1]) < WAIT_WORTH_PROBING_MS) continue;
      const probe = { from: legs[i + 1].from.id, at: legs[i].arrival.scheduled };
      probes.set(probeKey(probe), probe);
    }
  }
  return [...probes.values()];
}

export const arrivalOf = ({ legs, walkAfterMs }: Connection) =>
  expected(legs[legs.length - 1].arrival) + (walkAfterMs ?? 0);

const departureOf = ({ legs }: Connection) => expected(legs[0].departure);

const keyOf = ({ legs }: Connection) =>
  legs.map((leg) => `${leg.trip}:${leg.from.id}`).join(">");

// `connection` with the legs after its transfer `index` replaced by the
// earliest arriving of `found`, the connections from that transfer stop.
// Undefined when none of them can be caught and arrives earlier.
export function splice(
  connection: Connection,
  index: number,
  found: ReadonlyArray<Connection>
): Connection | undefined {
  const head = connection.legs.slice(0, index + 1);
  const arriving = head[head.length - 1];
  const next = connection.legs[index + 1];
  let best: Connection | undefined;
  for (const candidate of found) {
    const [first, ...rest] = candidate.legs;
    // Starting with a walk elsewhere, or staying on the same bus
    if (first.from.id !== next.from.id || first.trip === arriving.trip) continue;
    const boarding: PlannedLeg = {
      ...first,
      ...(next.walkBeforeMs === undefined ? {} : { walkBeforeMs: next.walkBeforeMs }),
    };
    if (transfer(arriving, boarding).status === "missed") continue;
    const spliced: Connection = {
      legs: [...head, boarding, ...rest],
      ...(candidate.walkAfterMs === undefined
        ? {}
        : { walkAfterMs: candidate.walkAfterMs }),
    };
    if (arrivalOf(spliced) >= arrivalOf(connection)) continue;
    if (
      best === undefined ||
      arrivalOf(spliced) < arrivalOf(best) ||
      (arrivalOf(spliced) === arrivalOf(best) &&
        spliced.legs.length < best.legs.length)
    ) {
      best = spliced;
    }
  }
  return best;
}

// `connections` together with the faster ones through tighter transfers,
// from the connections found by each probe of `transferProbes`. The ones of
// the router stay: the next train if the tight transfer is missed.
export function withTighterTransfers(
  connections: ReadonlyArray<Connection>,
  found: ReadonlyMap<string, ReadonlyArray<Connection>>
): ReadonlyArray<Connection> {
  const all = new Map(connections.map((c) => [keyOf(c), c]));
  for (const connection of connections) {
    const { legs } = connection;
    for (let i = 0; i + 1 < legs.length; i++) {
      const probed = found.get(
        probeKey({ from: legs[i + 1].from.id, at: legs[i].arrival.scheduled })
      );
      if (probed === undefined) continue;
      const spliced = splice(connection, i, probed);
      if (spliced !== undefined && !all.has(keyOf(spliced))) {
        all.set(keyOf(spliced), spliced);
      }
    }
  }
  if (all.size === connections.length) return connections;
  return [...all.values()].sort(
    (a, b) => departureOf(a) - departureOf(b) || arrivalOf(a) - arrivalOf(b)
  );
}
