import { describe, expect, test } from "vitest";
import { roleToColor } from "@/replay/roleColors";
import type { PersonaRole } from "@/replay/types";

describe("roleToColor", () => {
  test.each<[PersonaRole, string]>([
    ["Patient", "#E03B3B"],
    ["Doctor", "#2D6CDF"],
    ["TriageNurse", "#F2A92F"],
    ["BedsideNurse", "#2EA86E"],
    ["Unknown", "#888888"],
  ])("maps %s to %s", (role, hex) => {
    expect(roleToColor(role)).toBe(hex);
  });
});
