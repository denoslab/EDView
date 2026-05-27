import type {MovementFile, ReplayAgentDelta } from "./types";

export interface ExpandedFrame {
  step: number;
  simTime: string;
  agents: Record<string, ReplayAgentDelta>;
}

export function expandLiveFrame (frame?: MovementFile, step?: number): ExpandedFrame[]{
  if (!frame || !step){
    return [];
  }
  
  const personas = frame.agents;
  const out: ExpandedFrame = {step: step,
          simTime: frame.meta.curr_time,
          agents:personas
          } 
          
console.log("out", out)

  return [out];
}