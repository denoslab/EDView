import {ReplayAgentDelta} from '@/replay/types'




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
}

export interface MetaMovementFile {
    curr_time: string;
    total_steps: number;
}