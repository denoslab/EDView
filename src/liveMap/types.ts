export interface ReplayAgentDelta {
  x?: number;
  y?: number;
  pronunciatio?: string | null;
  description?: string | null;
  chat?: unknown | null;
}

export type PersonaRole =
  | "Patient"
  | "Doctor"
  | "TriageNurse"
  | "BedsideNurse"
  | "Unknown";

export interface liveMapMetaData {
    heightInTiles: number;
    widthInTiles: number;
    time: string;
}
  
export interface initialState {
    metadata: liveMapMetaData;
    state: Object;
    mapLayout: Object;
}
  
export interface MovementFile {
    persona: Record<string, PersonaDetailsMovementFile>;
    meta: MetaMovementFile;
}

export interface PersonaDetailsMovementFile {
    movement: Array<number>;
    pronunciatio?: string;
    description?: string;
    chat?: string;
}

export interface PersonaMovementFile {
    id: string;
    PersonaDetailsMovementFile: PersonaDetailsMovementFile;
}

export interface MetaMovementFile {
    curr_time: string;

}