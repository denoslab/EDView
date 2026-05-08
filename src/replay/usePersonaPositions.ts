import { useMemo, useRef } from "react";
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
// const FAN_RADIUS = 0.32;
// const FAN_PHASE = Math.PI / 4;

export function usePersonaPositions(args: {
  expanded: ExpandedFrame[];
  personas: ReplayPersona[];
  currentStep: number;
  interpAlpha: number;
  collisionMask: boolean[][];
}): Record<string, PersonaState> {
  const personaIndex = useMemo(() => {
    const map = new Map<string, ReplayPersona>();
    for (const p of args.personas) map.set(p.id, p);
    return map;
  }, [args.personas]);

  const personaPathsRef = useRef(new Map<string, { x: number; y: number }[]>());
  const personaPositionsRef = useRef(new Map<string, { x: number; y: number }>());
  const personaProgressRef = useRef(new Map<string, number>()); // Track progress 0-1 through current step

return useMemo(() => {
  const cur = args.expanded[args.currentStep];
  const next = args.expanded[Math.min(args.currentStep + 1, args.expanded.length - 1)];
  if (!cur) return {};

  const personaPaths = personaPathsRef.current;
  const personaPositions = personaPositionsRef.current;
  const personaProgress = personaProgressRef.current;

  const out: Record<string, PersonaState> = {};
  for (const [id, delta] of Object.entries(cur.agents)) {
    const meta = personaIndex.get(id);
    if (!meta) continue;
    const role: PersonaRole = meta?.role ?? "Unknown";

    const fromX = personaPositions.get(id)?.x ?? (delta.x ?? 0);
    const fromY = personaPositions.get(id)?.y ?? (delta.y ?? 0);

    const nDelta = next?.agents?.[id];
    let targetX = nDelta?.x ?? fromX;
    let targetY = nDelta?.y ?? fromY;

    let path = personaPaths.get(id);
    if ((!path || path.length === 0) && (Math.floor(targetX) !== Math.floor(fromX) || Math.floor(targetY) !== Math.floor(fromY))) {
      path = pathFinder({ x: Math.floor(fromX), y: Math.floor(fromY) }, 
                        { x: Math.floor(targetX), y: Math.floor(targetY) }, 
                        args.collisionMask);
      personaPaths.set(id, path);
      personaProgress.set(id, 0);
    }

    let toX = fromX;
    let toY = fromY;
    let progress = personaProgress.get(id) ?? 0;

    if (path && path.length > 0) {
      // Increment progress by 1/MOVEMENT_SPEED per frame
      progress += 1 / 8; // Adjust this divisor to change movement speed (lower = faster)

      if (progress >= 1) {
        // Move to next step
        const nextStep = path.shift();
        if (!nextStep) {
          // Path completed, snap to target
          toX = targetX;
          toY = targetY;
        } else {
          toX = nextStep.x;
          toY = nextStep.y;
          progress = 0;
          personaPaths.set(id, path);
        }
      } else {
        // Interpolate between current and next step
        const currentStep = path[0];
        const prevPos = personaPositions.get(id) || { x: fromX, y: fromY };
        toX = prevPos.x + (currentStep.x - prevPos.x) * progress;
        toY = prevPos.y + (currentStep.y - prevPos.y) * progress;
      }

      personaProgress.set(id, progress);
    }

    personaPositions.set(id, { x: toX, y: toY });

    const lerpX = toX;
    const lerpY = toY;

    out[id] = {
      id,
      role,
      worldX: lerpX + 0.5,
      worldZ: lerpY + 0.5,
      worldY: FLOATING_Y,
      pronunciatio: delta.pronunciatio ?? null,
      description: delta.description ?? null,
      finalState: meta?.finalState,
    };
  }
  return out;
}, [args.expanded, args.currentStep, args.interpAlpha, personaIndex]);}


function isTileWalkable(
  x: number,
  y: number,
  collisionMask: boolean[][]
): boolean {
  // Clamp to valid bounds
  if (y < 0 || y >= collisionMask.length) return false;
  if (x < 0 || x >= collisionMask[y]?.length) return false;
  return !collisionMask[y][x];
}
 
function pathFinder(
  start: { x: number; y: number },
  end: { x: number; y: number },
  collisionMask: boolean[][]
): { x: number; y: number }[] {
  if (!collisionMask || collisionMask.length === 0) return [start];
  if (!isTileWalkable(end.x, end.y, collisionMask)) return [start];

  const openSet = new Map<string, Node>();
  const closedSet = new Set<string>();
  const startKey = `${start.x},${start.y}`;
  const endKey = `${end.x},${end.y}`;

  if (startKey === endKey) return [];
  
  const startNode: Node = {
    x: start.x,
    y: start.y,
    g: 0,
    h: heuristic(start, end),
    parent: null,
  };

  openSet.set(startKey, startNode);

  while (openSet.size > 0) {
    let current = Array.from(openSet.values())[0];

    // Find node with lowest f score
    Array.from(openSet.entries()).forEach(([_, node]) => {
      if ((node.g + node.h) < (current.g + current.h)) {
        current = node;
      }
    });

    if (current.x === end.x && current.y === end.y) {
      return reconstructPath(current);
    }

    const currentKey = `${current.x},${current.y}`;
    openSet.delete(currentKey);
    closedSet.add(currentKey);

    // Check all 8 neighbors (or 4 if you prefer cardinal only)
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];

    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`;
      if (closedSet.has(neighborKey)) continue;
      if (!isTileWalkable(neighbor.x, neighbor.y, collisionMask)) continue;

      const g = current.g + 1;
      const h = heuristic(neighbor, end);
      const node = openSet.get(neighborKey);

      if (!node || g < node.g) {
        openSet.set(neighborKey, {
          x: neighbor.x,
          y: neighbor.y,
          g,
          h,
          parent: current,
        });
      }
    }
  }

  // No path found, return start position
  return [start];
}  // Placeholder for pathfinding logic (e.g., A* algorithm)

interface Node {
  x: number;
  y: number;
  g: number; // Cost from start
  h: number; // Heuristic to goal
  parent: Node | null;
}

function heuristic(from: { x: number; y: number }, to: { x: number; y: number }): number {
  // Manhattan distance
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}

function reconstructPath(node: Node): { x: number; y: number }[] {
  const path: { x: number; y: number }[] = [];
  let current: Node | null = node;
  while (current) {
    path.unshift({ x: current.x, y: current.y });
    current = current.parent;
  }

  return path;
}