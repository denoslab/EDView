import { describe, expect, test } from "vitest";
import { validateInitial } from "@/liveMap/loadInitialState";


const VALID = {
  "mapLayout": {
    "compressionlevel": -1,
    "height": 20,
    "infinite": false,
    "layers": []
      },
  "metadata": {
    "heightInTiles": 20,
    "time": "September 30, 2025, 06:00:00",
    "widthInTiles": 30
  },

  "step": 120
}


describe("Live Map Initial State", () => {
  test("accepts a well-formed replay", () => {
    expect(() => validateInitial(VALID)).not.toThrow();
  });

  test("rejects string step ", () => {
    expect(() => validateInitial({ ...VALID, step: 2.1 })).toThrow("Step must be a integer");
  });

  test("rejects missing MapLayout", () => {
    expect(() => validateInitial({ ...VALID, mapLayout: "mapLayout"})).toThrow("mapLayout must be an object");
  });

  test("rejects non object metadata", () => {
    expect(() => validateInitial({ ...VALID, metadata: "metadata" })).toThrow(/metadata/);
  });

  test("rejects metadata with missing data", () => {
    expect(() => validateInitial({ ...VALID, metadata: {}})).toThrow(/metadata/);
  });

});
