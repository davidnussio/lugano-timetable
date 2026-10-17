import { describe, expect, it } from "vitest";
import type { Connection, PlannedLeg, Station } from "~/journey/models";
import type { Routine } from "../models";
import {
  addDays,
  choosePlan,
  connectionKey,
  decide,
  type Decision,
  formatDays,
  occurrence,
  type RoutineState,
  shortTime,
  shouldQuery,
  theLine,
  weekday,
  windowStart,
  zurichDate,
  zurichTime,
} from "../schedule";

const MIN = 60_000;
// Friday 16 October 2026, summer time
const DAY = "2026-10-16";
const at = (time: string, date = DAY) => zurichTime(date, time);

const station = (id: string, name: string): Station => ({ id, name });
const albonago = station("8591577", "Albonago");
const centro = station("8591603", "Lugano, Centro");
const lugano = station("8505300", "Lugano");
const bellinzona = station("8505213", "Bellinzona");

const leg = (
  line: string,
  from: Station,
  to: Station,
  departure: string,
  arrival: string,
  delayMinutes = 0
): PlannedLeg => ({
  trip: `trip-${line}-${departure}`,
  category: /^\d/.test(line) ? "B" : "S",
  line,
  destination: to.name,
  from,
  to,
  departure: {
    scheduled: at(departure),
    ...(delayMinutes === 0 ? {} : { estimated: at(departure) + delayMinutes * MIN }),
  },
  arrival: {
    scheduled: at(arrival),
    ...(delayMinutes === 0 ? {} : { estimated: at(arrival) + delayMinutes * MIN }),
  },
});

const direct = (departure: string, arrival: string, delayMinutes = 0): Connection => ({
  legs: [leg("6", albonago, centro, departure, arrival, delayMinutes)],
});

const routine: Routine = {
  id: "abcdef0123456789",
  from: albonago,
  to: centro,
  days: [1, 2, 3, 4, 5],
  arriveBy: "08:00",
  walkMinutes: 6,
  durationMinutes: 15,
  paused: false,
};

const eight = { date: DAY, arriveAt: at("08:00") };

describe("Lugano time", () => {
  it("tells the day in Lugano, not in UTC", () => {
    // 23:30 UTC is already the next day in Lugano
    expect(zurichDate(Date.UTC(2026, 9, 15, 23, 30))).toBe("2026-10-16");
    expect(zurichDate(Date.UTC(2026, 9, 15, 21, 30))).toBe("2026-10-15");
  });

  it("numbers the weekdays from Monday", () => {
    expect(weekday("2026-10-12")).toBe(1);
    expect(weekday("2026-10-16")).toBe(5);
    expect(weekday("2026-10-18")).toBe(7);
  });

  it("adds days across months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("reads local times in summer and in winter", () => {
    expect(zurichTime("2026-10-16", "07:55")).toBe(Date.UTC(2026, 9, 16, 5, 55));
    expect(zurichTime("2026-12-01", "07:55")).toBe(Date.UTC(2026, 11, 1, 6, 55));
  });

  it("follows the change of the clocks", () => {
    // 25 October 2026: 03:00 summer time becomes 02:00
    expect(zurichTime("2026-10-25", "01:30")).toBe(Date.UTC(2026, 9, 24, 23, 30));
    expect(zurichTime("2026-10-25", "02:30")).toBe(Date.UTC(2026, 9, 25, 0, 30));
    expect(zurichTime("2026-10-25", "03:30")).toBe(Date.UTC(2026, 9, 25, 2, 30));
    expect(zurichTime("2026-10-25", "08:00")).toBe(Date.UTC(2026, 9, 25, 7, 0));
    // 29 March 2026: 02:00 becomes 03:00, 02:30 does not exist
    expect(zurichTime("2026-03-29", "01:30")).toBe(Date.UTC(2026, 2, 29, 0, 30));
    expect(zurichTime("2026-03-29", "02:30")).toBe(Date.UTC(2026, 2, 29, 1, 30));
    expect(zurichTime("2026-03-29", "03:30")).toBe(Date.UTC(2026, 2, 29, 1, 30));
    expect(zurichTime("2026-03-29", "08:00")).toBe(Date.UTC(2026, 2, 29, 6, 0));
  });

  it("formats the time as said", () => {
    expect(shortTime(at("07:31"))).toBe("7:31");
    expect(shortTime(at("14:05"))).toBe("14:05");
  });
});

describe("occurrence", () => {
  it("opens the window before the walk, the journey and the first notice", () => {
    // 15 min of journey, 6 of walk, 20 of notice, 60 of margin
    expect(windowStart(routine, at("08:00"))).toBe(at("06:19"));
    expect(occurrence(routine, at("06:18"))).toBeUndefined();
    expect(occurrence(routine, at("06:19"))).toEqual(eight);
    expect(occurrence(routine, at("08:00"))).toEqual(eight);
    expect(occurrence(routine, at("08:01"))).toBeUndefined();
  });

  it("skips the other days and the paused routines", () => {
    expect(occurrence(routine, at("07:30", "2026-10-17"))).toBeUndefined();
    expect(occurrence({ ...routine, days: [6] }, at("07:30", "2026-10-17"))).toEqual({
      date: "2026-10-17",
      arriveAt: at("08:00", "2026-10-17"),
    });
    expect(occurrence({ ...routine, paused: true }, at("07:30"))).toBeUndefined();
  });

  it("uses the day of Lugano on a server in UTC", () => {
    // Monday 00:20 in Lugano is still Sunday in UTC
    const monday = { ...routine, days: [1], arriveBy: "00:40" };
    const now = Date.UTC(2026, 9, 18, 22, 20);
    expect(occurrence(monday, now)?.date).toBe("2026-10-19");
  });

  it("watches tomorrow's trip arriving just after midnight", () => {
    const night = { ...routine, days: [6], arriveBy: "00:10" };
    // Friday 23:50, the trip arrives on Saturday
    expect(occurrence(night, at("23:50"))).toEqual({
      date: "2026-10-17",
      arriveAt: at("00:10", "2026-10-17"),
    });
  });

  it("keeps the local time across the change of the clocks", () => {
    const sunday = { ...routine, days: [7] };
    expect(occurrence(sunday, Date.UTC(2026, 9, 25, 6, 30))?.arriveAt).toBe(
      Date.UTC(2026, 9, 25, 7, 0)
    );
  });
});

describe("choosePlan", () => {
  it("takes the latest connection arriving in time", () => {
    const plan = choosePlan(
      [direct("07:22", "07:37"), direct("07:37", "07:52"), direct("07:52", "08:07")],
      routine,
      at("08:00"),
      at("07:00")
    );
    expect(plan?.leaveAt).toBe(at("07:31"));
    expect(plan?.late).toBe(false);
  });

  it("counts the delays", () => {
    // Late by 10 min the 7:37 arrives at 8:02: the 7:22 is the one
    const plan = choosePlan(
      [direct("07:22", "07:37"), direct("07:37", "07:52", 10)],
      routine,
      at("08:00"),
      at("07:00")
    );
    expect(plan?.leaveAt).toBe(at("07:16"));
  });

  it("leaves out the connections with a lost transfer", () => {
    const transfer: Connection = {
      legs: [
        leg("3", albonago, lugano, "07:40", "07:47", 3),
        { ...leg("S10", lugano, bellinzona, "07:49", "07:58"), walkBeforeMs: MIN },
      ],
    };
    const plan = choosePlan([direct("07:37", "07:52"), transfer], routine, at("08:00"), at("07:00"));
    expect(plan?.connection.legs[0].line).toBe("6");
    // On time the transfer holds, and leaves later
    const onTime = { legs: [leg("3", albonago, lugano, "07:40", "07:47"), transfer.legs[1]] };
    expect(
      choosePlan([direct("07:37", "07:52"), onTime], routine, at("08:00"), at("07:00"))?.connection
    ).toBe(onTime);
  });

  it("drops the buses that can no longer be caught", () => {
    const connections = [direct("07:22", "07:37"), direct("07:37", "07:52")];
    // The 7:37 means leaving home at 7:31, still fine a minute later
    expect(choosePlan(connections, routine, at("08:00"), at("07:32"))?.leaveAt).toBe(at("07:31"));
    expect(choosePlan(connections, routine, at("08:00"), at("07:33"))).toBeUndefined();
  });

  it("falls back on the first to arrive when none is in time", () => {
    const plan = choosePlan(
      [direct("07:52", "08:07"), direct("08:07", "08:22")],
      routine,
      at("08:00"),
      at("07:00")
    );
    expect(plan?.arrivalAt).toBe(at("08:07"));
    expect(plan?.late).toBe(true);
  });

  it("counts the walk after the last stop", () => {
    const walking = { ...direct("07:37", "07:52"), walkAfterMs: 10 * MIN };
    const plan = choosePlan([direct("07:22", "07:37"), walking], routine, at("08:00"), at("07:00"));
    expect(plan?.leaveAt).toBe(at("07:16"));
  });
});

describe("shouldQuery", () => {
  it("asks at once without a state", () => {
    expect(shouldQuery(undefined, at("07:00"))).toBe(true);
  });

  it("ignores a second tick in the same minute", () => {
    expect(shouldQuery({ checkedAt: at("07:10") }, at("07:10") + 20_000)).toBe(false);
    expect(shouldQuery({ checkedAt: at("07:10") }, at("07:11"))).toBe(true);
  });

  it("asks every 5 minutes while far from leaving", () => {
    const state: RoutineState = { checkedAt: at("07:00"), leaveAt: at("07:31") };
    expect(shouldQuery(state, at("07:03"))).toBe(false);
    expect(shouldQuery(state, at("07:05"))).toBe(true);
    // From 25 min before leaving, every minute
    expect(shouldQuery({ ...state, checkedAt: at("07:06") }, at("07:07"))).toBe(true);
  });

  it("stops once told to leave", () => {
    expect(shouldQuery({ checkedAt: at("07:31"), stage: "now" }, at("07:40"))).toBe(false);
  });
});

// Runs `decide` minute after minute with the connections of each time
function run(
  steps: ReadonlyArray<readonly [string, ReadonlyArray<Connection>]>,
  state?: RoutineState
): ReadonlyArray<Decision & { readonly time: string }> {
  const decisions: Array<Decision & { readonly time: string }> = [];
  let current = state;
  for (const [time, connections] of steps) {
    const decision = decide(routine, eight, current, connections, at(time));
    decisions.push({ ...decision, time });
    current = decision.state;
  }
  return decisions;
}

const messages = (decisions: ReturnType<typeof run>) =>
  decisions.flatMap(({ time, message }) => (message ? [{ time, ...message }] : []));

describe("decide", () => {
  it("tells when to leave 20 minutes before, then to leave", () => {
    const connections = [direct("07:22", "07:37"), direct("07:37", "07:52")];
    const sent = messages(
      run([
        ["07:05", connections],
        ["07:10", connections],
        ["07:11", connections],
        ["07:12", connections],
        ["07:30", connections],
        ["07:31", connections],
        ["07:32", connections],
      ])
    );
    expect(sent).toEqual([
      {
        time: "07:11",
        title: "Esci alle 7:31 per il 6 delle 7:37",
        body: "Da Albonago · arrivo alle 7:52",
        tag: "routine-abcdef0123456789",
        url: "/tragitto",
      },
      {
        time: "07:31",
        title: "Esci ora",
        body: "Il 6 delle 7:37 da Albonago · arrivo alle 7:52",
        tag: "routine-abcdef0123456789",
        url: "/tragitto",
      },
    ]);
  });

  it("sends an update only when the leave time moves by 2 minutes", () => {
    const sent = messages(
      run([
        ["07:11", [direct("07:37", "07:52")]],
        ["07:15", [direct("07:37", "07:52", 1)]],
        ["07:16", [direct("07:37", "07:52", 4)]],
        ["07:17", [direct("07:37", "07:52", 5)]],
        ["07:18", [direct("07:37", "07:52")]],
      ])
    );
    expect(sent.map(({ time, title, body }) => ({ time, title, body }))).toEqual([
      { time: "07:11", title: "Esci alle 7:31 per il 6 delle 7:37", body: "Da Albonago · arrivo alle 7:52" },
      {
        time: "07:16",
        title: "Il 6 ha 4 min di ritardo: esci alle 7:35",
        body: "Da Albonago · 4 min di ritardo · arrivo alle 7:56",
      },
      {
        time: "07:18",
        title: "Il 6 è di nuovo in orario: esci alle 7:31",
        body: "Da Albonago · arrivo alle 7:52",
      },
    ]);
  });

  it("changes connection when a transfer is lost", () => {
    const s10 = { ...leg("S10", lugano, bellinzona, "07:49", "07:58"), walkBeforeMs: MIN };
    const viaLugano = (delay: number): Connection => ({
      legs: [leg("3", albonago, lugano, "07:40", "07:47", delay), s10],
    });
    const sent = messages(
      run([
        ["07:14", [direct("07:22", "07:37"), viaLugano(0)]],
        ["07:15", [direct("07:22", "07:37"), viaLugano(3)]],
      ])
    );
    expect(sent.map(({ title, body }) => ({ title, body }))).toEqual([
      { title: "Esci alle 7:34 per il 3 delle 7:40", body: "Da Albonago · 1 cambio · arrivo alle 7:58" },
      {
        title: "Coincidenza persa a Lugano: esci alle 7:16",
        body: "Il 6 delle 7:22 da Albonago · arrivo alle 7:37",
      },
    ]);
  });

  it("explains a bus no longer in time", () => {
    const sent = messages(
      run([
        ["07:00", [direct("07:22", "07:37"), direct("07:37", "07:52")]],
        ["07:12", [direct("07:22", "07:37"), direct("07:37", "07:52")]],
        ["07:13", [direct("07:22", "07:37"), direct("07:37", "07:52", 9)]],
      ])
    );
    // 7:12 is the first notice of the 7:37, 7:13 its delay makes it late
    expect(sent.map(({ title }) => title)).toEqual([
      "Esci alle 7:31 per il 6 delle 7:37",
      "Il 6 non arriva in tempo: esci alle 7:16",
    ]);
  });

  it("tells when even the best connection arrives late", () => {
    const [first] = messages(run([["07:30", [direct("07:52", "08:07")]]]));
    expect(first.body).toBe("Da Albonago · arrivo alle 8:07, dopo le 8:00");
  });

  it("sends nothing again with the state it left", () => {
    const connections = [direct("07:37", "07:52")];
    const first = decide(routine, eight, undefined, connections, at("07:11"));
    expect(first.message).toBeDefined();
    // An overlapping tick reading the saved state
    expect(decide(routine, eight, first.state, connections, at("07:11")).message).toBeUndefined();
    const now = decide(routine, eight, first.state, connections, at("07:31"));
    expect(now.message?.title).toBe("Esci ora");
    expect(decide(routine, eight, now.state, connections, at("07:31"))).toEqual({ state: now.state });
  });

  it("finds the last bus in time of an hourly line from the start of the window", () => {
    // The 7:50 arrives at 8:05: the 6:50 is the one, an hour before
    const hourly = [direct("06:50", "07:05"), direct("07:50", "08:05")];
    const start = windowStart(routine, at("08:00"));
    expect(occurrence(routine, start)).toEqual(eight);
    const sent = messages(run([["06:19", hourly], ["06:24", hourly]]));
    expect(sent.map(({ time, title }) => ({ time, title }))).toEqual([
      { time: "06:24", title: "Esci alle 6:44 per il 6 delle 6:50" },
    ]);
  });

  it("goes straight to Esci ora when the window opens late", () => {
    const sent = messages(run([["07:31", [direct("07:37", "07:52")]]]));
    expect(sent.map(({ title }) => title)).toEqual(["Esci ora"]);
  });

  it("keeps the plan seen before the first notice, without sending", () => {
    const decision = decide(routine, eight, undefined, [direct("07:37", "07:52")], at("07:00"));
    expect(decision.message).toBeUndefined();
    expect(decision.state).toEqual({
      checkedAt: at("07:00"),
      key: connectionKey(direct("07:37", "07:52")),
      leaveAt: at("07:31"),
    });
  });

  it("expires the messages after the leave time", () => {
    const decision = decide(routine, eight, undefined, [direct("07:37", "07:52")], at("07:11"));
    expect(decision.expiresAt).toBe(at("07:36"));
  });

  it("stops updating a forecast going back and forth", () => {
    const steps: Array<readonly [string, ReadonlyArray<Connection>]> = [
      ["07:05", [direct("07:30", "07:45")]],
    ];
    for (let minute = 6; minute <= 15; minute++) {
      const delay = minute % 2 === 0 ? 3 : 0;
      steps.push([`07:${String(minute).padStart(2, "0")}`, [direct("07:30", "07:45", delay)]]);
    }
    const sent = messages(run(steps));
    // The first notice and 5 updates at most
    expect(sent).toHaveLength(6);
  });
});

describe("theLine", () => {
  it("puts the right article", () => {
    expect(theLine("6")).toBe("il 6");
    expect(theLine("461")).toBe("il 461");
    expect(theLine("1")).toBe("l'1");
    expect(theLine("11")).toBe("l'11");
    expect(theLine("8")).toBe("l'8");
    expect(theLine("18")).toBe("il 18");
    expect(theLine("S10")).toBe("l'S10");
    expect(theLine("RE80")).toBe("l'RE80");
    expect(theLine("IC")).toBe("l'IC");
    expect(theLine("TILO")).toBe("il TILO");
  });
});

describe("formatDays", () => {
  it("shortens the days", () => {
    expect(formatDays([1, 2, 3, 4, 5])).toBe("lun-ven");
    expect(formatDays([1, 2, 3, 4, 5, 6, 7])).toBe("tutti i giorni");
    expect(formatDays([7, 6])).toBe("sab, dom");
    expect(formatDays([1, 3, 5])).toBe("lun, mer, ven");
  });
});
