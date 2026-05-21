import type { ReplayFrame, ReplayAgentDelta } from "./types";
import type { initialState } from "@/liveMap/types";

export interface ExpandedFrame {
  step: number;
  simTime: string;
  agents: Record<string, ReplayAgentDelta>;
}

export function expandFrames(frames: readonly ReplayFrame[]): ExpandedFrame[] {
  const carry: Record<string, ReplayAgentDelta> = {};
  const out: ExpandedFrame[] = [];
  for (const frame of frames) {
    for (const [id, delta] of Object.entries(frame.agents)) {
      carry[id] = { ...(carry[id] ?? {}), ...delta };
    }
    out.push({
      step: frame.step,
      simTime: frame.simTime,
      agents: { ...carry },
    });
  }
  return out;
}


export function expandInitialState (state: initialState): ExpandedFrame[]{
  const personas = state.state;

  const carry: Record<string, ReplayAgentDelta> = {}
  Object.entries(personas).forEach(([key, value]) => {
  console.log(`${key}: ${value}`);
      carry[key] = {x: value.x, y:value.y}
  });
  return [{step: 0,
          simTime: state.metadata.time,
          agents:carry
          }];
}

export function expandLiveFrame (frame?: ReplayFrame, step?: number): ExpandedFrame[]{
  if (!frame || !step){
    return [];
  }
  
  const personas = frame.agents;
  const out: ExpandedFrame = {step: step,
          simTime: frame.simTime,
          agents:personas
          } 
          
console.log("out", out)

  return [out];
}