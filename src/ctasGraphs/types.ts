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
export interface SimulationPayload {
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
  [stage in keyof SimulationPayload]?: number;
};

export interface AlertConfiguration {
  open: boolean;
  message: string;
}