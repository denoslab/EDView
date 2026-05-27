import { BlobOptions } from "buffer";
import type { initialState, liveMapMetaData } from "./types";



export function validateInitial(input: unknown): initialState {
  if (typeof input !== "object" || input === null) {
    throw new Error("replay must be an object");
  }
  const r = input as Record<string, unknown>;

  if (typeof r.metadata !== "object" || r.metadata === null) {
    throw new Error("metadata missing or not an object");
  }
  else{
    const metadata = r.metadata as liveMapMetaData
    if(!metadata.time || !metadata.heightInTiles || !metadata.widthInTiles){
      throw new Error("metadata missing attributes");

    } 
  }
  
  if (!Number.isInteger(r.step)) {
    throw new Error("Step must be a integer");
  }

  if (typeof r.mapLayout !== "object" || !r.mapLayout ) {
    throw new Error("mapLayout must be an object and not empty");
  }

  return input as initialState;
}

export async function startLiveMap(): Promise<initialState> {
  const res = await fetch("http://localhost:5000/initial_state/");
  if (!res.ok) throw new Error(`fetch initial state failed: ${res.status}, simulation must be running.`);
  const json = await res.json();
  return validateInitial(json);
}

export async function isSimulationUp(): Promise<boolean>{
  try{
  const res = await fetch("http://localhost:5000/initial_state/", {
    signal: AbortSignal.timeout(500) 
  });
  return res.ok;
  } catch (error: any){
    // If it errors, means simulation isn't up to respond
    return false;

  }
  
}



