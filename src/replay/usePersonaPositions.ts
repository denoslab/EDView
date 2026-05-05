import { useMemo } from "react";
import type { ExpandedFrame } from "./expandFrames";
import type { PersonaRole, ReplayPersona, ReplayPersonaFinalState } from "./types";

export interface PersonaState {
  id: string;
  role: PersonaRole;
  worldX: number;
  worldY: number;
  worldZ: number;
  pronunciatio?: string | null;
  description?: string | null;
  finalState?: ReplayPersonaFinalState;
}

// Avatars sit at world-Y FLOATING_Y (capsule center). With the AgentMesh
// capsule (radius 0.25, length 0.55, total height 1.05), the bottom is at
// FLOATING_Y - 0.525 and top at FLOATING_Y + 0.525. At 1.1 the bottom dips
// into beds/chairs but the upper half (Y ≈ 1.1–1.625) clearly floats above
// the tallest furniture (medical equipment at 1.15) so the head/shoulders
// stay visible.
const FLOATING_Y = 1.1;

// When N personas share a source tile, fan them out around the tile center
// in a small ring so they don't visually stack into a single capsule. Each
// persona's slot is determined by sorting the tile's persona ids — so the
// assignment is deterministic per frame and same-tile avatars always get
// distinct slots regardless of count.
//
// FAN_PHASE rotates the entire ring by 45° so 2-persona groups land on
// the NE/SW diagonal and 4-persona groups on the four diagonals — never
// on cardinal axes. This keeps nameplates from projecting onto the same
// screen-Y line and overlapping when viewed from the default camera angle.
const FAN_RADIUS = 0.32;
const FAN_PHASE = Math.PI / 4;

export function usePersonaPositions(args: {
  expanded: ExpandedFrame[];
  personas: ReplayPersona[];
  currentStep: number;
  interpAlpha: number;
}): Record<string, PersonaState> {
  const personaIndex = useMemo(() => {
    const map = new Map<string, ReplayPersona>();
    for (const p of args.personas) map.set(p.id, p);
    return map;
  }, [args.personas]);

  return useMemo(() => {
    const cur = args.expanded[args.currentStep];
    const next = args.expanded[Math.min(args.currentStep + 1, args.expanded.length - 1)];
    if (!cur) return {};

    // Group personas by their integer source tile. Within each tile, sort
    // ids alphabetically and assign each persona a slot index — that way
    // co-located avatars always fan out into distinct positions in a ring.
    const tileGroups = new Map<string, string[]>();
    for (const [id, delta] of Object.entries(cur.agents)) {
      const key = `${delta.x ?? 0},${delta.y ?? 0}`;
      const group = tileGroups.get(key);
      if (group) group.push(id);
      else tileGroups.set(key, [id]);
    }
    for (const group of tileGroups.values()) group.sort();

    const out: Record<string, PersonaState> = {};
    for (const [id, delta] of Object.entries(cur.agents)) {
      const meta = personaIndex.get(id);
      const role: PersonaRole = meta?.role ?? "Unknown";

      const fromX = delta.x ?? 0;
      const fromY = delta.y ?? 0;
      const nDelta = next?.agents?.[id];
      const toX = nDelta?.x ?? fromX;
      const toY = nDelta?.y ?? fromY;

      const lerpX = fromX + (toX - fromX) * args.interpAlpha;
      const lerpY = fromY + (toY - fromY) * args.interpAlpha;

      // Per-tile fan-out: 1 persona → centered; 2+ → evenly spaced ring.
      const tileKey = `${fromX},${fromY}`;
      const group = tileGroups.get(tileKey)!;
      let dx = 0;
      let dz = 0;
      if (group.length > 1) {
        const slotIdx = group.indexOf(id);
        const angle = (slotIdx / group.length) * Math.PI * 2 + FAN_PHASE;
        dx = Math.cos(angle) * FAN_RADIUS;
        dz = Math.sin(angle) * FAN_RADIUS;
      }

      out[id] = {
        id,
        role,
        worldX: lerpX + 0.5 + dx,
        worldZ: lerpY + 0.5 + dz,
        worldY: FLOATING_Y,
        pronunciatio: delta.pronunciatio ?? null,
        description: delta.description ?? null,
        finalState: meta?.finalState,
      };
    }
    return out;
  }, [args.expanded, args.currentStep, args.interpAlpha, personaIndex]);
}
