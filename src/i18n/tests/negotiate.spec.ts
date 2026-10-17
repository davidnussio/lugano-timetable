import { describe, expect, it } from "vitest";
import { stripLocale } from "../config";
import { cookieLocale, pickLocale } from "../negotiate";

describe("pickLocale", () => {
  it("keeps the language chosen in the footer", () => {
    expect(pickLocale("en", "de-CH,de;q=0.9")).toBe("en");
  });

  it("ignores a cookie with an unknown language", () => {
    expect(pickLocale("fr", "de-CH")).toBe("de");
  });

  it("takes the first supported language of the browser", () => {
    expect(pickLocale(undefined, "de-CH,de;q=0.9,en;q=0.8")).toBe("de");
    expect(pickLocale(undefined, "fr-CH,fr;q=0.9,en;q=0.8")).toBe("en");
    expect(pickLocale(undefined, "en-US")).toBe("en");
  });

  it("follows the weights, not the order", () => {
    expect(pickLocale(undefined, "en;q=0.5,de;q=0.8")).toBe("de");
    expect(pickLocale(undefined, "de;q=0,en")).toBe("en");
  });

  it("falls back to Italian", () => {
    expect(pickLocale(undefined, "fr-CH,fr;q=0.9")).toBe("it");
    expect(pickLocale(undefined, null)).toBe("it");
    expect(pickLocale(undefined, "")).toBe("it");
    expect(pickLocale(undefined, "*")).toBe("it");
  });
});

describe("cookieLocale", () => {
  it("reads the language among the cookies", () => {
    expect(cookieLocale("a=1; lang=de; b=2")).toBe("de");
    expect(cookieLocale("a=1")).toBeUndefined();
  });
});

describe("stripLocale", () => {
  it("drops the language of the /[lang] segment", () => {
    expect(stripLocale("/de/timer")).toBe("/timer");
    expect(stripLocale("/it")).toBe("/");
    expect(stripLocale("/timer")).toBe("/timer");
    expect(stripLocale("/")).toBe("/");
  });
});
