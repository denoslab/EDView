import { describe, expect, test } from 'vitest';
import type { ReplayMetrics } from '@/replay/types';
import { ahs } from '@/theme/ahs';
import {
  arrivalsChart,
  bucketLabels,
  censusChart,
  elapsedLabel,
  formatMinutes,
  hourLabels,
  netFlowChart,
  outcomeTiles,
  percent,
  phaseCensusChart,
  pooledIntervalsChart,
  shortState,
  stage1ComponentsChart,
  stage1GroupedChart,
  stageWaitChart,
  stageWaitCounts,
  waitingByStateChart,
  withAlpha,
  STAGE1_COMPONENT_ORDER,
  STAGE_WAIT_LABELS,
} from '@/replay/metricsSelectors';

const ZEROS = Array<number>(13).fill(0);
const CTAS3 = [1, 1, 1, 2, 2, 2, 2, 1, 1, 0, 0, 0, 0];
const CTAS2 = [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0];

// One simulated hour in 5-minute buckets, as reverie/edview_replay/metrics.py emits it.
const METRICS: ReplayMetrics = {
  version: 1,
  cohort: { enrolled: 4, completed: 2, censored: 1, lwbs: 1, admitted: 1 },
  axis: {
    t0: 'October 01, 2025, 00:00:00',
    tEnd: 'October 01, 2025, 01:00:00',
    bucketMinutes: 5,
    buckets: 13,
    hours: 1,
  },
  series: {
    census: CTAS3.map((v, i) => v + CTAS2[i]),
    censusByCtas: { '1': ZEROS, '2': CTAS2, '3': CTAS3, '4': ZEROS, '5': ZEROS },
    byState: { WAITING_FOR_TRIAGE: CTAS3, TRIAGE: CTAS2, WAITING_FOR_NURSE: ZEROS },
    boarders: ZEROS,
  },
  hourly: {
    arrivalsByCtas: { '1': [0], '2': [1], '3': [2], '4': [0], '5': [0] },
    departures: [1],
  },
  stageWaits: {
    doorToTriage: {},
    doorToBed: {},
    doorToDoctor: {
      '2': { n: 1, median: 40, p90: 40, mean: 40, targetMedian: 30 },
      '3': { n: 2, median: 60, p90: 70, mean: 62.5, targetMedian: 50 },
    },
    doctorToDisposition: {},
    dispositionToDeparture: {},
    lengthOfStay: {},
  },
  compliance: {
    ctasTargetMinutes: { '1': 0, '2': 15, '3': 30, '4': 60, '5': 120 },
    withinCtasTarget: {
      '1': { n: 1, within5: 1, within10: 1 },
      '2': { n: 1, within5: 0, within10: 0, share: 0 },
      '3': { n: 2, within5: 0, within10: 0, share: 0.5 },
    },
    dischargedWithin4h: { n: 2, share: 1 },
    admittedWithin8h: { n: 0 },
  },
  staff: { doctors: 2, doctorMaxPatients: 4, bedsideNurses: 1, triageNurses: 1, clerks: 1, nurseMinutes: {} },
  stage1Components: {
    '3': {
      n: 2,
      triage_wait: 10,
      triage: 2,
      registration_wait: 3,
      registration: 5,
      resource_blocked: 0,
      nurse_or_priority_wait: 4,
      transport_walk: 1,
      target_hold: 20,
      clinician_wait: 15,
    },
  },
};

describe('formatting helpers', () => {
  test('elapsed labels are h:mm from the run start', () => {
    expect(elapsedLabel(0)).toBe('0:00');
    expect(elapsedLabel(65)).toBe('1:05');
  });

  test('minutes format as hours and minutes', () => {
    expect(formatMinutes(125)).toBe('2h 05m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(undefined)).toBe('--');
  });

  test('shares format as whole percentages', () => {
    expect(percent(0.5)).toBe('50%');
    expect(percent(undefined)).toBe('--');
  });

  test('hex colours gain an alpha channel', () => {
    expect(withAlpha('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(withAlpha('red', 0.5)).toBe('red');
  });

  test('state names read as short labels', () => {
    expect(shortState('WAITING_FOR_FIRST_ASSESSMENT')).toBe('Wait for first assessment');
  });
});

describe('axis labels', () => {
  test('one bucket label per series value and one hour label per hour', () => {
    const labels = bucketLabels(METRICS);
    expect(labels).toHaveLength(13);
    expect(labels[0]).toBe('0:00');
    expect(labels[12]).toBe('1:00');
    expect(hourLabels(METRICS)).toEqual(['0–1 h']);
  });
});

describe('censusChart', () => {
  test('stacks only the levels with a patient and draws the whole cohort as a line on top', () => {
    const chart = censusChart(METRICS);
    expect(chart.datasets.map((d) => d.label)).toEqual(['CTAS 2', 'CTAS 3', 'All patients']);
    expect(chart.datasets.slice(0, 2).every((d) => d.stack === 'census')).toBe(true);
    expect(chart.datasets[2].emphasis).toBe(true);
    expect(chart.datasets[2].stack).toBeUndefined();
    expect(chart.datasets[1].data).toBe(CTAS3);
    expect(chart.labels).toHaveLength(13);
  });

  test('where the patients are: the three phases stack up to the census', () => {
    const chart = phaseCensusChart(METRICS);
    expect(chart.datasets.map((d) => d.label)).toEqual(['In the waiting room', 'In a treatment space', 'After the disposition']);
    expect(chart.datasets.every((d) => d.stack === 'phase')).toBe(true);
    // The fixture's states are all pre-space states, so the waiting room is the whole census.
    const totals = chart.labels.map((_, i) => chart.datasets.reduce((s, d) => s + d.data[i], 0));
    expect(totals).toEqual(METRICS.series.census);
    expect(chart.datasets[0].data).toEqual(METRICS.series.census);
  });
});

describe('arrivalsChart', () => {
  test('stacks arrivals by level in one stack and departures in another', () => {
    const chart = arrivalsChart(METRICS);
    expect(chart.datasets.map((d) => d.label)).toEqual(['Arrivals CTAS 2', 'Arrivals CTAS 3', 'Departures']);
    expect(chart.datasets.map((d) => d.stack)).toEqual(['arrivals', 'arrivals', 'departures']);
    expect(chart.labels).toEqual(['0–1 h']);
  });

  test('can leave departures to the chart beside it', () => {
    const chart = arrivalsChart(METRICS, { withDepartures: false });
    expect(chart.datasets.map((d) => d.label)).toEqual(['Arrivals CTAS 2', 'Arrivals CTAS 3']);
  });

  test('net flow is arrivals minus departures per hour with its running total', () => {
    const chart = netFlowChart(METRICS);
    expect(chart.datasets.map((d) => d.label)).toEqual(['Arrivals minus departures in the hour', 'Added to the department since the start', 'Balance (0)']);
    expect(chart.datasets[0].data).toEqual([2]);
    expect(chart.datasets[1].data).toEqual([2]);
    expect(chart.datasets[2].dashed).toBe(true);
  });
});

describe('waitingByStateChart', () => {
  test('draws waiting states only, and only those somebody entered', () => {
    const chart = waitingByStateChart(METRICS);
    expect(chart.datasets.map((d) => d.label)).toEqual(['Wait for triage']);
  });
});

describe('stageWaitChart', () => {
  test('median, p90, target and the CTAS standard per level', () => {
    const chart = stageWaitChart(METRICS, 'doorToDoctor');
    expect(chart.labels).toEqual(['CTAS 2', 'CTAS 3']);
    expect(chart.datasets.map((d) => d.label)).toEqual([
      'Median',
      '90th percentile',
      'Sampled target (median)',
      'CTAS standard',
    ]);
    expect(chart.datasets[0].data).toEqual([40, 60]);
    expect(chart.datasets[1].data).toEqual([40, 70]);
    expect(chart.datasets[2].data).toEqual([30, 50]);
    expect(chart.datasets[3].data).toEqual([15, 30]);
    expect(chart.datasets[3].dashed).toBe(true);
    expect(stageWaitCounts(METRICS, 'doorToDoctor')).toEqual([1, 2]);
  });

  test('an interval nobody reached is an empty chart', () => {
    const chart = stageWaitChart(METRICS, 'lengthOfStay');
    expect(chart.labels).toEqual([]);
    expect(chart.datasets.map((d) => d.data)).toEqual([[], []]);
    expect(stageWaitCounts(METRICS, 'lengthOfStay')).toEqual([]);
  });
});

describe('stage1GroupedChart and pooledIntervalsChart', () => {
  test('the four groups add up to the nine components', () => {
    const chart = stage1GroupedChart(METRICS);
    expect(chart.labels).toEqual(['CTAS 3 (n=2)']);
    expect(chart.datasets.map((d) => d.data[0])).toEqual([12, 8, 5, 35]);
    expect(chart.datasets.every((d) => d.stack === 'stage1')).toBe(true);
  });

  test('pooled intervals are n-weighted means, largest first, with the worst level 90th', () => {
    const chart = pooledIntervalsChart(METRICS);
    // Only arrival to physician has patients in the fixture: (40 x 1 + 62.5 x 2) / 3 = 55; worst p90 70.
    expect(chart.rows).toEqual([{ key: 'doorToDoctor', label: STAGE_WAIT_LABELS.doorToDoctor, n: 3, mean: 55, p90: 70 }]);
    expect(chart.datasets[0].data).toEqual([55]);
    expect(chart.datasets[1].data).toEqual([70]);
  });
});

describe('stage1ComponentsChart', () => {
  test('nine stacked components in flow order, the sampled hold in grey', () => {
    const chart = stage1ComponentsChart(METRICS);
    expect(chart.labels).toEqual(['CTAS 3 (n=2)']);
    expect(chart.datasets).toHaveLength(STAGE1_COMPONENT_ORDER.length);
    expect(chart.datasets.every((d) => d.stack === 'stage1')).toBe(true);
    expect(chart.datasets[0].data).toEqual([10]);
    const hold = chart.datasets.find((d) => d.label === 'Sampled target hold');
    expect(hold?.color).toBe(ahs.dustyGray);
    expect(hold?.data).toEqual([20]);
  });
});

describe('outcomeTiles', () => {
  test('counts, shares and the CTAS 2-5 target aggregate', () => {
    const tiles = Object.fromEntries(outcomeTiles(METRICS).map((t) => [t.title, t]));
    expect(tiles['Patients in the day'].value).toBe('4');
    expect(tiles['Completed'].note).toBe('1 still in the ED at the end');
    expect(tiles['Left without being seen'].value).toBe('33%');   // 1 of 3 departed
    expect(tiles['Left without being seen'].qualifier).toBe('1 of 3 who departed');
    expect(tiles['Seen within CTAS target'].value).toBe('33%');    // (0 x 1 + 0.5 x 2) / 3
    expect(tiles['Seen within CTAS target'].qualifier).toBe('of 3 who reached a physician');
    expect(tiles['Discharged within 4 h'].value).toBe('100%');
    expect(tiles['Discharged within 4 h'].qualifier).toBe('of 2 discharged');
  });

  test('admitted stats are left out while runs keep admission off', () => {
    expect(outcomeTiles(METRICS).map((t) => t.key)).toEqual([
      'enrolled',
      'completed',
      'lwbs',
      'withinTarget',
      'dischargedWithin4h',
    ]);
  });
});
