import {describe, expect, test} from "bun:test";
import {parseArgs} from "../cli-args";

describe("theme-tape cli args", () => {
  test("apply preserves current theme when theme flag is omitted", () => {
    const command = parseArgs(["apply", "--mode", "dark"], "cassette-futurism");

    expect(command).toEqual({
      kind: "apply",
      theme: "cassette-futurism",
      mode: "dark",
      components: "all",
    });
  });

  test("apply still accepts explicit theme toggle", () => {
    const command = parseArgs(["apply", "--theme", "toggle", "--mode", "toggle"], "cassette-futurism");

    expect(command).toEqual({
      kind: "apply",
      theme: "toggle",
      mode: "toggle",
      components: "all",
    });
  });
});
