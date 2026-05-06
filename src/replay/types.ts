export type PersonaRole =
  | "Patient"
  | "Doctor"
  | "TriageNurse"
  | "BedsideNurse"
  | "Unknown";

export interface ReplayAgentDelta {
  x?: number;
  y?: number;
  pronunciatio?: string | null;
  description?: string | null;
  chat?: unknown | null;
}

export interface ReplayFrame {
  step: number;
  simTime: string;
  agents: Record<string, ReplayAgentDelta>;
}

export interface ReplayPersonaFinalState {
  state?: string;
  ctas?: number | null;
  icd?: string | null;
  bedAssignment?: string | null;
  injuriesZone?: string | null;
}

export interface ReplayPersona {
  id: string;
  role: PersonaRole;
  finalState?: ReplayPersonaFinalState;
  path: { x: number; y: number }[]; // null = uninitialized, [] = no pathfinding possible
}

export interface ReplayMetadata {
  simulationId: string;
  simStartIso: string;
  secPerStep: number;
  totalSteps: number;
  mazeName: string;
  widthInTiles: number;
  heightInTiles: number;
  builderVersion: string;
}

export interface ReplayFile {
  schemaVersion: 1;
  mapId: string;
  metadata: ReplayMetadata;
  personas: ReplayPersona[];
  frames: ReplayFrame[];
}
