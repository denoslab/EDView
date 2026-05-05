import type { PersonaRole } from "./types";

const COLORS: Record<PersonaRole, string> = {
  Patient: "#E03B3B",
  Doctor: "#2D6CDF",
  TriageNurse: "#F2A92F",
  BedsideNurse: "#2EA86E",
  Unknown: "#888888",
};

export function roleToColor(role: PersonaRole): string {
  return COLORS[role];
}
