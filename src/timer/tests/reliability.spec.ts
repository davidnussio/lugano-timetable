import { describe, expect, it } from "vitest";
import { reliabilityNote } from "../reliability";

describe("reliabilityNote", () => {
  it("tells the usual delay and the one of four days out of five", () => {
    expect(reliabilityNote({ samples: 14, median: 95, p80: 170, lateShare: 0.2 })).toEqual({
      summary: "Di solito parte con +2 min · 80% entro +3 min (14 giorni)",
    });
  });

  it("says when the bus is on time or early", () => {
    expect(reliabilityNote({ samples: 6, median: 20, p80: 0, lateShare: 0 })?.summary).toBe(
      "Di solito parte in orario · 80% in orario (6 giorni)"
    );
    expect(reliabilityNote({ samples: 6, median: -70, p80: 30, lateShare: 0 })?.summary).toBe(
      "Di solito parte 1 min prima · 80% entro +1 min (6 giorni)"
    );
  });

  it("needs a few days", () => {
    expect(reliabilityNote(undefined)).toBeUndefined();
    expect(reliabilityNote({ samples: 0 })).toBeUndefined();
    expect(reliabilityNote({ samples: 4, median: 60, p80: 120, lateShare: 0 })).toBeUndefined();
  });

  it("suggests a margin when the delay changes a lot", () => {
    expect(reliabilityNote({ samples: 10, median: 30, p80: 300, lateShare: 0.3 })?.margin).toBe(5);
    // Early buses do not count as a margin already there
    expect(reliabilityNote({ samples: 10, median: -60, p80: 200, lateShare: 0.3 })?.margin).toBe(3);
  });

  it("suggests no margin for small or steady delays", () => {
    expect(reliabilityNote({ samples: 10, median: 30, p80: 150, lateShare: 0.1 })?.margin).toBeUndefined();
    // Always 4 minutes late: the real-time estimate already shows it
    expect(reliabilityNote({ samples: 10, median: 240, p80: 250, lateShare: 1 })?.margin).toBeUndefined();
  });
});
