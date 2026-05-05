import { describe, expect, test } from "vitest";
import { expandFrames } from "@/replay/expandFrames";
import type { ReplayFrame } from "@/replay/types";

const FRAMES: ReplayFrame[] = [
  {
    step: 0,
    simTime: "t0",
    agents: {
      "Patient 1": { x: 5, y: 5, description: "waiting" },
      "Doctor 1": { x: 10, y: 10 },
    },
  },
  {
    step: 1,
    simTime: "t1",
    agents: { "Patient 1": { x: 6, y: 5, description: "walking" } },
  },
  {
    step: 2,
    simTime: "t2",
    agents: { "Doctor 1": { x: 11, y: 10 } },
  },
];

describe("expandFrames", () => {
  test("dense per-step state: unchanged personas keep their last value", () => {
    const expanded = expandFrames(FRAMES);
    expect(expanded).toHaveLength(3);

    expect(expanded[0].agents["Patient 1"]).toEqual({ x: 5, y: 5, description: "waiting" });
    expect(expanded[0].agents["Doctor 1"]).toEqual({ x: 10, y: 10 });

    expect(expanded[1].agents["Patient 1"]).toEqual({ x: 6, y: 5, description: "walking" });
    expect(expanded[1].agents["Doctor 1"]).toEqual({ x: 10, y: 10 });

    expect(expanded[2].agents["Patient 1"]).toEqual({ x: 6, y: 5, description: "walking" });
    expect(expanded[2].agents["Doctor 1"]).toEqual({ x: 11, y: 10 });
  });

  test("agent enters mid-replay only appears from its first frame", () => {
    const frames: ReplayFrame[] = [
      { step: 0, simTime: "t0", agents: { "A": { x: 1, y: 1 } } },
      { step: 1, simTime: "t1", agents: { "A": { x: 2, y: 1 }, "B": { x: 5, y: 5 } } },
    ];
    const expanded = expandFrames(frames);
    expect(expanded[0].agents).not.toHaveProperty("B");
    expect(expanded[1].agents).toHaveProperty("B");
    expect(expanded[1].agents["B"]).toEqual({ x: 5, y: 5 });
  });
});
