import { describe, expect, it } from "vitest";
import { formatDistance, formatSpeed, formatWeather } from "~/lib/format";
import { type GetOff, getOffMessage, type Ride, rideSummary } from "~/timer/get-off";
import { alertMessage, countdown } from "~/timer/plan";
import { reliabilityNote } from "~/timer/reliability";
import { messages } from "../messages";

const { it: italian, de, en } = messages;

describe("numbers", () => {
  it("writes the decimals of each language", () => {
    expect(formatSpeed(italian, 1.3)).toBe("4,7 km/h");
    expect(formatSpeed(de, 1.3)).toBe("4.7 km/h");
    expect(formatSpeed(en, 1.3)).toBe("4.7 km/h");
    expect(formatDistance(de, 1250)).toBe("1.3 km");
    expect(formatDistance(de, 340)).toBe("340 m");
  });

  it("says now in each language", () => {
    expect([italian, de, en].map((m) => m.format.now)).toEqual(["ora", "jetzt", "now"]);
  });
});

describe("alerts", () => {
  it("builds the whole sentence of each language", () => {
    expect(alertMessage(de, "2", "Castagnola", countdown(600_000, 0, 300), "heavyRain")).toEqual({
      title: "Losgehen in 5 min",
      body: "Linie 2 nach Castagnola · der Bus fährt in 10 min ab, 5 min zu Fuss (starker Regen)",
    });
    expect(alertMessage(en, "2", "Castagnola", countdown(240_000, 0, undefined))).toEqual({
      title: "The bus leaves in 4 min",
      body: "Line 2 to Castagnola",
    });
    expect(getOffMessage(en, "next", { name: "Cornaredo" }, "5", "Cornaredo").body).toBe(
      "Get ready to get off · Line 5 to Cornaredo"
    );
  });

  it("names the weather at the start of a sentence and within one", () => {
    expect(formatWeather(de, { kind: "heavyRain", minutes: 2 })).toBe("Starker Regen +2 min");
    expect(formatWeather(en, { kind: "rain", minutes: 1 })).toBe("Rain +1 min");
  });
});

describe("ride", () => {
  const getOff: GetOff = { target: "1", name: "Cornaredo", alerted: [] };
  const before: Ride = { status: "before", stopsLeft: 3, left: true, time: "10:40" };

  it("keeps the nouns of German capitalized within a sentence", () => {
    expect(rideSummary(de.ride, getOff, before)).toBe("Noch 3 Haltestellen");
    expect(rideSummary(de.rideInline, getOff, { ...before, status: "at" })).toBe(
      "der Bus ist an der Haltestelle"
    );
    expect(rideSummary(italian.rideInline, getOff, { ...before, status: "next" })).toBe(
      "prossima fermata"
    );
  });
});

describe("plurals", () => {
  it("tells one from many", () => {
    expect(italian.timer.walks(1)).toBe("1 percorso");
    expect(de.timer.walks(2)).toBe("2 Wege");
    expect(en.routing.stopsAway(1)).toBe("1 stop away");
    expect(de.journey.transfers(0)).toBe("direkt");
    expect(en.routing.showPassed(4)).toBe("Show the 4 previous stops");
  });
});

describe("usual journeys", () => {
  it("names the seven days, Monday first, in each language", () => {
    for (const m of [italian, de, en]) {
      const { dayLetters, dayNames, weekdays } = m.routines;
      expect([dayLetters.length, dayNames.length, weekdays.length]).toEqual([7, 7, 7]);
    }
    expect([italian, de, en].map((m) => m.routines.weekdays[0])).toEqual(["lun", "Mo", "Mon"]);
  });

  it("tells the journey saved in each language", () => {
    expect(de.routines.summary("Mo-Fr", "07:55", 6)).toBe("Mo-Fr · Ankunft bis 07:55 · 6 min zu Fuss");
    expect(en.routines.summary("Mon-Fri", "07:55", 6)).toBe("Mon-Fri · arrive by 07:55 · 6 min walk");
  });
});

describe("reliability", () => {
  it("sums up the past days in each language", () => {
    const stats = { samples: 14, median: 95, p80: 170, lateShare: 0.2 };
    expect(reliabilityNote(de, stats)?.summary).toBe(
      "Fährt meist mit +2 min ab · 80% innert +3 min (14 Tage)"
    );
    expect(reliabilityNote(en, stats)?.summary).toBe(
      "Usually leaves +2 min late · 80% within +3 min (14 days)"
    );
  });
});
