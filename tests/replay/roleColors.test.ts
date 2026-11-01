import { describe, expect, test, it } from "vitest";
import { roleToColor } from "@/replay/roleColors";
import type { PersonaRole } from "@/replay/types";

describe("roleToColor", () => {
  test.each<[PersonaRole, string]>([
    ["Patient", "#E03B3B"],
    ["Doctor", "#2D6CDF"],
    ["TriageNurse", "#F2A92F"],
    ["BedsideNurse", "#2EA86E"],
    ["AdmissionClerk", "#8E5BD9"],
    ["Unknown", "#888888"],
  ])("maps %s to %s", (role, hex) => {
    expect(roleToColor(role)).toBe(hex);
  });

  it("colours the admission clerk distinctly", () => {
    expect(roleToColor("AdmissionClerk")).toBe("#8E5BD9");
    expect(new Set(["Patient","Doctor","TriageNurse","BedsideNurse","AdmissionClerk","Unknown"]
      .map(r => roleToColor(r as PersonaRole))).size).toBe(6);
  });
});
