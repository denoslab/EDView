import {ReplayAgentDelta} from '@/replay/types'


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
    agents: Record<string, ReplayAgentDelta>;
    meta: MetaMovementFile;
    step: number;
}


export interface MetaMovementFile {
    curr_time: string;
    total_steps: number;
}