import { describe, expect, it } from "vitest";
import type { Station } from "../models";
import { rememberJourney } from "../search-store";

const station = (id: string): Station => ({ id, name: `Stop ${id}` });

describe("rememberJourney", () => {
  it("puts the journey first without duplicates", () => {
    const a = { from: station("1"), to: station("2") };
    const b = { from: station("3"), to: station("4") };
    const search = { recent: [a, b] };
    expect(rememberJourney(search, b.from, b.to).recent).toEqual([b, a]);
    expect(rememberJourney(search, a.to, a.from).recent).toHaveLength(3);
  });

  it("keeps the five latest", () => {
    let search: Parameters<typeof rememberJourney>[0] = { recent: [] };
    for (let i = 0; i < 7; i++) search = rememberJourney(search, station(`${i}`), station("x"));
    expect(search.recent.map((journey) => journey.from.id)).toEqual(["6", "5", "4", "3", "2"]);
  });
});
