import { describe, expect, it } from "vitest";
import { CommandBus } from "../commands/command-bus";
import { GetTargets } from "../commands/get-targets.command";

describe("timetable api", () => {
  it("should return request url to fetch targets", () => {
    const command = new GetTargets();
    expect(command.getRequestUrl()).toMatchInlineSnapshot(
      '"http://bs.tplsa.ch/RTPI/rtpi?data=%7Bsource%3A%22%22%2Cdestination%3A0%2Ctype%3AGETTARGETS%7D"'
    );
  });
});
