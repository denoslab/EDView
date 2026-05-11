import type { ReplayFile, PersonaRole } from "./types";

const ROLES: ReadonlySet<PersonaRole> = new Set([
  "Patient",
  "Doctor",
  "TriageNurse",
  "BedsideNurse",
  "Unknown",
]);

export function validateReplay(input: unknown): ReplayFile {
  if (typeof input !== "object" || input === null) {
    throw new Error("replay must be an object");
  }
  const r = input as Record<string, unknown>;
  if (r.schemaVersion !== 1) {
    throw new Error(`unsupported schemaVersion: ${String(r.schemaVersion)}`);
  }
  if (typeof r.mapId !== "string" || r.mapId.length === 0) {
    throw new Error("mapId must be a non-empty string");
  }
  if (typeof r.metadata !== "object" || r.metadata === null) {
    throw new Error("metadata missing");
  }
  if (!Array.isArray(r.personas)) {
    throw new Error("personas must be an array");
  }
  for (const p of r.personas as Array<Record<string, unknown>>) {
    if (typeof p.id !== "string") throw new Error("persona.id must be string");
    if (typeof p.role !== "string" || !ROLES.has(p.role as PersonaRole)) {
      throw new Error(`persona.role invalid: ${String(p.role)}`);
    }
  }
  if (!Array.isArray(r.frames)) {
    throw new Error("frames must be an array");
  }

  return input as ReplayFile;
}

export async function loadReplayFromUrl(url: string): Promise<ReplayFile> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  const json = await res.json();
  return validateReplay(json);
}

export async function loadReplayFromFile(file: File): Promise<ReplayFile> {
  const text = await file.text();
  const json = JSON.parse(text);
  return validateReplay(json);
}
