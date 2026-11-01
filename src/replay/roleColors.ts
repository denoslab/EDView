import type { PersonaRole } from "./types";

const COLORS: Record<PersonaRole, string> = {
  Patient: "#E03B3B",
  Doctor: "#2D6CDF",
  TriageNurse: "#F2A92F",
  BedsideNurse: "#2EA86E",
  AdmissionClerk: "#8E5BD9",
  Unknown: "#888888",
};

export function roleToColor(role: PersonaRole): string {
  return COLORS[role];
}
