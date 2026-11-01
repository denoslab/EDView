/**
 * Selectors for the metrics the recommendations document (sections 1.2 to 1.5) marks
 * "derivable": numbers the viewer works out from the replay's `Metrics` block rather
 * than reading directly. Pure functions, no chart.js, unit-tested under node.
 *
 * Every function tolerates a replay built before a block existed: the chart comes back
 * empty and the tab says so, instead of throwing.
 */
import type { MetricsCell, MetricsMaybeCell, ReplayMetrics } from './types';
import { ahs, ahsSeries, ahsTotal, ctasColors, withAlpha } from '../theme/ahs';
import {
  bedHourLabels,
  bucketLabels,
  ctasLevels,
  hourLabels,
  shortState,
  STAGE1_COMPONENT_LABELS,
  STAGE1_COMPONENT_ORDER,
  STATE_COLORS,
  PHASE_STATES,
  TOTAL_COLOR,
  WAITING_STATE_ORDER,
} from './metricsSelectors';
import type { ChartSeries, SeriesDataset } from './metricsSelectors';

// ─── Reference values ──────────────────────────────────────────────────────────────

/**
 * Published reference values in minutes. AHS 2024-25 Annual Report (16 largest sites,
 * 50th percentile) and the supplementary 90th percentile (2023-24); Calgary Zone is the
 * closest reference for the Rockyview template. Orientation only: a run is one
 * department over a few hours, the AHS figure is a year over sixteen sites.
 */
export const AHS_REFERENCE = {
  waitToSeeDoctor: { provincialMedian: 150, calgaryMedian: 156, provincialP90: 402 },
  admittedTotalTime: { provincialMedian: 804, calgaryMedian: 750, provincialP90: 2064 },
} as const;

/** CIHI 2023-24, teaching hospitals, minutes. */
export const CIHI_REFERENCE = {
  waitToSeeDoctor: { alberta: 168, canada: 102, bestProvince: 78 },
  admittedTotalTime: { alberta: 774, canada: 948, bestProvince: 732 },
} as const;

/** EDWIN bands from Bernstein et al. (2003). */
export const EDWIN_BUSY = 1.5;
export const EDWIN_OVERCROWDED = 2;

export type EdwinBand = 'Not busy' | 'Busy' | 'Overcrowded';

export function edwinBand(value: number): { label: EdwinBand; color: string } {
  if (value > EDWIN_OVERCROWDED) return { label: 'Overcrowded', color: ahs.red };
  if (value >= EDWIN_BUSY) return { label: 'Busy', color: ahs.darkYellow };
  return { label: 'Not busy', color: ahs.green };
}

/** Human names for the engine's care-space pools. */
export const ZONE_LABELS: Record<string, string> = {
  major_bed: 'Major beds',
  minor_bed: 'Minor beds',
  trauma_bay: 'Trauma bay',
  ft_station: 'Fast-track stations',
  vertical_space: 'Vertical care',
};

export function zoneLabel(zone: string): string {
  return ZONE_LABELS[zone] ?? zone.replace(/_/g, ' ');
}

/** Which resource owns the queue in each waiting state (1.4). */
export const QUEUE_OWNERS: Record<string, string> = {
  WAITING_FOR_TRIAGE: 'Triage nurse',
  WAITING_FOR_REGISTRATION: 'Clerk',
  WAITING_FOR_NURSE: 'Space or bedside nurse',
  WAITING_FOR_FIRST_ASSESSMENT: 'Physician',
  WAITING_FOR_TEST: 'Diagnostics',
  WAITING_FOR_RESULT: 'Diagnostics',
  WAITING_FOR_DOCTOR: 'Physician',
  WAITING_FOR_EXIT: 'Discharge',
  WAITING_FOR_BOARDING_BED: 'Inpatient bed',
};

/** Which resource each stage-1 component names when it dominates (1.4). */
export const COMPONENT_OWNERS: Record<string, string> = {
  triage_wait: 'Triage nurses',
  triage: 'Triage nurses (service)',
  registration_wait: 'Clerk',
  registration: 'Clerk (service)',
  resource_blocked: 'Spaces: beds or boarding',
  nurse_or_priority_wait: 'Bedside nurses',
  transport_walk: 'Escort (service)',
  target_hold: 'Scenario floor, not congestion',
  clinician_wait: 'Physicians',
};

// ─── Small helpers ─────────────────────────────────────────────────────────────────

/** Minutes the run spans, from the axis. */
export function runMinutes(metrics: ReplayMetrics): number {
  return Math.max(0, (metrics.axis.buckets - 1) * metrics.axis.bucketMinutes);
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function mean(values: number[]): number | undefined {
  return values.length ? sum(values) / values.length : undefined;
}

/** Pool per-CTAS cells into one weighted mean and total n. */
export function pooledMean(cells: Record<string, MetricsCell>): { n: number; mean?: number } {
  const list = Object.values(cells);
  const n = sum(list.map((c) => c.n));
  if (n === 0) return { n: 0 };
  return { n, mean: sum(list.map((c) => c.mean * c.n)) / n };
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** Parse the engine's "%B %d, %Y, %H:%M:%S" clock; undefined for anything else. */
export function parseSimTime(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const m = /^([A-Za-z]+) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return undefined;
  return new Date(Date.UTC(Number(m[3]), month, Number(m[2]), Number(m[4]), Number(m[5]), Number(m[6])));
}

/** The 5-minute bucket a replay clock falls in, clamped to the axis; 0 when unknown. */
export function bucketIndexFor(metrics: ReplayMetrics, simTime: string | undefined): number {
  const t0 = parseSimTime(metrics.axis.t0);
  const at = parseSimTime(simTime);
  if (!t0 || !at) return 0;
  const minutes = (at.getTime() - t0.getTime()) / 60000;
  const index = Math.floor(minutes / metrics.axis.bucketMinutes);
  return Math.min(metrics.axis.buckets - 1, Math.max(0, index));
}

// ─── 1.2 Waits ─────────────────────────────────────────────────────────────────────

export interface AhsMeasure {
  key: 'waitToSeeDoctor' | 'admittedTotalTime';
  title: string;
  cell: MetricsMaybeCell;
  reference: { provincialMedian: number; calgaryMedian: number; provincialP90: number };
}

/** The two AHS headline measures with their published references. */
export function ahsMeasures(metrics: ReplayMetrics): AhsMeasure[] {
  const ahsBlock = metrics.ahs;
  return [
    {
      key: 'waitToSeeDoctor',
      title: 'ED wait time to see a doctor',
      cell: ahsBlock?.waitToSeeDoctor ?? { n: 0 },
      reference: AHS_REFERENCE.waitToSeeDoctor,
    },
    {
      key: 'admittedTotalTime',
      title: 'Total time in ED, admitted patients',
      cell: ahsBlock?.admittedTotalTime ?? { n: 0 },
      reference: AHS_REFERENCE.admittedTotalTime,
    },
  ];
}

/**
 * Mean minutes in each of `states` per CTAS level (means, so stacked parts add up),
 * from the engine's time-in-state ledger. Levels are those present in any of the states.
 */
export function stateMinutesChart(
  metrics: ReplayMetrics,
  states: string[],
  stacked: boolean,
  colors: readonly string[] = ahsSeries,
): ChartSeries & { counts: number[] } {
  const block = metrics.stateMinutes ?? {};
  const levels = ctasLevels(
    Object.fromEntries(states.flatMap((s) => Object.keys(block[s] ?? {}).map((l) => [l, true]))),
  );
  const datasets: SeriesDataset[] = states
    .filter((state) => block[state])
    .map((state, i) => ({
      label: shortState(state),
      data: levels.map((level) => block[state]?.[level]?.mean ?? 0),
      color: colors[i % colors.length],
      ...(stacked ? { stack: 'states' } : {}),
    }));
  const counts = levels.map((level) => Math.max(0, ...states.map((s) => block[s]?.[level]?.n ?? 0)));
  return { labels: levels.map((l) => `CTAS ${l}`), datasets, counts };
}

/** Arrival to triage: median and 90th percentile per level against the 10-minute expectation. */
export function arrivalToTriageChart(metrics: ReplayMetrics): ChartSeries {
  const cells = metrics.stageWaits.doorToTriage;
  const levels = ctasLevels(cells);
  return {
    labels: levels.map((l) => `CTAS ${l}`),
    datasets: [
      { label: 'Median', data: levels.map((l) => cells[l].median), color: ahs.blue },
      { label: '90th percentile', data: levels.map((l) => cells[l].p90), color: ahs.orange },
      { label: 'CTAS expectation (10 min)', data: levels.map(() => 10), color: TOTAL_COLOR, dashed: true },
    ],
  };
}

// ─── 1.3 Outcomes ──────────────────────────────────────────────────────────────────

export interface DispositionMix {
  completed: number;
  discharged: number;
  admitted: number;
  lwbs: number;
  censored: number;
  departed: number;
}

export function dispositionMix(metrics: ReplayMetrics): DispositionMix {
  const { completed, admitted, lwbs, censored } = metrics.cohort;
  return { completed, discharged: completed - admitted, admitted, lwbs, censored, departed: completed + lwbs };
}

/** Left without being seen per CTAS level: the count as bars. */
export function lwbsChart(metrics: ReplayMetrics): ChartSeries {
  const cells = metrics.walkouts?.byCtas ?? {};
  const levels = ctasLevels(cells);
  return {
    labels: levels.map((l) => `CTAS ${l}`),
    datasets: [
      { label: 'Left without being seen', data: levels.map((l) => cells[l].n), color: ahs.red },
    ],
  };
}

/** Walkouts per state left from, most first. */
export function lwbsStates(metrics: ReplayMetrics): { state: string; label: string; n: number }[] {
  const byState = metrics.walkouts?.byState ?? {};
  return Object.entries(byState)
    .map(([state, n]) => ({ state, label: shortState(state), n }))
    .sort((a, b) => b.n - a.n);
}

/** Share of patients with a test ordered, per CTAS level. */
export function diagnosticsChart(metrics: ReplayMetrics): ChartSeries & { counts: number[] } {
  const cells = metrics.diagnostics?.byCtas ?? {};
  const levels = ctasLevels(cells);
  return {
    labels: levels.map((l) => `CTAS ${l}`),
    datasets: [{ label: 'Share with a test ordered', data: levels.map((l) => cells[l].share), color: ahs.blue }],
    counts: levels.map((l) => cells[l].n),
  };
}


/** Patients waiting for a test, going for one or waiting for the result, stacked over time. */
export function diagnosticQueueChart(metrics: ReplayMetrics): ChartSeries {
  const byState = metrics.series.byState;
  const datasets: SeriesDataset[] = ['WAITING_FOR_TEST', 'GOING_FOR_TEST', 'WAITING_FOR_RESULT']
    .filter((s) => byState[s]?.some((v) => v > 0))
    .map((s) => ({ label: shortState(s), data: byState[s], color: STATE_COLORS[s] ?? ahs.dustyGray, stack: 'diagnostics' }));
  return { labels: bucketLabels(metrics), datasets };
}

/** Boarders over time (1.3). */
export function throughputBalanceChart(metrics: ReplayMetrics): ChartSeries {
  const arrivals = Object.values(metrics.hourly.arrivalsByCtas).reduce<number[]>(
    (acc, series) => series.map((v, i) => (acc[i] ?? 0) + v),
    [],
  );
  const ratio = metrics.hourly.departures.map((d, i) => (arrivals[i] > 0 ? d / arrivals[i] : NaN));
  return {
    labels: hourLabels(metrics),
    datasets: [
      { label: 'Departures ÷ arrivals', data: ratio, color: ahs.blue, emphasis: true },
      { label: 'Balance (1.0)', data: ratio.map(() => 1), color: TOTAL_COLOR, dashed: true },
    ],
  };
}

export interface SurgeRecovery {
  /** The busiest arrival hour (0-based). */
  peakHour: number;
  peakArrivals: number;
  baselineCensus?: number;
  baselineWaiting?: number;
  /** Bucket index where the surge hour ends. */
  surgeEndBucket: number;
  recoveryBucket?: number;
  recoveryMinutes?: number;
  reason?: string;
}

/** Total patients in any waiting state per bucket. */
export function totalWaiting(metrics: ReplayMetrics): number[] {
  const waiting = WAITING_STATE_ORDER.map((s) => metrics.series.byState[s]).filter(Boolean);
  return metrics.series.census.map((_, i) => sum(waiting.map((series) => series[i] ?? 0)));
}

function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Minutes from the end of the busiest arrival hour until census and waiting count are
 * both back within 10% of the baseline, the medians over the hour before the surge.
 */
export function surgeRecovery(metrics: ReplayMetrics): SurgeRecovery {
  const arrivals = Object.values(metrics.hourly.arrivalsByCtas).reduce<number[]>(
    (acc, series) => series.map((v, i) => (acc[i] ?? 0) + v),
    [],
  );
  let peakHour = 0;
  for (let h = 1; h < arrivals.length; h++) if (arrivals[h] > arrivals[peakHour]) peakHour = h;
  const perHour = 60 / metrics.axis.bucketMinutes;
  const surgeEndBucket = Math.min(metrics.axis.buckets - 1, (peakHour + 1) * perHour);
  const result: SurgeRecovery = { peakHour, peakArrivals: arrivals[peakHour] ?? 0, surgeEndBucket };
  if (peakHour === 0) {
    result.reason = 'The run starts in its busiest hour, so there is no pre-surge baseline.';
    return result;
  }
  const waiting = totalWaiting(metrics);
  const before = (series: number[]) => series.slice((peakHour - 1) * perHour, peakHour * perHour);
  result.baselineCensus = median(before(metrics.series.census));
  result.baselineWaiting = median(before(waiting));
  for (let i = surgeEndBucket; i < metrics.axis.buckets; i++) {
    if (
      metrics.series.census[i] <= 1.1 * (result.baselineCensus ?? 0) &&
      waiting[i] <= 1.1 * (result.baselineWaiting ?? 0)
    ) {
      result.recoveryBucket = i;
      result.recoveryMinutes = (i - surgeEndBucket) * metrics.axis.bucketMinutes;
      return result;
    }
  }
  result.reason = 'Census and waiting count never returned to the pre-surge baseline inside the run.';
  return result;
}

// ─── 1.4 Bottlenecks ───────────────────────────────────────────────────────────────

export interface QueueRow {
  state: string;
  label: string;
  owner: string;
  depth: number;
  /** Longest current wait in minutes; absent on a replay without the series. */
  oldest?: number;
}

/** Queue depth and the oldest wait at one bucket, deepest first (1.4). */
export function queueSnapshot(metrics: ReplayMetrics, bucket: number): QueueRow[] {
  const rows: QueueRow[] = [];
  for (const state of WAITING_STATE_ORDER) {
    const depth = metrics.series.byState[state]?.[bucket] ?? 0;
    const oldest = metrics.series.oldestWaitByState?.[state]?.[bucket];
    if (depth === 0 && !metrics.series.byState[state]?.some((v) => v > 0)) continue;
    rows.push({ state, label: shortState(state), owner: QUEUE_OWNERS[state] ?? '', depth, oldest });
  }
  return rows.sort((a, b) => b.depth - a.depth || (b.oldest ?? 0) - (a.oldest ?? 0));
}

/** Queue depth over the run as a bar per station at `bucket`, in flow order. */
export function queueDepthChart(metrics: ReplayMetrics, bucket: number): ChartSeries {
  const rows = queueSnapshot(metrics, bucket);
  return {
    labels: rows.map((r) => r.label),
    datasets: [
      { label: 'Patients waiting', data: rows.map((r) => r.depth), color: ahs.orange },
    ],
  };
}

export function oldestWaitChart(metrics: ReplayMetrics, bucket: number): ChartSeries {
  const rows = queueSnapshot(metrics, bucket);
  return {
    labels: rows.map((r) => r.label),
    datasets: [{ label: 'Oldest wait (minutes)', data: rows.map((r) => r.oldest ?? 0), color: ahs.orange }],
  };
}

export interface ComponentRank {
  component: string;
  label: string;
  owner: string;
  totalMinutes: number;
  share: number;
}

/** The nine stage-1 components ranked by total minutes across the cohort (1.4). */
export function componentRanking(metrics: ReplayMetrics): ComponentRank[] {
  const byCtas = metrics.stage1Components ?? {};
  const totals = STAGE1_COMPONENT_ORDER.map((component) => ({
    component,
    label: STAGE1_COMPONENT_LABELS[component] ?? component,
    owner: COMPONENT_OWNERS[component] ?? '',
    totalMinutes: sum(Object.values(byCtas).map((cell) => (cell[component] ?? 0) * (cell.n ?? 0))),
    share: 0,
  }));
  const all = sum(totals.map((t) => t.totalMinutes));
  for (const t of totals) t.share = all > 0 ? t.totalMinutes / all : 0;
  return totals.sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export function componentRankingChart(metrics: ReplayMetrics): ChartSeries {
  const ranked = componentRanking(metrics);
  return {
    labels: ranked.map((r) => r.label),
    datasets: [{ label: 'Total minutes across the cohort', data: ranked.map((r) => Math.round(r.totalMinutes)), color: ahs.darkBlue }],
  };
}

export interface SampledTargets {
  stage1?: number;
  stage2?: number;
  stage3?: number;
}

/**
 * The sampled stage targets behind "time over target": the median per-patient target of
 * each gated interval, pooled across CTAS levels by n. These are the historical floors
 * the scenario drew for each arrival, not standards.
 */
export function sampledTargetMedians(metrics: ReplayMetrics): SampledTargets {
  const pooled = (cells: Record<string, MetricsCell>): number | undefined => {
    const withTarget = Object.values(cells).filter((c) => c.targetMedian !== undefined);
    const n = sum(withTarget.map((c) => c.n));
    return n > 0 ? sum(withTarget.map((c) => (c.targetMedian ?? 0) * c.n)) / n : undefined;
  };
  return {
    stage1: pooled(metrics.stageWaits.doorToDoctor),
    stage2: pooled(metrics.stageWaits.doctorToDisposition),
    stage3: pooled(metrics.stageWaits.dispositionToDeparture),
  };
}

export const STAGE_LABELS: Record<string, string> = {
  stage1: 'Stage 1: arrival to physician',
  stage2: 'Stage 2: physician to disposition',
  stage3: 'Stage 3: disposition to departure',
};

/** Observed minus sampled target per stage, mean and 90th percentile (1.4). */
export function overTargetChart(metrics: ReplayMetrics): ChartSeries & { counts: number[] } {
  const over = metrics.elapsedOverTarget ?? {};
  const stages = Object.keys(over).sort();
  return {
    labels: stages.map((s) => STAGE_LABELS[s] ?? s),
    datasets: [
      { label: 'Mean', data: stages.map((s) => over[s].mean ?? 0), color: ahs.blue },
      { label: '90th percentile', data: stages.map((s) => over[s].p90 ?? 0), color: ahs.orange },
    ],
    counts: stages.map((s) => over[s].n),
  };
}

/** EDWIN over the run as one line; the panel shades the Bernstein bands behind it (`edwinBands`). */
export function edwinChart(metrics: ReplayMetrics): ChartSeries {
  const edwin = metrics.series.edwin;
  if (!edwin) return { labels: bucketLabels(metrics), datasets: [] };
  return {
    labels: bucketLabels(metrics),
    datasets: [{ label: 'EDWIN', data: edwin, color: ahs.blue, emphasis: true }],
  };
}

/** The busy and overcrowded regions, shaded behind the EDWIN line; the top band reaches the chart's ceiling. */
export function edwinBands(metrics: ReplayMetrics): { label: string; from: number; to: number; color: string }[] {
  const peak = Math.max(EDWIN_OVERCROWDED + 0.5, ...(metrics.series.edwin ?? []));
  return [
    { label: `Busy (${EDWIN_BUSY} to ${EDWIN_OVERCROWDED})`, from: EDWIN_BUSY, to: EDWIN_OVERCROWDED, color: withAlpha(ahs.darkYellow, 0.22) },
    { label: `Overcrowded (above ${EDWIN_OVERCROWDED})`, from: EDWIN_OVERCROWDED, to: peak * 1.05, color: withAlpha(ahs.red, 0.16) },
  ];
}

/** Treatment spaces not blocked, per bucket, from the latest snapshot at or before it. */
/**
 * Capacity per zone as usable against closed (blocked) spaces, from the last bed snapshot
 * (1.4). Closed beds rarely change within a run, so this is one bar per zone rather than a
 * flat time series; `varies` says whether any snapshot differed, for the panel's note.
 */
export function usableCapacityChart(metrics: ReplayMetrics): ChartSeries & { varies: boolean } {
  const beds = metrics.beds ?? {};
  const zones = Object.keys(beds).sort();
  const last = (xs: number[]) => xs[xs.length - 1] ?? 0;
  const varies = zones.some((z) => new Set(beds[z].blocked).size > 1 || new Set(beds[z].capacity).size > 1);
  return {
    labels: zones,
    datasets: [
      { label: 'Usable spaces', data: zones.map((z) => last(beds[z].capacity) - last(beds[z].blocked)), color: ahs.blue, stack: 'capacity' },
      { label: 'Closed (blocked)', data: zones.map((z) => last(beds[z].blocked)), color: ahs.darkGray, stack: 'capacity' },
    ],
    varies,
  };
}

export interface ResourceUtilization {
  triage?: number;
  clerk?: number;
  bedsideNurse?: number;
  /** Mean stage-2 census over the run divided by physicians times their limit. */
  physician?: number;
}

/** Stage-2 states: a patient is assigned to a physician from selection to disposition. */
const STAGE2_STATES = ['WAITING_FOR_TEST', 'GOING_FOR_TEST', 'WAITING_FOR_RESULT', 'WAITING_FOR_DOCTOR'];

/** Patients concurrently assigned per physician, per bucket. */
export function physicianLoadSeries(metrics: ReplayMetrics): number[] {
  const doctors = Math.max(1, metrics.staff.doctors);
  return metrics.series.census.map((_, i) =>
    sum(STAGE2_STATES.map((s) => metrics.series.byState[s]?.[i] ?? 0)) / doctors,
  );
}

export function physicianLoadChart(metrics: ReplayMetrics): ChartSeries {
  const load = physicianLoadSeries(metrics);
  return {
    labels: bucketLabels(metrics),
    datasets: [
      { label: 'Patients assigned per physician', data: load, color: ahs.blue, emphasis: true },
      { label: `Per-physician limit (${metrics.staff.doctorMaxPatients})`, data: load.map(() => metrics.staff.doctorMaxPatients), color: TOTAL_COLOR, dashed: true },
    ],
  };
}

/** One line per physician: patients picked up in each hour of the day (1.5). Drawn with a solo legend. */
export function physicianPickupsByHourChart(metrics: ReplayMetrics): ChartSeries {
  const byHour = metrics.staff.doctorPickupsByHour ?? {};
  const names = Object.keys(byHour).sort((a, b) => sum(byHour[b]) - sum(byHour[a]) || a.localeCompare(b));
  return {
    labels: hourLabels(metrics),
    datasets: names.map((name, i) => ({
      label: name,
      data: byHour[name],
      color: ahsSeries[i % ahsSeries.length],
      // The palette has five colours; a sixth physician onwards is dashed so ten stay apart.
      dashed: i >= ahsSeries.length,
    })),
  };
}

/** States in which a patient occupies a treatment space, from the selectors' phase table. */
const IN_SPACE_STATES = PHASE_STATES['In a treatment space'];
/** A common emergency-department staffing guide, drawn as the reference line. */
export const NURSE_RATIO_GUIDE = 4;

/**
 * Patients in treatment spaces per bedside nurse at each bucket (Overview, 1.5). The replay
 * has no per-step nurse state, so this is the load the nurses carried rather than a measured
 * utilization curve; the day's measured totals are in the nurse ledgers.
 */
export function nurseLoadChart(metrics: ReplayMetrics): ChartSeries {
  const nurses = Math.max(1, metrics.staff.bedsideNurses);
  const load = metrics.series.census.map((_, i) => sum(IN_SPACE_STATES.map((s) => metrics.series.byState[s]?.[i] ?? 0)) / nurses);
  return {
    labels: bucketLabels(metrics),
    datasets: [
      { label: 'Patients in treatment spaces per bedside nurse', data: load, color: ahs.green, emphasis: true },
      { label: `${NURSE_RATIO_GUIDE} patients per nurse (guide)`, data: load.map(() => NURSE_RATIO_GUIDE), color: TOTAL_COLOR, dashed: true },
    ],
  };
}

/** The average bedside nurse's day: mean minutes per state across the nurses, one stacked bar (1.5). */
export function nurseAverageChart(metrics: ReplayMetrics): ChartSeries {
  const ledgers = Object.values(metrics.staff.nurseMinutes ?? {});
  const n = ledgers.length;
  return {
    labels: ['Average bedside nurse'],
    datasets: NURSE_STATE_ORDER.map((state) => ({
      label: NURSE_STATE_LABELS[state],
      data: [n ? sum(ledgers.map((l) => l[state] ?? 0)) / n : 0],
      color: NURSE_STATE_COLORS[state],
      stack: 'nurse',
    })),
  };
}

export interface PhysicianPickup {
  name: string;
  count: number;
  share: number;
  perHour: number;
}

/** Each physician's pickups, largest first, with its share of all pickups and its rate per simulated hour (1.5). */
export function physicianPickupRows(metrics: ReplayMetrics): PhysicianPickup[] {
  const seen = metrics.staff.doctorPatientsSeen ?? {};
  const total = sum(Object.values(seen));
  const hours = Math.max(1 / 12, runMinutes(metrics) / 60);
  return Object.entries(seen)
    .map(([name, count]) => ({ name, count, share: total > 0 ? count / total : 0, perHour: count / hours }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function physicianSeenChart(metrics: ReplayMetrics): ChartSeries {
  const rows = physicianPickupRows(metrics);
  return { labels: rows.map((r) => r.name), datasets: [{ label: 'Patients picked up', data: rows.map((r) => r.count), color: ahs.blue }] };
}

/** Minutes in one state summed over the cohort (mean × n per level). */
function stateTotalMinutes(metrics: ReplayMetrics, state: string): number | undefined {
  const cells = metrics.stateMinutes?.[state];
  if (!cells) return undefined;
  return sum(Object.values(cells).map((c) => c.mean * c.n));
}

export interface RoleLoad {
  minutes?: number;
  staff: number;
  utilization?: number;
}

/** Triage and clerk utilization: service minutes over staff × run minutes (1.5). */
export function triageClerkLoad(metrics: ReplayMetrics): { triage: RoleLoad; clerk: RoleLoad } {
  const total = runMinutes(metrics);
  const load = (state: string, staff: number): RoleLoad => {
    const minutes = stateTotalMinutes(metrics, state);
    const utilization = minutes !== undefined && staff > 0 && total > 0 ? minutes / (staff * total) : undefined;
    return { minutes, staff, utilization };
  };
  return { triage: load('TRIAGE', metrics.staff.triageNurses), clerk: load('REGISTRATION', metrics.staff.clerks) };
}

export const NURSE_STATE_ORDER = ['WITH_PATIENT', 'TRANSFER_WITH_PATIENT', 'TESTING_WITH_PATIENT', 'IDLE', 'RESTING'];
export const NURSE_STATE_LABELS: Record<string, string> = {
  WITH_PATIENT: 'With a patient',
  TRANSFER_WITH_PATIENT: 'Transferring a patient',
  TESTING_WITH_PATIENT: 'Testing with a patient',
  IDLE: 'Idle',
  RESTING: 'Resting',
};
/** Patient-facing states in the main colours, the two idle states in greys. */
const NURSE_STATE_COLORS: Record<string, string> = {
  WITH_PATIENT: ahs.blue,
  TRANSFER_WITH_PATIENT: ahs.darkBlue,
  TESTING_WITH_PATIENT: ahs.green,
  IDLE: ahs.dustyGray,
  RESTING: ahs.darkGray,
};
const PATIENT_FACING = new Set(['WITH_PATIENT', 'TRANSFER_WITH_PATIENT', 'TESTING_WITH_PATIENT']);

export interface NurseUtilization {
  chart: ChartSeries;
  perNurse: { name: string; utilization?: number }[];
  team?: number;
}

/** Minutes per state per bedside nurse, and the share of them patient-facing (1.5). */
export function nurseUtilization(metrics: ReplayMetrics): NurseUtilization {
  const ledgers = metrics.staff.nurseMinutes ?? {};
  const names = Object.keys(ledgers).sort();
  const chart: ChartSeries = {
    labels: names,
    datasets: NURSE_STATE_ORDER.map((state) => ({
      label: NURSE_STATE_LABELS[state],
      data: names.map((n) => ledgers[n][state] ?? 0),
      color: NURSE_STATE_COLORS[state],
      stack: 'nurse',
    })),
  };
  let facing = 0;
  let all = 0;
  const perNurse = names.map((name) => {
    const minutes = ledgers[name];
    const total = sum(NURSE_STATE_ORDER.map((s) => minutes[s] ?? 0));
    const own = sum(NURSE_STATE_ORDER.filter((s) => PATIENT_FACING.has(s)).map((s) => minutes[s] ?? 0));
    facing += own;
    all += total;
    return { name, utilization: total > 0 ? own / total : undefined };
  });
  return { chart, perNurse, team: all > 0 ? facing / all : undefined };
}

export function resourceUtilization(metrics: ReplayMetrics): ResourceUtilization {
  const { triage, clerk } = triageClerkLoad(metrics);
  const load = physicianLoadSeries(metrics);
  const limit = metrics.staff.doctorMaxPatients;
  return {
    triage: triage.utilization,
    clerk: clerk.utilization,
    bedsideNurse: nurseUtilization(metrics).team,
    physician: limit > 0 ? (mean(load) ?? 0) / limit : undefined,
  };
}

export interface BottleneckScore extends QueueRow {
  score: number;
  reason: string;
}

/**
 * Composite per station: queue depth, oldest wait and the owning resource's utilization,
 * each scaled 0 to 1 against the other stations and averaged over the parts available.
 * This build scales the oldest wait against the longest oldest wait on the board, not the
 * CTAS objective of the oldest patient, which the replay does not carry.
 */
export function bottleneckScores(metrics: ReplayMetrics, bucket: number): BottleneckScore[] {
  const rows = queueSnapshot(metrics, bucket);
  const util = resourceUtilization(metrics);
  const maxDepth = Math.max(0, ...rows.map((r) => r.depth));
  const maxOldest = Math.max(0, ...rows.map((r) => r.oldest ?? 0));
  const ownerUtil = (owner: string): number | undefined => {
    if (owner.startsWith('Triage')) return util.triage;
    if (owner.startsWith('Clerk')) return util.clerk;
    if (owner.startsWith('Space')) return util.bedsideNurse;
    if (owner.startsWith('Physician')) return util.physician;
    return undefined;
  };
  return rows
    .map((row) => {
      const parts: { name: string; value: number }[] = [];
      if (maxDepth > 0) parts.push({ name: 'queue depth', value: row.depth / maxDepth });
      if (row.oldest !== undefined && maxOldest > 0) parts.push({ name: 'oldest wait', value: row.oldest / maxOldest });
      const u = ownerUtil(row.owner);
      if (u !== undefined) parts.push({ name: `${row.owner.toLowerCase()} utilization`, value: Math.min(1, u) });
      const score = mean(parts.map((p) => p.value)) ?? 0;
      const top = parts.slice().sort((a, b) => b.value - a.value)[0];
      return { ...row, score, reason: top ? `${top.name} dominates` : 'no signal' };
    })
    .sort((a, b) => b.score - a.score);
}

// ─── 1.5 Staffing ──────────────────────────────────────────────────────────────────

export interface StarvationRow {
  zone: string;
  label: string;
  n: number;
  nurseStarvedMinutes: number;
  bedStarvedMinutes: number;
  /** Which of the two is larger: the resource the zone needs. */
  needs: 'a nurse' | 'a space' | 'neither';
}

/** Nurse-starved against bed-starved minutes per zone, ranked by the larger (1.5). */
export function starvationRows(metrics: ReplayMetrics): StarvationRow[] {
  const block = metrics.starvationByZone ?? {};
  return Object.entries(block)
    .map(([zone, cell]) => ({
      zone,
      label: zoneLabel(zone),
      n: cell.n,
      nurseStarvedMinutes: cell.nurseStarvedMinutes,
      bedStarvedMinutes: cell.bedStarvedMinutes,
      needs: (cell.nurseStarvedMinutes === 0 && cell.bedStarvedMinutes === 0
        ? 'neither'
        : cell.nurseStarvedMinutes > cell.bedStarvedMinutes
          ? 'a nurse'
          : 'a space') as StarvationRow['needs'],
    }))
    .sort((a, b) => Math.max(b.nurseStarvedMinutes, b.bedStarvedMinutes) - Math.max(a.nurseStarvedMinutes, a.bedStarvedMinutes));
}

/**
 * One sentence for the pressure tile: what the zone needs, and how its starved time splits
 * between no space free and no nurse, in hours and shares rather than raw minutes.
 */
export function pressureSummary(row: StarvationRow | undefined): string {
  if (!row || row.needs === 'neither') return 'No starvation recorded';
  const total = row.nurseStarvedMinutes + row.bedStarvedMinutes;
  const bedShare = total > 0 ? row.bedStarvedMinutes / total : 0;
  const hours = (total / 60).toFixed(0);
  return `needs ${row.needs}: of ${hours} h waiting for a space, ${Math.round(bedShare * 100)}% had no space free and ${Math.round((1 - bedShare) * 100)}% had a space but no nurse`;
}

/**
 * Diverging bars per zone: nurse-starved hours to the left of zero (as negatives, in the
 * nurse colour), bed-starved hours to the right, so the longer side says what the zone
 * needs. Drawn with `BarChart diverging horizontal`.
 */
export function starvationChart(metrics: ReplayMetrics): ChartSeries {
  const rows = starvationRows(metrics);
  return {
    labels: rows.map((r) => r.label),
    datasets: [
      { label: 'Space free, no nurse (hours)', data: rows.map((r) => -r.nurseStarvedMinutes / 60), color: ahs.green, stack: 'starved' },
      { label: 'No space free (hours)', data: rows.map((r) => r.bedStarvedMinutes / 60), color: ahs.orange, stack: 'starved' },
    ],
  };
}

/** The zone colours by sorted zone name, the same assignment the census-by-zone chart uses. */
function zoneColorFor(zones: string[], zone: string): string {
  return ahsSeries[zones.indexOf(zone) % ahsSeries.length];
}

/**
 * Occupancy of every zone as a share of its usable spaces (capacity minus closed beds), one
 * line per zone across the hourly snapshots, with "full" as a dashed line (1.5). A zone that
 * sits on the line all day is full all day, which is the finding; the chart shows which
 * zones that is, and when the others fill.
 */
export function zoneOccupancyShareChart(metrics: ReplayMetrics): ChartSeries {
  const beds = metrics.beds ?? {};
  const zones = Object.keys(beds).sort();
  const labels = bedHourLabels(metrics);
  if (!zones.length) return { labels, datasets: [] };
  const datasets: SeriesDataset[] = zones.map((zone) => {
    const z = beds[zone];
    return {
      label: zone,
      data: z.active.map((active, i) => {
        const usable = (z.capacity[i] ?? 0) - (z.blocked[i] ?? 0);
        return usable > 0 ? Math.min(1, active / usable) : 0;
      }),
      color: zoneColorFor(zones, zone),
      emphasis: true,
    };
  });
  datasets.push({ label: 'Full', data: labels.map(() => 1), color: ahsTotal, dashed: true });
  return { labels, datasets };
}

/** Triage queue depth and triage service over time (1.5 triage nurse load). */
export function triageLoadChart(metrics: ReplayMetrics): ChartSeries {
  const byState = metrics.series.byState;
  return {
    labels: bucketLabels(metrics),
    datasets: [
      { label: 'Waiting for triage', data: byState.WAITING_FOR_TRIAGE ?? [], color: STATE_COLORS.WAITING_FOR_TRIAGE, stack: 'triage' },
      { label: 'In triage', data: byState.TRIAGE ?? [], color: ahs.green, stack: 'triage' },
    ],
  };
}

export function clerkLoadChart(metrics: ReplayMetrics): ChartSeries {
  const byState = metrics.series.byState;
  return {
    labels: bucketLabels(metrics),
    datasets: [
      { label: 'Waiting for the clerk', data: byState.WAITING_FOR_REGISTRATION ?? [], color: STATE_COLORS.WAITING_FOR_REGISTRATION, stack: 'clerk' },
      { label: 'In registration', data: byState.REGISTRATION ?? [], color: ahs.green, stack: 'clerk' },
    ],
  };
}

/** Patients seen within the CTAS objective per level, as a share (1.3). */
export function withinTargetChart(metrics: ReplayMetrics): ChartSeries & { counts: number[] } {
  const cells = metrics.compliance.withinCtasTarget;
  const levels = ctasLevels(cells);
  return {
    labels: levels.map((l) => (l === '1' ? 'CTAS 1 (within 10 min)' : `CTAS ${l}`)),
    datasets: [
      {
        label: 'Share seen within the objective',
        data: levels.map((l) => (l === '1' ? cells[l].within10 : cells[l].share ?? 0)),
        color: ahs.green,
      },
    ],
    counts: levels.map((l) => cells[l].n),
  };
}

/** Colour for a CTAS level label, for tables that colour a swatch. */
export function ctasSwatch(level: string): string {
  return ctasColors[level as keyof typeof ctasColors] ?? ahs.dustyGray;
}

// ─── Day averages for the bottleneck tab ──────────────────────────────────────────────

export interface QueueAverage {
  state: string;
  label: string;
  owner: string;
  /** Mean patients waiting over every bucket of the day. */
  meanDepth: number;
  peakDepth: number;
  /** Mean of the longest current wait, over the buckets in which somebody was waiting. */
  meanOldest?: number;
  peakOldest?: number;
}

/** Each waiting station averaged over the day, deepest first (1.4). */
export function queueAverages(metrics: ReplayMetrics): QueueAverage[] {
  const rows: QueueAverage[] = [];
  for (const state of WAITING_STATE_ORDER) {
    const depth = metrics.series.byState[state];
    if (!depth || !depth.some((v) => v > 0)) continue;
    const oldest = metrics.series.oldestWaitByState?.[state];
    const busy = oldest ? oldest.filter((_, i) => (depth[i] ?? 0) > 0) : [];
    rows.push({
      state,
      label: shortState(state),
      owner: QUEUE_OWNERS[state] ?? '',
      meanDepth: sum(depth) / depth.length,
      peakDepth: Math.max(...depth),
      meanOldest: busy.length ? sum(busy) / busy.length : undefined,
      peakOldest: oldest ? Math.max(...oldest) : undefined,
    });
  }
  return rows.sort((a, b) => b.meanDepth - a.meanDepth);
}

export function queueDepthAverageChart(metrics: ReplayMetrics): ChartSeries {
  const rows = queueAverages(metrics);
  return {
    labels: rows.map((r) => r.label),
    datasets: [{ label: 'Patients waiting, average over the day', data: rows.map((r) => Number(r.meanDepth.toFixed(1))), color: ahs.orange }],
  };
}

export function oldestWaitAverageChart(metrics: ReplayMetrics): ChartSeries {
  const rows = queueAverages(metrics)
    .filter((r) => r.meanOldest !== undefined)
    .sort((a, b) => (b.meanOldest ?? 0) - (a.meanOldest ?? 0));
  return {
    labels: rows.map((r) => r.label),
    datasets: [{ label: 'Longest wait in the queue, average over the day (minutes)', data: rows.map((r) => Math.round(r.meanOldest ?? 0)), color: ahs.orange }],
  };
}

export interface DayBottleneck extends QueueAverage {
  score: number;
  reason: string;
}

/**
 * The bottleneck score computed on the day's averages rather than at one moment: mean depth
 * and mean longest wait, each scaled against the other stations, and the owning resource's
 * utilization, averaged over the parts available (1.4).
 */
export function bottleneckScoresOverDay(metrics: ReplayMetrics): DayBottleneck[] {
  const rows = queueAverages(metrics);
  const util = resourceUtilization(metrics);
  const maxDepth = Math.max(0, ...rows.map((r) => r.meanDepth));
  const maxOldest = Math.max(0, ...rows.map((r) => r.meanOldest ?? 0));
  const ownerUtil = (owner: string): number | undefined => {
    if (owner.startsWith('Triage')) return util.triage;
    if (owner.startsWith('Clerk')) return util.clerk;
    if (owner.startsWith('Space')) return util.bedsideNurse;
    if (owner.startsWith('Physician')) return util.physician;
    return undefined;
  };
  return rows
    .map((row) => {
      const parts: { name: string; value: number }[] = [];
      if (maxDepth > 0) parts.push({ name: 'patients waiting', value: row.meanDepth / maxDepth });
      if (row.meanOldest !== undefined && maxOldest > 0) parts.push({ name: 'length of the wait', value: row.meanOldest / maxOldest });
      const u = ownerUtil(row.owner);
      if (u !== undefined) parts.push({ name: `how busy the ${row.owner.toLowerCase()} is`, value: Math.min(1, u) });
      const score = mean(parts.map((p) => p.value)) ?? 0;
      const top = parts.slice().sort((a, b) => b.value - a.value)[0];
      return { ...row, score, reason: top ? `driven by ${top.name}` : 'no signal' };
    })
    .sort((a, b) => b.score - a.score);
}

export function bottleneckScoreChart(metrics: ReplayMetrics): ChartSeries {
  const rows = bottleneckScoresOverDay(metrics);
  return {
    labels: rows.map((r) => r.label),
    datasets: [{ label: 'Bottleneck score (0 to 1)', data: rows.map((r) => Number(r.score.toFixed(2))), color: ahs.darkBlue }],
  };
}

// ─── Zone needs with the reason ───────────────────────────────────────────────────────

export interface ZoneNeed extends StarvationRow {
  totalHours: number;
  /** Share of the zone's starved time that had no space free. */
  spaceShare: number;
  hoursPerPatient: number;
  why: string;
}

/** Each zone's need with the reasoning spelled out, most starved first (1.5). */
export function zoneNeeds(metrics: ReplayMetrics): ZoneNeed[] {
  return starvationRows(metrics).map((row) => {
    const total = row.nurseStarvedMinutes + row.bedStarvedMinutes;
    const spaceShare = total > 0 ? row.bedStarvedMinutes / total : 0;
    const hours = total / 60;
    const hoursText = `${hours < 10 ? hours.toFixed(1) : hours.toFixed(0)} h`;
    const pct = Math.round(spaceShare * 100);
    let why: string;
    if (row.needs === 'neither') {
      why = 'Patients sent here did not wait for a space.';
    } else if (row.needs === 'a space') {
      why = `${pct}% of the ${hoursText} its patients waited for a space, no space was free. Another nurse would not shorten that; a space would: open one, or free one sooner through faster discharge or transfer.`;
    } else {
      why = `${100 - pct}% of the ${hoursText} its patients waited for a space, a space was free but no nurse could take them. A space would not shorten that; a nurse or a faster handover would.`;
    }
    return { ...row, totalHours: hours, spaceShare, hoursPerPatient: row.n > 0 ? hours / row.n : 0, why };
  });
}

/** Why each zone waits: the share of its starved time with no space free against a space free but no nurse (1.5). */
export function zoneNeedShareChart(metrics: ReplayMetrics): ChartSeries {
  const rows = zoneNeeds(metrics).filter((r) => r.totalHours > 0);
  return {
    labels: rows.map((r) => r.label),
    datasets: [
      { label: 'No space free', data: rows.map((r) => r.spaceShare), color: ahs.orange, stack: 'why' },
      { label: 'Space free, no nurse', data: rows.map((r) => 1 - r.spaceShare), color: ahs.green, stack: 'why' },
    ],
  };
}

// ─── The average nurse day as bars ─────────────────────────────────────────────────────

export interface NurseStateRange {
  state: string;
  label: string;
  mean: number;
  min: number;
  max: number;
}

/** Mean minutes per state across the bedside nurses, largest first, with each state's spread across nurses (1.5). */
export function nurseStateBars(metrics: ReplayMetrics): NurseStateRange[] {
  const ledgers = Object.values(metrics.staff.nurseMinutes ?? {});
  if (!ledgers.length) return [];
  return NURSE_STATE_ORDER.map((state) => {
    const values = ledgers.map((l) => l[state] ?? 0);
    return { state, label: NURSE_STATE_LABELS[state], mean: sum(values) / values.length, min: Math.min(...values), max: Math.max(...values) };
  }).sort((a, b) => b.mean - a.mean);
}

export function nurseStateBarsChart(metrics: ReplayMetrics): ChartSeries {
  const rows = nurseStateBars(metrics);
  const total = sum(rows.map((r) => r.mean));
  return {
    labels: rows.map((r) => (total > 0 ? `${r.label} (${Math.round((r.mean / total) * 100)}%)` : r.label)),
    datasets: [{ label: 'Minutes in the average nurse day', data: rows.map((r) => Math.round(r.mean)), color: ahs.blue }],
  };
}
