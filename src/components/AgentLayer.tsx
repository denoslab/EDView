import { AgentMesh } from "./AgentMesh";
import type { PersonaState } from "@/replay/usePersonaPositions";

export function AgentLayer({ personas }: { personas: Record<string, PersonaState> }) {
  return (
    <group>
      {Object.values(personas).map((state) => (
        <AgentMesh key={state.id} state={state} />
      ))}
    </group>
  );
}
