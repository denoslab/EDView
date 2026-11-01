/**
 * Pure selectors turning a replay's `Metrics` object (built by
 * reverie/edview_replay/metrics.py) into chart series. Nothing from chart.js is
 * imported here, so the shapes are unit-testable under node; `MetricsDashboard`
 * maps a `ChartSeries` onto chart.js datasets.
 */
import type { ByCtas, MetricsCell, ReplayMetrics, StageWaitKey } from './types';
import { ahs, ahsSeries, ahsTotal, ctasColors, withAlpha } from '../theme/ahs';

export { withAlpha };

export interface SeriesDataset {
  label: string;
  data: number[];
  color: string;
  /** Bars sharing a stack id are stacked; absent means grouped. */
  stack?: string;
  /** Drawn as a dashed line, or as a hollow bar. */
  dashed?: boolean;
  /** Drawn heavier than its neighbours. */
  emphasis?: boolean;
}

export interface ChartSeries {
  labels: string[];
  datasets: SeriesDataset[];
}

export type OutcomeTileKey = 'enrolled' | 'completed' | 'lwbs' | 'withinTarget' | 'dischargedWithin4h';

export interface OutcomeTile {
  key: OutcomeTileKey;
  title: string;
  value: string;
  note?: string;
  /** What the value is of, shown under it. */
  qualifier?: string;
  /** The `metricsMethods` entry the tile's info control opens. */
  method: string;
}

/**
 * The CTAS colour code (1 blue, 2 red, 3 yellow, 4 green, 5 white) on AHS brand values;
 * see `@/theme/ahs`. Fixed per level, never positional.
 */
export const CTAS_COLORS: Record<string, string> = ctasColors;
/** A total drawn over coloured series. */
export const TOTAL_COLOR = ahsTotal;
/** Departures beside an arrivals stack: the neutral dark grey, so no CTAS hue is reused. */
export const DEPARTURE_COLOR = ahs.darkGray;
/** Zones take the ordered brand palette (Blue, Green, Dark Blue, Orange, Dark Gray). */
const ZONE_COLORS: readonly string[] = ahsSeries;
const FALLBACK_COLOR = ahs.dustyGray;
/** A lighter tint of a brand colour, for the service half of a wait/service pair. */
const tint = (color: string) => withAlpha(color, 0.45);

/** The waiting states in the order a patient passes them. */
export const WAITING_STATE_ORDER = [
  'WAITING_FOR_TRIAGE',
  'WAITING_FOR_REGISTRATION',
  'WAITING_FOR_NURSE',
  'WAITING_FOR_FIRST_ASSESSMENT',
  'WAITING_FOR_TEST',
  'WAITING_FOR_RESULT',
  'WAITING_FOR_DOCTOR',
  'WAITING_FOR_EXIT',
  'WAITING_FOR_BOARDING_BED',
];
/**
 * The main palette in flow order, each stage's two waits as a colour and its tint, so a
 * stacked area reads in pairs; boarding keeps the red semantic (AHS Red, used sparingly).
 */
export const STATE_COLORS: Record<string, string> = {
  WAITING_FOR_TRIAGE: ahs.blue,
  WAITING_FOR_REGISTRATION: tint(ahs.blue),
  WAITING_FOR_NURSE: ahs.green,
  WAITING_FOR_FIRST_ASSESSMENT: tint(ahs.green),
  WAITING_FOR_TEST: ahs.orange,
  GOING_FOR_TEST: ahs.dustyGray,
  WAITING_FOR_RESULT: tint(ahs.orange),
  WAITING_FOR_DOCTOR: ahs.darkBlue,
  WAITING_FOR_EXIT: ahs.darkGray,
  WAITING_FOR_BOARDING_BED: ahs.red,
};

/** The nine stage-1 components in the order a patient passes them (reverie.py:2711-2718). */
export const STAGE1_COMPONENT_ORDER = [
  'triage_wait',
  'triage',
  'registration_wait',
  'registration',
  'resource_blocked',
  'nurse_or_priority_wait',
  'transport_walk',
  'target_hold',
  'clinician_wait',
];
export const STAGE1_COMPONENT_LABELS: Record<string, string> = {
  triage_wait: 'Wait for triage',
  triage: 'Triage walk and handover',
  registration_wait: 'Wait for clerk',
  registration: 'Registration',
  resource_blocked: 'No space free',
  nurse_or_priority_wait: 'Space free, no nurse',
  transport_walk: 'Escort to space',
  target_hold: 'Sampled target hold',
  clinician_wait: 'Wait for physician',
};
/** Each wait/service pair shares a brand colour, the service as its tint, so the stack reads in pairs. */
const STAGE1_COMPONENT_COLORS: Record<string, string> = {
  triage_wait: ahs.blue,
  triage: tint(ahs.blue),
  registration_wait: ahs.darkBlue,
  registration: tint(ahs.darkBlue),
  // The two starvation waits: no space (orange, the accent) against no nurse (green).
  resource_blocked: ahs.orange,
  nurse_or_priority_wait: ahs.green,
  transport_walk: tint(ahs.darkGray),
  // The hold is the historical floor the scenario sampled, not congestion: light grey.
  target_hold: ahs.dustyGray,
  clinician_wait: ahs.darkGray,
};

export const STAGE_WAIT_KEYS: StageWaitKey[] = [
  'doorToTriage',
  'doorToBed',
  'doorToDoctor',
  'doctorToDisposition',
  'dispositionToDeparture',
  'lengthOfStay',
];
export const STAGE_WAIT_LABELS: Record<StageWaitKey, string> = {
  doorToTriage: 'Arrival to triage',
  doorToBed: 'Arrival to treatment space',
  doorToDoctor: 'Arrival to physician (selection)',
  doctorToDisposition: 'Physician to disposition',
  dispositionToDeparture: 'Disposition to departure',
  lengthOfStay: 'Total time in ED (completed visits)',
};

/** Minutes since the run start as "h:mm". */
export function elapsedLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}:${m < 10 ? '0' : ''}${m}`;
}

export function formatMinutes(minutes: number | undefined): string {
  if (minutes === undefined || Number.isNaN(minutes)) return '--';
  const whole = Math.round(minutes);
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  return h > 0 ? `${h}h ${m < 10 ? '0' : ''}${m}m` : `${m}m`;
}

export function percent(share: number | undefined): string {
  if (share === undefined || Number.isNaN(share)) return '--';
  return `${Math.round(share * 100)}%`;
}

export function shortState(state: string): string {
  const words = state.replace(/^WAITING_FOR_/, 'wait for ').replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function bucketLabels(metrics: ReplayMetrics): string[] {
  const { buckets, bucketMinutes } = metrics.axis;
  return Array.from({ length: buckets }, (_, i) => elapsedLabel(i * bucketMinutes));
}

export function hourLabels(metrics: ReplayMetrics): string[] {
  return Array.from({ length: metrics.axis.hours }, (_, i) => `${i}–${i + 1} h`);
}

/** The CTAS keys present in a by-CTAS map, in level order. */
export function ctasLevels(byCtas: Record<string, unknown>): string[] {
  return Object.keys(byCtas).sort((a, b) => Number(a) - Number(b));
}

function ctasColor(level: string): string {
  return CTAS_COLORS[level] ?? FALLBACK_COLOR;
}

/**
 * Patients present over time: every level with a patient as a stacked band (`stack`
 * 'census'), and the whole cohort as a line on top. Drawn with `LineChart stacked`.
 */
export function censusChart(metrics: ReplayMetrics): ChartSeries {
  const datasets: SeriesDataset[] = [];
  for (const level of ctasLevels(metrics.series.censusByCtas)) {
    const data = metrics.series.censusByCtas[level];
    if (data.some((v) => v > 0)) {
      datasets.push({ label: `CTAS ${level}`, data, color: ctasColor(level), stack: 'census' });
    }
  }
  datasets.push({ label: 'All patients', data: metrics.series.census, color: TOTAL_COLOR, emphasis: true });
  return { labels: bucketLabels(metrics), datasets };
}

/** The three places a present patient can be, from the per-state series, in flow order. */
export const PHASE_STATES: Record<string, string[]> = {
  'In the waiting room': ['WAITING_FOR_TRIAGE', 'TRIAGE', 'WAITING_FOR_REGISTRATION', 'REGISTRATION', 'WAITING_FOR_NURSE'],
  'In a treatment space': ['WAITING_FOR_FIRST_ASSESSMENT', 'WAITING_FOR_TEST', 'GOING_FOR_TEST', 'WAITING_FOR_RESULT', 'WAITING_FOR_DOCTOR'],
  'After the disposition': ['WAITING_FOR_EXIT', 'WAITING_FOR_BOARDING_BED', 'ADMITTED_BOARDING', 'DISCHARGED_WAITING', 'LEAVING'],
};
/** Waiting = orange, in a space = blue (patients), after the disposition = grey: the semantic palette. */
const PHASE_COLORS: Record<string, string> = {
  'In the waiting room': ahs.orange,
  'In a treatment space': ahs.blue,
  'After the disposition': ahs.darkGray,
};

/** Where the present patients are over the day, stacked so the top edge is the census (1.1). */
export function phaseCensusChart(metrics: ReplayMetrics): ChartSeries {
  const length = metrics.series.census.length;
  const datasets: SeriesDataset[] = Object.entries(PHASE_STATES).map(([label, states]) => ({
    label,
    data: Array.from({ length }, (_, i) => states.reduce((sum, state) => sum + (metrics.series.byState[state]?.[i] ?? 0), 0)),
    color: PHASE_COLORS[label],
    stack: 'phase',
  }));
  return { labels: bucketLabels(metrics), datasets };
}

/**
 * Arrivals minus departures in each hour, and the running total of that difference since
 * the start: how many patients the day has added to the department so far (1.1).
 */
export function netFlowChart(metrics: ReplayMetrics): ChartSeries {
  const arrivals = Array.from({ length: metrics.axis.hours }, (_, h) =>
    Object.values(metrics.hourly.arrivalsByCtas).reduce((sum, series) => sum + (series[h] ?? 0), 0),
  );
  const net = arrivals.map((a, h) => a - (metrics.hourly.departures[h] ?? 0));
  let running = 0;
  const backlog = net.map((v) => (running += v));
  return {
    labels: hourLabels(metrics),
    datasets: [
      { label: 'Arrivals minus departures in the hour', data: net, color: ahs.orange },
      { label: 'Added to the department since the start', data: backlog, color: ahs.blue, emphasis: true },
      { label: 'Balance (0)', data: net.map(() => 0), color: TOTAL_COLOR, dashed: true },
    ],
  };
}

/** Arrivals stacked by CTAS per simulated hour, with departures beside them unless asked not to. */
export function arrivalsChart(metrics: ReplayMetrics, options: { withDepartures?: boolean } = {}): ChartSeries {
  const datasets: SeriesDataset[] = [];
  for (const level of ctasLevels(metrics.hourly.arrivalsByCtas)) {
    const data = metrics.hourly.arrivalsByCtas[level];
    if (data.some((v) => v > 0)) {
      datasets.push({ label: `Arrivals CTAS ${level}`, data, color: ctasColor(level), stack: 'arrivals' });
    }
  }
  if (options.withDepartures ?? true) {
    datasets.push({ label: 'Departures', data: metrics.hourly.departures, color: DEPARTURE_COLOR, stack: 'departures' });
  }
  return { labels: hourLabels(metrics), datasets };
}

/**
 * Patients in each waiting state over time as stacked bands in flow order (`stack`
 * 'waiting'), so the top edge is everyone waiting; states nobody entered are left out.
 */
export function waitingByStateChart(metrics: ReplayMetrics): ChartSeries {
  const datasets: SeriesDataset[] = [];
  for (const state of WAITING_STATE_ORDER) {
    const data = metrics.series.byState[state];
    if (data && data.some((v) => v > 0)) {
      datasets.push({ label: shortState(state), data, color: STATE_COLORS[state] ?? FALLBACK_COLOR, stack: 'waiting' });
    }
  }
  return { labels: bucketLabels(metrics), datasets };
}

/**
 * Median and 90th percentile of one interval per CTAS level, with the sampled target's
 * median where the interval is gated by one, and the CTAS time-to-physician standard
 * (hollow bar) on arrival-to-physician.
 */
export function stageWaitChart(metrics: ReplayMetrics, key: StageWaitKey): ChartSeries {
  const cells: ByCtas<MetricsCell> = metrics.stageWaits[key];
  const levels = ctasLevels(cells);
  const pick = (field: (cell: MetricsCell) => number | undefined): number[] =>
    levels.map((level) => field(cells[level]) ?? 0);
  const datasets: SeriesDataset[] = [
    // Blue against orange: hue-opposed, so the pair survives red-green colour blindness
    // and AHS Red stays reserved for genuinely urgent states.
    { label: 'Median', data: pick((cell) => cell.median), color: ahs.blue },
    { label: '90th percentile', data: pick((cell) => cell.p90), color: ahs.orange },
  ];
  if (levels.some((level) => cells[level].targetMedian !== undefined)) {
    datasets.push({ label: 'Sampled target (median)', data: pick((cell) => cell.targetMedian), color: ahs.dustyGray });
  }
  if (key === 'doorToDoctor') {
    datasets.push({
      label: 'CTAS standard',
      data: levels.map((level) => metrics.compliance.ctasTargetMinutes[level] ?? 0),
      color: TOTAL_COLOR,
      dashed: true,
    });
  }
  return { labels: levels.map((level) => `CTAS ${level}`), datasets };
}

/** Patients behind each bar of `stageWaitChart`, in the same order. */
export function stageWaitCounts(metrics: ReplayMetrics, key: StageWaitKey): number[] {
  const cells: ByCtas<MetricsCell> = metrics.stageWaits[key];
  return ctasLevels(cells).map((level) => cells[level].n);
}

/** The nine stage-1 components stacked per CTAS level, mean minutes. */
export function stage1ComponentsChart(metrics: ReplayMetrics): ChartSeries {
  const byCtas: ByCtas<Record<string, number>> = metrics.stage1Components ?? {};
  const levels = ctasLevels(byCtas);
  const datasets: SeriesDataset[] = STAGE1_COMPONENT_ORDER.map((component) => ({
    label: STAGE1_COMPONENT_LABELS[component] ?? component,
    data: levels.map((level) => byCtas[level][component] ?? 0),
    color: STAGE1_COMPONENT_COLORS[component] ?? FALLBACK_COLOR,
    stack: 'stage1',
  }));
  return { labels: levels.map((level) => `CTAS ${level} (n=${byCtas[level].n ?? 0})`), datasets };
}

/**
 * The nine pre-physician components grouped by the resource that owns the wait, in flow
 * order: four bands instead of nine, so the stacked bars read at a glance (1.2). The nine
 * remain available as the detailed view.
 */
export const STAGE1_GROUPS: { label: string; components: string[]; color: string }[] = [
  { label: 'Triage (wait and handover)', components: ['triage_wait', 'triage'], color: ahs.blue },
  { label: 'Registration (wait and service)', components: ['registration_wait', 'registration'], color: ahs.darkBlue },
  { label: 'Waiting for a space (no space, no nurse, escort)', components: ['resource_blocked', 'nurse_or_priority_wait', 'transport_walk'], color: ahs.orange },
  { label: 'Waiting for the physician (target hold and wait)', components: ['target_hold', 'clinician_wait'], color: ahs.darkGray },
];

export function stage1GroupedChart(metrics: ReplayMetrics): ChartSeries {
  const byCtas: ByCtas<Record<string, number>> = metrics.stage1Components ?? {};
  const levels = ctasLevels(byCtas);
  return {
    labels: levels.map((level) => `CTAS ${level} (n=${byCtas[level].n ?? 0})`),
    datasets: STAGE1_GROUPS.map((group) => ({
      label: group.label,
      data: levels.map((level) => group.components.reduce((sum, c) => sum + (byCtas[level][c] ?? 0), 0)),
      color: group.color,
      stack: 'stage1',
    })),
  };
}

export interface PooledInterval {
  key: StageWaitKey;
  label: string;
  n: number;
  mean: number;
  p90: number;
}

/**
 * The six visit intervals pooled across levels (n-weighted means), largest first, with the
 * worst level's 90th percentile beside each (1.2). The intervals nest (the total contains the
 * others), so the order is also the order of the visit's accumulating time.
 */
export function pooledIntervalsChart(metrics: ReplayMetrics): ChartSeries & { rows: PooledInterval[] } {
  const rows: PooledInterval[] = [];
  for (const key of STAGE_WAIT_KEYS) {
    const cells = Object.values(metrics.stageWaits[key]);
    const n = cells.reduce((sum, c) => sum + c.n, 0);
    if (n === 0) continue;
    rows.push({
      key,
      label: STAGE_WAIT_LABELS[key],
      n,
      mean: cells.reduce((sum, c) => sum + c.mean * c.n, 0) / n,
      p90: Math.max(...cells.map((c) => c.p90)),
    });
  }
  rows.sort((a, b) => b.mean - a.mean);
  return {
    labels: rows.map((r) => r.label),
    datasets: [
      { label: 'Mean, all levels', data: rows.map((r) => Math.round(r.mean)), color: ahs.blue },
      { label: 'Worst level, 90th percentile', data: rows.map((r) => Math.round(r.p90)), color: ahs.orange },
    ],
    rows,
  };
}

/** Peak census and the time since run start it occurred (1.1). */
export function peakCensus(metrics: ReplayMetrics): { value: number; at: string } {
  const census = metrics.series.census;
  let best = 0;
  for (let i = 1; i < census.length; i++) {
    if (census[i] > census[best]) best = i;
  }
  return { value: census[best] ?? 0, at: elapsedLabel(best * metrics.axis.bucketMinutes) };
}

/**
 * Departures per hour split by disposition (1.1); an older replay without the split draws
 * nothing. Admitted and walked-out departures appear only when somebody took that route,
 * so a run with admission or walkouts switched off is not given an empty legend entry.
 */
export function departuresByDispositionChart(metrics: ReplayMetrics): ChartSeries {
  const split = metrics.hourly.departuresByDisposition;
  const labels = hourLabels(metrics);
  if (!split) return { labels, datasets: [] };
  const datasets: SeriesDataset[] = [
    { label: 'Discharged', data: split.discharged, color: ahs.green, stack: 'departures' },
  ];
  if (split.admitted.some((v) => v > 0)) {
    datasets.push({ label: 'Admitted', data: split.admitted, color: ahs.blue, stack: 'departures' });
  }
  if (split.lwbs.some((v) => v > 0)) {
    datasets.push({ label: 'Left without being seen', data: split.lwbs, color: ahs.red, stack: 'departures' });
  }
  return { labels, datasets };
}

/** Hour labels for the bed-occupancy snapshots, which the engine writes once per simulated hour. */
export function bedHourLabels(metrics: ReplayMetrics): string[] {
  const zones = Object.values(metrics.beds ?? {});
  const hours = zones.reduce<number[]>((best, zone) => (zone.hours.length > best.length ? zone.hours : best), []);
  return hours.map((h) => elapsedLabel(h * 60));
}

/** Patients holding a space in each zone per snapshot (1.1 census by zone), stacked. */
export function censusByZoneChart(metrics: ReplayMetrics): ChartSeries {
  const beds = metrics.beds ?? {};
  const datasets: SeriesDataset[] = Object.keys(beds)
    .sort()
    .map((zone, i) => ({
      label: zone,
      data: beds[zone].active,
      color: ZONE_COLORS[i % ZONE_COLORS.length],
      stack: 'zones',
    }));
  return { labels: bedHourLabels(metrics), datasets };
}

/**
 * The cohort tiles, keyed so each tab picks its own. The admitted share and the admitted
 * 8-hour benchmark are left out while runs keep admission switched off.
 */
export function outcomeTiles(metrics: ReplayMetrics): OutcomeTile[] {
  const { cohort, compliance } = metrics;
  const departed = cohort.completed + cohort.lwbs;
  // CTAS 1 carries no `share` (its standard is "immediate"), so the aggregate is over 2-5.
  const graded = Object.values(compliance.withinCtasTarget).filter((cell) => cell.share !== undefined);
  const seen = graded.reduce((sum, cell) => sum + cell.n, 0);
  const withinTarget = graded.reduce((sum, cell) => sum + (cell.share ?? 0) * cell.n, 0);
  return [
    { key: 'enrolled', title: 'Patients in the day', value: `${cohort.enrolled}`, qualifier: 'arrived or already present', method: 'cohort' },
    {
      key: 'completed',
      title: 'Completed',
      value: `${cohort.completed}`,
      qualifier: 'treated and left during the day',
      note: `${cohort.censored} still in the ED at the end`,
      method: 'cohort',
    },
    {
      key: 'lwbs',
      title: 'Left without being seen',
      value: departed > 0 ? percent(cohort.lwbs / departed) : '--',
      qualifier: `${cohort.lwbs} of ${departed} who departed`,
      method: 'lwbs',
    },
    {
      key: 'withinTarget',
      title: 'Seen within CTAS target',
      value: seen > 0 ? percent(withinTarget / seen) : '--',
      qualifier: `of ${seen} who reached a physician`,
      note: 'CTAS 2 to 5',
      method: 'withinTarget',
    },
    {
      key: 'dischargedWithin4h',
      title: 'Discharged within 4 h',
      value: percent(compliance.dischargedWithin4h.share),
      qualifier: `of ${compliance.dischargedWithin4h.n} discharged`,
      method: 'lengthOfStayBenchmarks',
    },
  ];
}
