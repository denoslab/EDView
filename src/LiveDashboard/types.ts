export interface ZoneDetail {
  current: number;
  capacity: number;
}

export interface ZoneOccupancy {
  [zoneName: string]: ZoneDetail;
  // Based on your initial schema, this includes:
  // "diagnostic room"?: ZoneDetail;
  // "major injuries zone"?: ZoneDetail;
  // "minor injuries zone"?: ZoneDetail;
  // "trauma room"?: ZoneDetail;
}

export interface PatientStates {
  [stateName: string]: number;
  // Based on your initial schema, this includes:
  // WAITING_FOR_FIRST_ASSESSMENT?: number;
  // TRIAGE?: number;
  // WAITING_FOR_TRIAGE?: number;
}

export interface Queues {
  triage: number;
  bedside_nurse_waiting: number;
  pager: number;
  doctor_global: number;
}

export interface NurseStatus {
  Monitoring: number;
  Transferring: number;
  Resting: number;
  Available: number;
  Other: number;
}

export interface DoctorAssigned {
  [doctorName: string]: number; // e.g., "Doctor 1": 1
}

// Representing rows in the final table array
export interface CompletedStageRow {
  [columnName: string]: string | number;
}

// Main root object structure
export interface LiveSimulationData {
  step: number;
  sim_time: string;
  elapsed_hours: number;
  elapsed_mins: number;
  current_patients: number;
  total_patients: number;
  completed: number;
  left_ed: number;
  patient_states: PatientStates;
  zone_occupancy: ZoneOccupancy;
  queues: Queues;
  nurse_status: NurseStatus;
  doctor_assigned: DoctorAssigned;
  doctors_total: number;
  doctors_accepting: number;
  doctor_max_patients: number;
  completed_stages: CompletedStageRow[];
}