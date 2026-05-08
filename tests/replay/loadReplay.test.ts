import { describe, expect, test } from "vitest";
import { validateReplay } from "@/replay/loadReplay";

const VALID = {
  schemaVersion: 1,
  mapId: "small_ed_layout",
  metadata: {
    simulationId: "x",
    simStartIso: "2025-09-30",
    secPerStep: 30,
    totalSteps: 1,
    mazeName: "small_ed_layout",
    widthInTiles: 30,
    heightInTiles: 20,
    builderVersion: "0.1.0",
  },
  personas: [{ id: "Patient 1", role: "Patient" }],
  frames: [{ step: 0, simTime: "t", agents: {} }],
};

describe("validateReplay", () => {
  test("accepts a well-formed replay", () => {
    expect(() => validateReplay(VALID)).not.toThrow();
  });

  test("rejects wrong schemaVersion", () => {
    expect(() => validateReplay({ ...VALID, schemaVersion: 2 })).toThrow(/schemaVersion/);
  });

  // test("rejects missing mapId", () => {
  //   const { mapId, ...rest } = VALID;
  //   expect(() => validateReplay(rest)).toThrow(mapId);
  // });

  test("rejects non-array frames", () => {
    expect(() => validateReplay({ ...VALID, frames: "nope" })).toThrow(/frames/);
  });

  test("rejects bad role", () => {
    expect(() =>
      validateReplay({ ...VALID, personas: [{ id: "X", role: "Janitor" }] })
    ).toThrow(/role/);
  });
});
