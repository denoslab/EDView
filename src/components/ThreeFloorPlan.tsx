/**
 * `ThreeFloorPlan` — full 3D floor plan renderer using Three.js.
 *
 * Full 3D floor plan renderer:
 *  - **Floors**: flat PlaneGeometry per zone, textured with the same
 *    raster PNGs the 2D renderer uses.
 *  - **Walls**: extruded BoxGeometry along every wall segment, with a
 *    white MeshStandardMaterial and real shadow casting.
 *  - **Furniture**: Kenney `.glb` models loaded via `useGLTF` and
 *    positioned at each equipment tile.
 *  - **Lighting**: DirectionalLight (with shadow map) + soft
 *    AmbientLight for fill.
 *  - **Camera**: OrbitControls — drag to rotate, scroll to zoom,
 *    right-drag to pan.
 *
 * The component consumes the same {@link MapLayout} data model that the
 * 2D layers use, so the parser, sidebar, and test infrastructure are
 * completely unchanged.
 *
 * @packageDocumentation
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree, extend, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { TextureLoader } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { Text } from 'troika-three-text';
import type { MapLayout, EquipmentPlacement, ZoneRegion, WallDecorationType, EquipmentType } from '@/parser/types';
import type { PersonaState } from '@/replay/usePersonaPositions';
import { AgentLayer } from './AgentLayer';
import { CANVAS_BACKGROUND_COLOR } from '@/theme/colors';
import { start } from 'repl';
import { add, string } from 'three/tsl';
import { zoneDisplayName } from '@/parser';
import { StringController } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { seededRandom } from 'three/src/math/MathUtils.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { get } from 'http';
// Extend react-three-fiber with the Text component
extend({ Text });

// Extend react-three-fiber with the Text component
extend({ Text });

/** Props for {@link ThreeFloorPlan}. */
export interface ThreeFloorPlanProps {
  /** Parsed map layout. */
  layout: MapLayout;
  /** Show zone labels. */
  showZoneLabels?: boolean;
  /** Optional persona positions (world units) keyed by persona id */
  personas?: Record<string, PersonaState>;
}

/** Scale: 1 tile = 1 Three.js unit. */
const FLOOR_Y = 0;

/**
 * FBX model URL mapping for each equipment type.
 *
 * Models are from the Hospital interior asset pack, copied to
 * `public/models/hospital/`. They share a common texture atlas
 * (`Texture_Atlas_Colors_2.png`) loaded once and applied to every
 * model's materials.
 */
/** Resolve a path relative to Vite's configured `base` URL. */
const base = import.meta.env.BASE_URL;

const MODEL_URLS: Record<string, string> = {
  bed: `${base}models/hospital/bed.fbx`,
  chair: `${base}models/hospital/chair.fbx`,
  waiting_room_chair: `${base}models/hospital/waiting_room_chair.fbx`,
  computer: `${base}models/hospital/h_table.fbx`,
  diagnostic_table: `${base}models/hospital/diagnostic_table.fbx`,
  medical_equipment: `${base}models/hospital/medical_equipment.fbx`,
  wheelchair: `${base}models/hospital/wheelchair.fbx`,
  receptionist_chair:`${base}models/hospital/chair_reception.fbx`,
  receptionist_desk:`${base}models/hospital/reception_desk.fbx`,
  triage_bed:`${base}models/hospital/diagnostic_table.fbx`
};

/** Path to the shared texture atlas used by all hospital FBX models. */
const TEXTURE_ATLAS_URL = `${base}models/hospital/Texture_Atlas_Colors_2.png`;

/**
 * Scale factors per equipment type, calculated from measured FBX
 * bounding boxes. The hospital FBX models are authored in millimetres
 * (a bed is ~1404 mm long). Each factor converts the model to
 * Three.js units where 1 unit = 1 map tile.
 *
 * Measured bounding boxes (width × depth × height in mm):
 *   bed:              589.7 × 1403.7 × 533.4  → target 1.2 tiles
 *   chair:            319.2 × 371.6  × 520.2  → target 0.5 tiles
 *   waiting_chair:    1826.7 × 385.7 × 579.2  → target 0.8 tiles
 *   computer:         328.5 × 47.4   × 221.5  → target 0.4 tiles
 *   medical_equipment:327.8 × 298.8  × 765.6  → target 0.4 tiles
 *   wheelchair:       399.7 × 646.7  × 565.0  → target 0.6 tiles
 *   diagnostic_table: 456.1 × 1244.8 × 653.8  → target 1.0 tiles
 */
const MODEL_SCALE: Record<string, number> = {
  default: 0.001,
  bed: 0.0015,
  chair: 0.0015,
  waiting_room_chair: 0.0009,
  computer: 0.0015,
  diagnostic_table: 0.0015,
  medical_equipment: 0.0015,
  wheelchair: 0.0015,
  receptionist_desk: 0.001,
  triage_bed: 0.0015
};

/**
 * Equipment types that are handled by the ReceptionDecorations
 * component instead of per-tile placement. The parser emits 12
 * individual waiting_room_chair tiles but the FBX model is a
 * multi-seat bench — placing one per tile creates overlapping
 * furniture. These types are skipped in Furniture and placed
 * manually with correct count and positioning.
 */
const DECORATION_HANDLED_TYPES = new Set();

/* ZONE_COLORS and CANVAS_BACKGROUND_COLOR imported from @/theme/colors */

/* -------------------------------------------------------------------------- */
/* Floor zones                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Scale factor to convert FBX mm to Three.js units (1 unit = 1 tile).
 * The hospital FBX models are in mm: a 1000mm wall = 1 tile.
 */
const FBX_SCALE = 0.001;

/**
 * Choose the floor FBX model URL based on zone type.
 * - Reception/waiting → blue tile floor
 * - Clinical rooms → beige ward floor
 * - Hallway → office floor (neutral)
 */
function floorModelForZone(zoneId: string): string {
  switch (zoneId) {
    case 'waiting_room':
      return `${base}models/hospital/floor_reception.fbx`;
    case 'hallway':
    case 'exit':
      return `null`;
    default:
      return `${base}models/hospital/floor_ward.fbx`;
  }
}

/**
 * Zone floor tiled with FBX floor models from the Hospital pack.
 *
 * Each floor FBX is a 1m×1m (or 2m×2m) tile. We load it once and
 * clone it across the zone's bounding box.
 */
function ZoneFloor({ zone }: { zone: ZoneRegion }) {
  const floorUrl = floorModelForZone(zone.zoneId);
  const floorModel = useFBXModel(floorUrl);

  const tileSetLookup = useMemo(() => {
    const s = new Set<string>();
    for (const t of zone.tilePositions) s.add(`${t.x},${t.y}`);
    return s;
  }, [zone.tilePositions]);

  if (!floorModel) return null;
  const minX = zone.bounds.minX;
  const minZ = zone.bounds.minY;
  const maxX = zone.bounds.maxX + 1;
  const maxZ = zone.bounds.maxY + 1;

  let offset = 1;
  if(zone.zoneId === 'waiting_room'){
      offset = 2; // Slightly raise the floor at the edges of the waiting room to create a subtle border effect
  }
  let startZ: number | null = null;
  const tiles: Array<{ x: number; z: number; key: string; offset: number; model: THREE.Object3D; sizeZ: number }> = [];
  for (let x = minX; x < maxX; x++) {
    startZ = null;
    for (let z = minZ; z < maxZ; z++) {
      const hasTile = tileSetLookup.has(`${x},${z}`);
      if (hasTile) {
        if(zone.zoneId === 'waiting_room'){
          const modelClone = floorModel.clone(true);
          tiles.push({ x, z: z, key: `floor-${zone.zoneRegionId}-${x}-${z}`, offset:offset, model: modelClone, sizeZ: 1});
        }        
        else if (startZ === null) {
        //const modelClone = floorModel.clone(true);)
          startZ = z;
        //tiles.push({ x, z, key: `floor-${zone.zoneRegionId}-${x}-${z}`, offset:offset, model: modelClone });
        }
      }
      else if (startZ !== null) {
        // Handle the case where we're at the end of a contiguous area
        const modelClone = floorModel.clone(true);
        const sizeZ = z - startZ;
        tiles.push({ x, z: startZ, key: `floor-${zone.zoneRegionId}-${x}-${z}`, offset:offset, model: modelClone, sizeZ: sizeZ });
        startZ = null;
      }
    }
    if (startZ !== null) {
        // Handle the case where we're at the end of a contiguous area
        const sizeZ = maxZ - startZ;

        const modelClone = floorModel.clone(true);
        tiles.push({ x, z:(startZ), key: `floor-${zone.zoneRegionId}-${x}-${startZ}`, offset:offset, model: modelClone, sizeZ: sizeZ });
    }
  }

  return (
    <>
      {tiles.map(({ x, z, key, offset, model, sizeZ }) => (
        <primitive
          key={key}
          object={model}
          position={[x + 0.5, -0.05, z  + sizeZ / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[FBX_SCALE/offset, sizeZ*FBX_SCALE/offset , FBX_SCALE]}
          castShadow = {false}
          receiveShadow={true}
        />
      ))}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Walls                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Walls tiled with FBX wall models from the Hospital pack.
 *
 * Each wall_small_ward.fbx is 1000mm = 1 tile wide. For each wall
 * segment, we tile wall models at 1-tile intervals along its length.
 * Vertical walls get a 90-degree Y rotation.
 */
function Walls({ layout }: { layout: MapLayout }) {
  const wallModel = useFBXModel(`${base}models/hospital/wall_small_ward.fbx`);
  const doorModel = useFBXModel(`${base}models/hospital/single_doorway.fbx`);
  if (!wallModel) return null;
  if (!doorModel) return null;

  const wallPlacements: Array<{
    key: string;
    x: number;
    z: number;
    rotY: number;
    type: THREE.Group;
    decoration?: WallDecorationType;
  }> = [];
  let decorationSeed = 2; // Seed for wall decoration randomization, incremented for each wall segment
  layout.walls.forEach((wall, i) => {
    if (wall.orientation === 'horizontal') {
      const z = wall.y1;
      const startX = Math.min(wall.x1, wall.x2);
      const endX = Math.max(wall.x1, wall.x2);

      for (let x = startX; x < endX; x++) {
        const decoration = addWallDecorations(decorationSeed++, wall.validDecorationRotation);
        

        wallPlacements.push({
          key: `wall-h-${i}-${x}`,
          x: x + 0.5,
          z,
          rotY: 0,
          type: wall.type === 'doorway' ? doorModel : wallModel,
          decoration: decoration
        });
      }
    } else {
      const x = wall.x1;
      const startZ = Math.min(wall.y1, wall.y2);
      const endZ = Math.max(wall.y1, wall.y2);
      for (let z = startZ; z < endZ; z++) {
        const decoration = addWallDecorations(decorationSeed++, wall.validDecorationRotation);
        
        wallPlacements.push({
          key: `wall-v-${i}-${z}`,
          x,
          z: z + 0.5,
          rotY: Math.PI / 2,
          type: wall.type === 'doorway' ? doorModel : wallModel,
          decoration: decoration
        });
      }
    }

  });

  return (
    <>
      {wallPlacements.map(({ key, x, z, rotY,type, decoration }) => (
        <WallSegment key={key} x={x} z={z} rotY={rotY} type={type} decoration={decoration}/>
      ))}
    </>
  );
}

function addWallDecorations(seed: number, validDecorationRotation: string): WallDecorationType {
  // Implementation for adding wall decorations
  if(validDecorationRotation === "none") return {modelName: null}; // No decorations for doorways
  
  const wallDecorations: Array<WallDecorationType> =  [{modelName: 'cabinet.fbx', yOffset: 0},
                            {modelName: 'plant.fbx', yOffset: 0}, 
                            {modelName: 'tv.fbx', yOffset: 1, zOffset: -0.2}  ,
                            {modelName: 'table_magazines.fbx', yOffset: 0},
                            {modelName: 'garbage.fbx'}]; // Example decorations
               
  const decorationProbability = 0.3; // 30% chance to add a decoration to a wall
  if (seededRandom(seed) < decorationProbability) {
    // Add a decoration to the wall
    const randomItem = wallDecorations[Math.floor(seededRandom(seed + 1) * wallDecorations.length)];
    if (randomItem) {
      let yRotation = 0; 
      let zOffset = randomItem.zOffset || -0.26; // Default zOffset if not specified in the decoration
      if(validDecorationRotation === "interior"){
        const rotationProbability = 0.5; // 50% chance to rotate the decoration
        if (seededRandom(seed + 2) < rotationProbability) {
          yRotation = Math.PI; // Rotate 90 degrees
          zOffset = Math.abs(zOffset); // Adjust zOffset for the rotated position
        }
      }
      else if(validDecorationRotation === "right_edge" || validDecorationRotation === "bottom_edge"){
        yRotation = Math.PI; // Rotate 90 degrees
        zOffset = Math.abs(zOffset); // Adjust zOffset for the rotated position
      }
      return {...randomItem,yRotation,zOffset};    
    }
  }
  return {modelName: null}; // Return null if no decoration is added
}

const WallSegment = ({ key, x, z, rotY, type, decoration }: { key: string; x: number; z: number; rotY: number; type: THREE.Group; decoration?: WallDecorationType }) => {
  return (
    <>
        <group key={`wall-group-${key}`}
          position={[x, FLOOR_Y, z]}
          rotation={[-Math.PI / 2, 0, rotY]}>
          <primitive
            key={key}
            object={type.clone(true)}
            scale={[FBX_SCALE, FBX_SCALE, FBX_SCALE]}
            castShadow={false}
          />

           
            { decoration?.modelName && (
              <WallDecoration prop={decoration}/>
            
          )} 
        </group>
    </>
  );
}

const WallDecoration = ({ prop }: { prop: WallDecorationType }) => {
  // The hook is now safely at the top level of this sub-component
  const model = useFBXModel(`${base}models/hospital/${prop.modelName}`);
  if (!model) return null;
  return (
    <primitive 
      object={model} 
      position={[prop.xOffset || 0, prop.zOffset || -0.26, prop.yOffset || 0]} 
      rotation={[0, 0, prop.yRotation || 0]} 
      scale={[FBX_SCALE, FBX_SCALE, FBX_SCALE]} 
    />
  );
};

/* -------------------------------------------------------------------------- */
/* Ground plane (surrounding area)                                            */
/* -------------------------------------------------------------------------- */

function GroundPlane({ layout }: { layout: MapLayout }) {
  const floorModel = useFBXModel(`${base}models/hospital/floor_office.fbx`);
  const x = layout.widthInTiles / 2 - 0.5;
  const z = layout.heightInTiles / 2 - 0.5;
  if (!floorModel) return null;

  return (
    <primitive
      object={floorModel.clone(true)}
      position={[x, -0.05, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[FBX_SCALE * (layout.widthInTiles - 1), FBX_SCALE * (layout.heightInTiles - 1), FBX_SCALE]}
      receiveShadow
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Furniture                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Load an FBX model, apply the shared hospital texture atlas, clone
 * it, and configure shadow casting. Uses a module-level cache so each
 * model URL is loaded only once regardless of how many placements
 * reference it.
 */
const fbxCache = new Map<string, THREE.Group>();
const textureCache: { atlas: THREE.Texture | null } = { atlas: null };

function useFBXModel(modelUrl: string): THREE.Group | null {
  const [model, setModel] = useState<THREE.Group | null>(
    () => fbxCache.get(modelUrl)?.clone(true) ?? null
  );

  useEffect(() => {
    if (fbxCache.has(modelUrl)) {
      setModel(fbxCache.get(modelUrl)!.clone(true));
      return;
    }

    const loader = new FBXLoader();
    const texLoader = new TextureLoader();

    // Load the shared texture atlas once.
    const loadAtlas = (): Promise<THREE.Texture> => {
      if (textureCache.atlas) return Promise.resolve(textureCache.atlas);
      return new Promise((resolve) => {
        texLoader.load(TEXTURE_ATLAS_URL, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          textureCache.atlas = tex;
          resolve(tex);
        });
      });
    };

    // Set the resource path so the FBXLoader can find the shared
    // texture atlas files (Texture_Atlas_Colors_2.png, etc.)
    // that the FBX materials reference.
    loader.setResourcePath(`${base}models/hospital/`);

    let cancelled = false;
    loadAtlas().then((atlas) => {
      loader.load(
        modelUrl,
        (fbx) => {
          if (cancelled) return;
          fbx.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              // Apply the shared texture atlas to meshes that lack a
              // texture. Keep the original material colour so the
              // model's vertex colours / face colours show through.
              // The FBX models use a colour palette atlas. Apply it as
              // the texture map and keep Phong shading (which these
              // low-poly models were designed for).
              const mats = Array.isArray(child.material)
                ? child.material
                : [child.material];
              mats.forEach((m) => {
                const phong = m as THREE.MeshPhongMaterial;
                if (!phong.map) phong.map = atlas;
                phong.side = THREE.DoubleSide;
                phong.shininess = 20;
              });
            }
          });
          fbxCache.set(modelUrl, fbx);
          setModel(fbx.clone(true));
        },
        undefined,
        (err) => {
          if (!cancelled) console.warn('Failed to load FBX:', modelUrl, err);
        }
      );
    });

    return () => { cancelled = true; };
  }, [modelUrl]);

  return model;
}

/**
 * Renders a single hospital FBX model at the given equipment
 * placement's tile position.
 */
function FurnitureModel({
  piece,
  modelUrl
}: {
  piece: EquipmentPlacement;
  modelUrl: string;
}) {
  const model = useFBXModel(modelUrl);
  const scale = MODEL_SCALE[piece.type] ?? MODEL_SCALE.default;

  if (!model) return null;
  return (
    
    <primitive
      object={model}
      scale={[scale, scale, scale]}
          />
  );
}

/**
 * Renders all furniture placements from the parsed layout.
 */
function Furniture({ layout }: { layout: MapLayout }) {
  return (
    <>
      {layout.equipment.map((piece) => {
        // Skip types that are handled by ReceptionDecorations
        if (DECORATION_HANDLED_TYPES.has(piece.type)) return null;
        const modelUrl = MODEL_URLS[piece.type];
        if (!modelUrl) return null;

        return (
          <group position={[piece.tileX + 0.5, FLOOR_Y, piece.tileY + 0.5]}
                rotation={[-Math.PI / 2, 0, piece.rotation]}
                key={piece.equipmentId}>
            <FurnitureModel
              piece={piece}
              modelUrl={modelUrl}
            />
            <DecorationSetPiece type={piece} />
          </group>
        );
      })}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Reception area decorations                                                 */
/* -------------------------------------------------------------------------- */

/** A single FBX decoration placed at a fixed position. */
function Decoration({
  url,
  position,
  rotation,
  scale
}: {
  url: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  const model = useFBXModel(url);
  if (!model) return null;
  const s = scale ?? FBX_SCALE;
  return (
    <primitive
      object={model.clone(true)}
      position={position}
      rotation={rotation ?? [-Math.PI / 2, 0, 0]}
      scale={[s, s, s]}
    />
  );
}

function DecorationSetPiece({type}: {type: EquipmentPlacement}) {
  const decorations = getDecorationForType(type.type);

  if (!decorations) return null;

  return (
    <>
      {decorations.map((decoration) => (
        <Decoration
          key={`${type.equipmentId}-${decoration.url}`}
          url={decoration.url}
          position={decoration.position}
          rotation={decoration.rotation}
          scale={decoration.scale}
        />
      ))}
    </>
  );
}




function getDecorationForType(type: string): Array<{ url: string; position: [number, number, number]; rotation?: [number, number, number]; scale?: number }> | null {
  if (type === 'receptionist_desk') {
    return [
      { url: MODEL_URLS['receptionist_chair'], position: [0, 1, 0], rotation: [0, 0, 0], scale: MODEL_SCALE['receptionist_chair'] },
      { url: `${base}models/hospital/garbage.fbx`, position: [-1, 1, 0], rotation: [0, 0, 0], scale: MODEL_SCALE['receptionist_chair'] },

    ];
  }
  return null;
}
    /**
 * Places all reception/waiting room decorations from the Hospital pack
 * inside the first waiting_room zone: reception desk with PC, magazine
 * tables, plants, garbage, TV, bookshelf.
 */
function ReceptionDecorations({ layout }: { layout: MapLayout }) {
  const waitingZone = layout.zones.find((z) => z.zoneId === 'waiting_room');
  if (!waitingZone) return null;

  const { minX, minY, maxX, maxY } = waitingZone.bounds;
  const cx = (minX + maxX + 1) / 2;
  const cz = (minY + maxY + 1) / 2;
  const s = FBX_SCALE;

  // Place items relative to zone bounds using common sense for a
  // hospital reception area:
  //  - Reception desk near the top edge (facing the room)
  //  - Receptionist chair behind the desk
  //  - PC setup on the desk
  //  - Magazine tables in the centre
  //  - Plants in corners
  //  - Garbage near the entrance (bottom edge)
  //  - TV on a side wall
  //  - Bookshelf against a wall

  // Waiting room layout (x: 0→7, z: 7→18):
  //   z 8-9:   Reception desk + PC + receptionist chair
  //   z 10-16: 2 bench rows facing each other, magazine table between
  //   z 17:    Plant, garbage near exit
  //
  // All items use FBX_SCALE (0.001) with no multipliers to avoid
  // oversized models. Each H_Chair_Clients bench is ~1.8 tiles wide
  // at this scale — we place exactly 1 per row.

  return (
    <>
      {/* === DESK AREA (z 8-9) === */}
      {/* <Decoration
        url={`${base}models/hospital/reception_desk.fbx`}
        position={[cx, FLOOR_Y, minY + 2]}
        scale={s * 0.7}
      />
      <Decoration
        url={`${base}models/hospital/chair_reception.fbx`}
        position={[cx, FLOOR_Y, minY + 1.2]}
        scale={s}
      />
      <Decoration
        url={`${base}models/hospital/pc_monitor.fbx`}
        position={[cx - 0.8, FLOOR_Y + 0.4, minY + 2]}
        scale={s}
      />
      <Decoration
        url={`${base}models/hospital/phone.fbx`}
        position={[cx + 0.8, FLOOR_Y + 0.4, minY + 2]}
        scale={s}
      /> */}

      {/* === SEATING AREA (z 10-16) === */}
      {/* 1 bench on the left, facing right */}
      {/* <Decoration
        url={`${base}models/hospital/waiting_chair.fbx`}
        position={[cx - 1.5, FLOOR_Y, cz + 1]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        scale={s}
      /> */}
      {/* 1 bench on the right, facing left */}
      {/* <Decoration
        url={`${base}models/hospital/waiting_chair.fbx`}
        position={[cx + 1.5, FLOOR_Y, cz + 1]}
        rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
        scale={s}
      /> */}
      
      {/* Magazine table in the aisle */}
      <Decoration
        url={`${base}models/hospital/table_magazines.fbx`}
        position={[cx, FLOOR_Y, cz + 1]}
        scale={s}
      />

      {/* === PERIPHERY === */}
      <Decoration
        url={`${base}models/hospital/tv.fbx`}
        position={[maxX + 0.8, FLOOR_Y + 1.0, cz + 1]}
        rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
        scale={s}
      />
      <Decoration
        url={`${base}models/hospital/bookshelf.fbx`}
        position={[minX + 0.2, FLOOR_Y, cz]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        scale={s}
      />
      <Decoration
        url={`${base}models/hospital/plant.fbx`}
        position={[minX + 2, FLOOR_Y, maxY - 2]}
        scale={s}
      />
      <Decoration
        url={`${base}models/hospital/exit_sign.fbx`}
        position={[cx, FLOOR_Y + 1.5, maxY]}
        scale={s}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Lighting                                                                   */
/* -------------------------------------------------------------------------- */

function Lighting({ layout }: { layout: MapLayout }) {
  const targetRef = useRef<THREE.Object3D>(null);
  const cx = layout.widthInTiles / 2;
  const cz = layout.heightInTiles / 2;
  const mapDiag = Math.max(layout.widthInTiles, layout.heightInTiles);

  return (
    <>
      <ambientLight intensity={1.5} color="#FFFFFF" />
      <hemisphereLight intensity={0.6} color="#FFFFFF" groundColor="#8C7A5A" />
      <directionalLight
        position={[cx - mapDiag * 0.4, mapDiag * 0.8, cz - mapDiag * 0.4]}
        intensity={1.8}
        color="#FFFAF0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-mapDiag}
        shadow-camera-right={mapDiag}
        shadow-camera-top={mapDiag}
        shadow-camera-bottom={-mapDiag}
        shadow-camera-near={0.1}
        shadow-camera-far={mapDiag * 3}
        shadow-bias={-0.002}
      >
        {targetRef.current && <primitive object={targetRef.current} />}
      </directionalLight>
      <object3D ref={targetRef} position={[cx, 0, cz]} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Zone labels                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Individual zone label that always faces the camera (billboarding).
 */
function ZoneLabel({ zone }: { zone: ZoneRegion }) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (groupRef.current) {
      // Make the group face the camera
      groupRef.current.lookAt(camera.position);
    }
  });

  const cx = (zone.bounds.minX + zone.bounds.maxX + 1) / 2;
  const cz = (zone.bounds.minY + zone.bounds.maxY + 1) / 2;

  return (
    <group ref={groupRef} position={[cx, FLOOR_Y + 3, cz]}>
      <text
        text={zone.zoneName}
        fontSize={0.5}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        maxWidth={2}
        overflowWrap="normal"
        textAlign="center"
        outlineWidth={0.05}
        outlineColor="#000000"
        outlineOpacity={0.8}
      />
    </group>
  );
}

/**
 * Renders 3D text labels for each zone at its center point.
 */
function ZoneLabels({ layout, showZoneLabels }: { layout: MapLayout; showZoneLabels?: boolean }) {
  if (!showZoneLabels) return null;

  return (
    <>
      {layout.zones.map((zone) => (
        <ZoneLabel key={`label-${zone.zoneRegionId}`} zone={zone} />
      ))}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Main scene                                                                 */
/* -------------------------------------------------------------------------- */

function Scene({
  layout,
  controlsRef,
  showZoneLabels,
  personas,
}: {
  layout: MapLayout;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  showZoneLabels?: boolean;
  personas?: Record<string, PersonaState>;
}) {
  const cx = layout.widthInTiles / 2;
  const cz = layout.heightInTiles / 2;
  const mapDiag = Math.max(layout.widthInTiles, layout.heightInTiles);

  return (
    <>
      <Lighting layout={layout} />
      <GroundPlane layout={layout} />
      {layout.zones.map((zone) => (
        <ZoneFloor key={zone.zoneRegionId} zone={zone} />
      ))}
      <Walls layout={layout} />
      <Furniture layout={layout} />
      <ReceptionDecorations layout={layout} />
      <ZoneLabels layout={layout} showZoneLabels={showZoneLabels} />
      {personas && <AgentLayer personas={personas} />}
      <OrbitControls
        ref={controlsRef as React.RefObject<OrbitControlsImpl>}
        target={[cx, 0, cz]}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={3}
        maxDistance={mapDiag * 2.5}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

/**
 * Helper component rendered inside the Canvas to give the navigation
 * overlay access to the Three.js camera. Exposes `getCamera` via a
 * ref callback so the parent HTML overlay can read camera state.
 */
function CameraExposer({
  cameraRef
}: {
  cameraRef: React.MutableRefObject<THREE.Camera | null>;
}) {
  const { camera } = useThree();
  cameraRef.current = camera;
  return null;
}

/* -------------------------------------------------------------------------- */
/* Navigation overlay (Google Maps style)                                     */
/* -------------------------------------------------------------------------- */

const NAV_BUTTON_STYLE: React.CSSProperties = {
  width: 40,
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#FFFFFF',
  border: '1px solid #D0D0D0',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 20,
  fontWeight: 500,
  color: '#333',
  fontFamily: 'system-ui, sans-serif',
  padding: 0,
  lineHeight: 1,
  userSelect: 'none',
  boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
};

interface NavControlsProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  cameraRef: React.MutableRefObject<THREE.Camera | null>;
  layout: MapLayout;
}

function NavControls({ controlsRef, cameraRef, layout }: NavControlsProps) {
  const ZOOM_STEP = 0.8;
  const ROTATE_STEP = Math.PI / 8;

  const zoom = useCallback(
    (factor: number) => {
      const controls = controlsRef.current;
      const camera = cameraRef.current;
      if (!controls || !camera) return;
      const target = controls.target;
      const dir = camera.position.clone().sub(target);
      dir.multiplyScalar(factor);
      camera.position.copy(target.clone().add(dir));
      controls.update();
    },
    [controlsRef, cameraRef]
  );

  const rotate = useCallback(
    (angle: number) => {
      const controls = controlsRef.current;
      const camera = cameraRef.current;
      if (!controls || !camera) return;
      const target = controls.target;
      const offset = camera.position.clone().sub(target);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x = offset.x * cos - offset.z * sin;
      const z = offset.x * sin + offset.z * cos;
      camera.position.set(target.x + x, camera.position.y, target.z + z);
      controls.update();
    },
    [controlsRef, cameraRef]
  );

  const resetCamera = useCallback(() => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;
    const cx = layout.widthInTiles / 2;
    const cz = layout.heightInTiles / 2;
    const mapDiag = Math.max(layout.widthInTiles, layout.heightInTiles);
    camera.position.set(cx + mapDiag * 0.5, mapDiag * 0.7, cz + mapDiag * 0.5);
    controls.target.set(cx, 0, cz);
    controls.update();
  }, [controlsRef, cameraRef, layout]);

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        top: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        zIndex: 10
      }}
      data-testid="nav-controls"
    >
      {/* Zoom group */}
      <button
        type="button"
        style={{ ...NAV_BUTTON_STYLE, borderRadius: '4px 4px 0 0' }}
        onClick={() => zoom(ZOOM_STEP)}
        title="Zoom in"
        data-testid="nav-zoom-in"
      >
        +
      </button>
      <button
        type="button"
        style={{ ...NAV_BUTTON_STYLE, borderRadius: '0 0 4px 4px' }}
        onClick={() => zoom(1 / ZOOM_STEP)}
        title="Zoom out"
        data-testid="nav-zoom-out"
      >
        −
      </button>

      <div style={{ height: 8 }} />

      {/* Rotate group */}
      <button
        type="button"
        style={{ ...NAV_BUTTON_STYLE, borderRadius: '4px 4px 0 0' }}
        onClick={() => rotate(-ROTATE_STEP)}
        title="Rotate left"
        data-testid="nav-rotate-left"
      >
        ↺
      </button>
      <button
        type="button"
        style={{ ...NAV_BUTTON_STYLE, borderRadius: '0 0 4px 4px' }}
        onClick={() => rotate(ROTATE_STEP)}
        title="Rotate right"
        data-testid="nav-rotate-right"
      >
        ↻
      </button>

      <div style={{ height: 8 }} />

      {/* Reset */}
      <button
        type="button"
        style={NAV_BUTTON_STYLE}
        onClick={resetCamera}
        title="Reset camera"
        data-testid="nav-reset"
      >
        ⌂
      </button>
    </div>
  );
}

/**
 * Top-level Three.js floor plan canvas. Drop-in replacement for
 * Takes the same `MapLayout` the parser produces and renders a real
 * 3D scene with Google Maps-style navigation controls.
 */
export function ThreeFloorPlan({ layout, showZoneLabels, personas }: ThreeFloorPlanProps) {
  const mapDiag = Math.max(layout.widthInTiles, layout.heightInTiles);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);

  return (
    <div
      style={{ width: '100%', height: '100%', background: CANVAS_BACKGROUND_COLOR, position: 'relative' }}
      data-testid="three-floor-plan"
    >
      <Canvas
        shadows
        camera={{
          position: [
            layout.widthInTiles / 2 + mapDiag * 0.5,
            mapDiag * 0.7,
            layout.heightInTiles / 2 + mapDiag * 0.5
          ],
          fov: 45,
          near: 0.1,
          far: mapDiag * 10
        }}
        gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
      >
        <Suspense fallback={null}>
          <Scene layout={layout} controlsRef={controlsRef} showZoneLabels={showZoneLabels} personas={personas} />
          <CameraExposer cameraRef={cameraRef} />
        </Suspense>
      </Canvas>
      <NavControls
        controlsRef={controlsRef}
        cameraRef={cameraRef}
        layout={layout}
      />
    </div>
  );
}
