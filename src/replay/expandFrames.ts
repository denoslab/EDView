import type { ReplayFrame, ReplayAgentDelta } from "./types";

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
