

export interface ReplayAgentDelta {
  x?: number;
  y?: number;
  pronunciatio?: string | null;
  description?: string | null;
  chat?: unknown | null;
}

export interface liveMapMetaData {
    heightInTiles: number;
    widthInTiles: number;
    time: string;
}
  
export interface initialState {
    metadata: liveMapMetaData;
    mapLayout: Object;
    step: number
}
  
export interface MovementFile {
    agents: Record<string, ReplayAgentDelta>;
    meta: MetaMovementFile;
    step: number
}

export interface MetaMovementFile {
    curr_time: string;
    total_steps: number;
}