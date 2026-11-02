
export type PersonaRole =
  | "Patient"
  | "Doctor"
  | "TriageNurse"
  | "BedsideNurse"
  | "AdmissionClerk"
  | "Unknown";

export interface ReplayAgentDelta {
  x?: number;
  y?: number;
  pronunciatio?: string | null;
  description?: string | null;
  chat?: unknown | null;
}

export interface ReplayFrame {
  step: number;
  simTime: string;
  agents: Record<string, ReplayAgentDelta>;
}

export interface ReplayPersonaFinalState {
  state?: string;
  ctas?: number | null;
  icd?: string | null;
  bedAssignment?: string | null;
  injuriesZone?: string | null;
}

export interface ReplayPersona {
  id: string;
  role: PersonaRole;
  finalState?: ReplayPersonaFinalState;
}

export interface ReplayMetadata {
  simulationId: string;
  simStartIso: string;
  secPerStep: number;
  totalSteps: number;
  mazeName: string;
  widthInTiles: number;
  heightInTiles: number;
  builderVersion: string;
}

export interface ReplayFile {
  schemaVersion: 1;
  mapId: string;
  mapLayout: Object;
  metadata: ReplayMetadata;
  personas: ReplayPersona[];
  frames: ReplayFrame[];
  CtasStages: CtasStageData;
  /** Dashboard metrics over the enrolled cohort; absent on runs built without them. */
  Metrics?: ReplayMetrics;
}


// Graph data
export interface CtasHistogramBucket {
  /** Sequential string ranges showing boundaries for a duration window (e.g., "0.0–0.5") */
  bins: string[];
  /** Continuous numerical item frequency tallies mapping directly to each index in `bins` */
  counts: number[];
}

/**
 * Maps distinct CTAS categories (typically 'CTAS 1' through 'CTAS 5')
 * to their corresponding histogram datasets within an overarching medical triage tier.
 */
export interface TriageStageBreakdown {
  'CTAS 1'?: CtasHistogramBucket;
  'CTAS 2'?: CtasHistogramBucket;
  'CTAS 3'?: CtasHistogramBucket;
  'CTAS 4'?: CtasHistogramBucket;
  'CTAS 5'?: CtasHistogramBucket;
  /** Index signature to safely support any additional dynamic string-based CTAS groupings */
  [ctasKey: string]: CtasHistogramBucket | undefined;
}

/**
 * Core response data representation returned by the `/api/state_times/` endpoint.
 * Contains explicitly defined properties for each Emergency Department simulation phase.
 */
export interface CtasStageData {
  /** VisitPia: Distribution of Wait Time (Arrival to Physician Initial Assessment time) */
  waiting: TriageStageBreakdown;
  /** DispPia: Distribution of Time spent in Treatment (PIA to Disposition decision) */
  treatment: TriageStageBreakdown;
  /** PiaLeave: Distribution of Total Time in ED (PIA to physical discharge/leave) */
  ed: TriageStageBreakdown;
}

/**
 * Keeps track of maximum Y-axis peaks for scale normalization across different dashboard slides.
 */
export type YMaxMetrics = {
  [stage in keyof CtasStageData]?: number;
};

export interface AlertConfiguration {
  open: boolean;
  message: string;
}


// Dashboard metrics (replay `Metrics`, built by reverie/edview_replay/metrics.py).
// Keys of a `ByCtas` map are CTAS levels as strings ("1".."5").
export type ByCtas<T> = Record<string, T>;

export interface MetricsCohort {
  enrolled: number;
  /** Reached LEAVING and did not walk out: the engine's `completed_treatment`. */
  completed: number;
  /** Still in the department at the last frame. */
  censored: number;
  /** Left without being seen (walked out). */
  lwbs: number;
  /** Admitted, among the completed. */
  admitted: number;
}

export interface MetricsAxis {
  /** Sim clock of the first frame, "%B %d, %Y, %H:%M:%S". */
  t0: string;
  tEnd: string;
  bucketMinutes: number;
  /** Length of every array in `series`. */
  buckets: number;
  /** Length of every array in `hourly`. */
  hours: number;
}

export interface MetricsSeries {
  census: number[];
  censusByCtas: ByCtas<number[]>;
  byState: Record<string, number[]>;
  boarders: number[];
  /**
   * Emergency inpatients (EIP) per bucket: admitted patients still in the ED after the
   * disposition, through their walk out. Absent from replays built before the series existed.
   */
  eip?: number[];
  /** EDWIN crowding index per bucket; absent without bed occupancy or doctors. */
  edwin?: number[];
  /** Longest current wait (minutes) among the patients in each waiting state, per bucket. */
  oldestWaitByState?: Record<string, number[]>;
}

export interface MetricsDeparturesByDisposition {
  discharged: number[];
  admitted: number[];
  lwbs: number[];
}

export interface MetricsHourly {
  arrivalsByCtas: ByCtas<number[]>;
  departures: number[];
  /** The same departures split by what happened to the patient. */
  departuresByDisposition?: MetricsDeparturesByDisposition;
}

/** Minutes over the patients of one CTAS level who have the interval. */
export interface MetricsCell {
  n: number;
  median: number;
  p90: number;
  mean: number;
  /** Median of the sampled per-patient stage target, for the gated intervals. */
  targetMedian?: number;
}

export type StageWaitKey =
  | 'doorToTriage'
  | 'doorToBed'
  | 'doorToDoctor'
  | 'doctorToDisposition'
  | 'dispositionToDeparture'
  | 'lengthOfStay';

export type MetricsStageWaits = Record<StageWaitKey, ByCtas<MetricsCell>>;

export interface MetricsShare {
  n: number;
  /** Absent when n is 0. */
  share?: number;
}

export interface MetricsWithinTarget {
  n: number;
  within5: number;
  within10: number;
  /** Share within the CTAS time-to-physician objective; absent for CTAS 1 ("immediate"). */
  share?: number;
}

export interface MetricsCompliance {
  ctasTargetMinutes: ByCtas<number>;
  withinCtasTarget: ByCtas<MetricsWithinTarget>;
  /** Share triaged within ten minutes of arrival (the CTAS expectation). */
  triagedWithin10?: MetricsShare;
  dischargedWithin4h: MetricsShare;
  admittedWithin8h: MetricsShare;
}

export interface MetricsStaff {
  doctors: number;
  doctorMaxPatients: number;
  bedsideNurses: number;
  triageNurses: number;
  clerks: number;
  /** Per bedside nurse: WITH_PATIENT, TRANSFER_WITH_PATIENT, TESTING_WITH_PATIENT, IDLE, RESTING. */
  nurseMinutes: Record<string, Record<string, number>>;
  /** Patients each physician picked up over the run. */
  doctorPatientsSeen?: Record<string, number>;
  /** Per physician, pickups in each simulated hour of the axis (joined to the patients' selection stamps). */
  doctorPickupsByHour?: Record<string, number[]>;
}

/** A `MetricsCell` that may be empty: `median`, `p90` and `mean` are absent when `n` is 0. */
export interface MetricsMaybeCell {
  n: number;
  median?: number;
  p90?: number;
  mean?: number;
}

/** The two AHS headline emergency measures, on the AHS clock (triage, not arrival). */
export interface MetricsAhs {
  /** Triage to physician selection, every level pooled. */
  waitToSeeDoctor: MetricsMaybeCell;
  /** Triage to departure, completed admitted visits. */
  admittedTotalTime: MetricsMaybeCell;
}

export interface MetricsWalkouts {
  /** Per level: count (`n`) and the wait before leaving. */
  byCtas: ByCtas<MetricsCell>;
  /** Walkouts per state left from. */
  byState: Record<string, number>;
}

export interface MetricsZoneStarvation {
  n: number;
  /** Minutes with a space free but no nurse available. */
  nurseStarvedMinutes: number;
  /** Minutes with no space free. */
  bedStarvedMinutes: number;
}

export interface MetricsBoarding {
  n: number;
  boardedInBedShare?: number;
  transferWait?: MetricsCell;
}

export interface MetricsDiagnosticsCell {
  n: number;
  tested: number;
  share: number;
}

export interface MetricsDiagnostics {
  byCtas: ByCtas<MetricsDiagnosticsCell>;
  /** Going for the test plus waiting for the result, where the result came back. */
  turnaround: MetricsMaybeCell;
}

export interface MetricsChunk {
  index: number | null;
  bootStep: number | null;
  endStep: number | null;
  costUsd: number;
  wallSeconds: number | null;
  observedSteps: number;
  quietEligibleSteps: number;
  transportRetries: number;
}

export interface MetricsLatency {
  count: number;
  totalSeconds: number;
  maxSeconds: number;
  meanSeconds: number;
}

/** Recommendations document 1.7: whether the run can be trusted and what it cost. */
export interface MetricsRunHealth {
  costUsd: number;
  tokens: { prompt: number; completion: number };
  callsByChannel: Record<string, number>;
  fallbacks: Record<string, number>;
  transportRetries: number;
  latency: MetricsLatency;
  observedModels: Record<string, number>;
  chunks: MetricsChunk[];
  /** The step loop's own time (reverie/benchmark.json) when the run has it, else boot to save. */
  wallClockSeconds: number;
  /** Chunk boot-to-save spans summed; longer than the step loop when a finished run sat unsaved. */
  elapsedSeconds?: number;
  simulatedHours: number;
  /** Simulated hours per wall-clock hour; absent when no chunk recorded its wall time. */
  speedFactor?: number;
  quietFraction: number | null;
  seed: number | string | null;
  map: string | null;
  template: string | null;
  useLlm: boolean;
  benchmark?: { wallClockSeconds: number | null; totalSteps: number | null; llmCallCount: number | null };
  runValid?: boolean;
  invalidReasons?: string[];
  terminationReason?: string | null;
  finalStep?: number | null;
  chatModel?: string | null;
  dialogueMode?: string | null;
  scenarioFamily?: string | null;
  runPurpose?: string | null;
  analysisEligible?: boolean;
  channelFlags?: Record<string, boolean>;
}

export interface MetricsZoneBeds {
  hours: number[];
  capacity: number[];
  active: number[];
  blocked: number[];
  fastTrackAvailable: number[];
  available: number[];
  boarders: number[];
}

export interface MetricsOverTarget {
  n: number;
  mean?: number;
  p90?: number;
}

export interface ReplayMetrics {
  version: 1;
  cohort: MetricsCohort;
  axis: MetricsAxis;
  series: MetricsSeries;
  hourly: MetricsHourly;
  stageWaits: MetricsStageWaits;
  compliance: MetricsCompliance;
  staff: MetricsStaff;
  /** Mean minutes per stage-1 component per CTAS level, plus `n`. */
  stage1Components?: ByCtas<Record<string, number>>;
  elapsedOverTarget?: Record<string, MetricsOverTarget>;
  beds?: Record<string, MetricsZoneBeds>;
  // The derivable blocks (recommendations document 1.2 to 1.7). Optional because a
  // replay built before they existed lacks them; every tab degrades to "not in this
  // replay" rather than failing.
  ahs?: MetricsAhs;
  walkouts?: MetricsWalkouts;
  /** Keyed by the engine's care-space pool name (`major_bed`, `minor_bed`, ...). */
  starvationByZone?: Record<string, MetricsZoneStarvation>;
  /** Minutes in each state per CTAS level, from the engine's time-in-state ledger. */
  stateMinutes?: Record<string, ByCtas<MetricsCell>>;
  boarding?: MetricsBoarding;
  diagnostics?: MetricsDiagnostics;
  runHealth?: MetricsRunHealth;
}