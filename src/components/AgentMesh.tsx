import { Capsule, Text } from "@react-three/drei";
import type { PersonaState } from "@/replay/usePersonaPositions";
import { roleToColor } from "@/replay/roleColors";

export function AgentMesh({ state }: { state: PersonaState }) {
  const color = roleToColor(state.role);
  return (
    <group position={[state.worldX, 0, state.worldZ]}>
      {/* Ground shadow ring at floor level — shows the actual tile the persona occupies */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.25, 0.32, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} />
      </mesh>
      {/* Subtle vertical connector from shadow up to capsule bottom (world frame).
          Capsule bottom sits at state.worldY - 0.525 (capsule radius 0.25 + half-length 0.275).
          Connector midpoint = (worldY - 0.525) / 2; length = (worldY - 0.525). */}
      <mesh position={[0, (state.worldY - 0.525) / 2, 0]}>
        <cylinderGeometry args={[0.005, 0.005, state.worldY - 0.525, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>
      {/* Floating capsule + nameplate */}
      <group position={[0, state.worldY, 0]}>
        <Capsule args={[0.25, 0.55, 4, 12]}>
          <meshStandardMaterial color={color} />
        </Capsule>
        <Text
          position={[0, 0.95, 0]}
          fontSize={0.22}
          color="#ffffff"
          outlineWidth={0.025}
          outlineColor="#000000"
          anchorX="center"
          anchorY="bottom"
        >
          {state.id}
        </Text>
      </group>
    </group>
  );
}
