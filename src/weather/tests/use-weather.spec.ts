import { describe, expect, it } from "vitest";
import { weatherKey } from "../use-weather";

describe("weatherKey", () => {
  it("rounds the position to a grid of about 5 km", () => {
    expect(weatherKey({ lat: 46.0049, lon: 8.9515 })).toBe("/api/weather?lat=46.00&lon=8.95");
    // Nearby users share the same request
    expect(weatherKey({ lat: 46.0212, lon: 8.9701 })).toBe("/api/weather?lat=46.00&lon=8.95");
    expect(weatherKey({ lat: 46.0261, lon: 8.9249 })).toBe("/api/weather?lat=46.05&lon=8.90");
  });
});
