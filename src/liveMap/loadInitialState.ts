import type { initialState } from "./types";
import { ReplayAgentDelta, ReplayFrame } from "@/replay/types";
export interface ExpandedFrame {
  step: number;
  simTime: string;
  agents: Record<string, ReplayAgentDelta>;
}



export function validateInitial(input: unknown): initialState {
  if (typeof input !== "object" || input === null) {
    throw new Error("replay must be an object");
  }
  const r = input as Record<string, unknown>;

  if (typeof r.metadata !== "object" || r.metadata === null) {
    throw new Error("metadata missing");
  }
  if (typeof r.state !== "object" ) {
    throw new Error("state is missing");
  }

  if (typeof r.mapLayout !== "object" ) {
    throw new Error("mapLayout must be an object");
  }
  console.log(input)
  
  return input as initialState;
}

export async function startLiveMap(): Promise<initialState> {
  const res = await fetch("http://localhost:5000/initial_state/");
  if (!res.ok) throw new Error(`fetch initial state failed: ${res.status}, simulation must be running.`);
  const json = await res.json();
  return validateInitial(json);
}

export function convertToDelta (state: initialState): ReplayFrame{
  const personas = state.state;

  const carry: Record<string, ReplayAgentDelta> = {}
  Object.entries(personas).forEach(([key, value]) => {
  console.log(`${key}: ${value}`);
      carry[key] = {x: value.x, y:value.y}
  });
  return {step: 0,
          simTime: state.metadata.time,
          agents:carry
          };
}



