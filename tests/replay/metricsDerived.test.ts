import { describe, expect, test } from 'vitest';
import { ahs } from '@/theme/ahs';
import {
  arrivalToTriageChart,
  bottleneckScores,
  bucketIndexFor,
  componentRanking,
  dispositionMix,
  edwinBand,
  edwinBands,
  edwinChart,
  lwbsStates,
  bottleneckScoreChart,
  bottleneckScoresOverDay,
  nurseLoadChart,
  nurseStateBars,
  nurseStateBarsChart,
  nurseUtilization,
  NURSE_RATIO_GUIDE,
  oldestWaitAverageChart,
  parseSimTime,
  physicianLoadSeries,
  physicianPickupRows,
  physicianPickupsByHourChart,
  pressureSummary,
  queueAverages,
  queueDepthAverageChart,
  queueSnapshot,
  resourceUtilization,
  zoneNeedShareChart,
  zoneNeeds,
  runMinutes,
  sampledTargetMedians,
  starvationChart,
  starvationRows,
  stateMinutesChart,
  surgeRecovery,
  throughputBalanceChart,
  triageClerkLoad,
  usableCapacityChart,
  withinTargetChart,
  zoneOccupancyShareChart,
} from '@/replay/metricsDerived';
import { censusByZoneChart, departuresByDispositionChart, peakCensus } from '@/replay/metricsSelectors';
import { METRICS, OLD_METRICS } from './metricsFixture';

describe('clock helpers', () => {
  test('the engine clock parses and anything else does not', () => {
    expect(parseSimTime('October 01, 2025, 06:05:00')?.toISOString()).toBe('2025-10-01T06:05:00.000Z');
    expect(parseSimTime('2025-10-01 06:05:00')).toBeUndefined();
    expect(parseSimTime(undefined)).toBeUndefined();
  });

  test('a replay clock maps to its 5-minute bucket, clamped to the axis', () => {
    expect(bucketIndexFor(METRICS, 'October 01, 2025, 06:00:00')).toBe(0);
    expect(bucketIndexFor(METRICS, 'October 01, 2025, 06:34:59')).toBe(6);
    expect(bucketIndexFor(METRICS, 'October 01, 2025, 09:00:00')).toBe(24);
    expect(bucketIndexFor(METRICS, undefined)).toBe(0);
    expect(runMinutes(METRICS)).toBe(120);
  });
});

describe('1.1 flow', () => {
  test('peak census and the disposition split', () => {
    expect(peakCensus(METRICS)).toEqual({ value: 3, at: '0:30' });
    const split = departuresByDispositionChart(METRICS);
    expect(split.datasets.map((d) => d.label)).toEqual(['Discharged', 'Admitted', 'Left without being seen']);
    expect(departuresByDispositionChart(OLD_METRICS).datasets).toEqual([]);
  });

  test('a disposition nobody took is left out of the split, discharged always stays', () => {
    const none = {
      ...METRICS,
      hourly: { ...METRICS.hourly, departuresByDisposition: { discharged: [0, 2], admitted: [0, 0], lwbs: [0, 0] } },
    };
    expect(departuresByDispositionChart(none).datasets.map((d) => d.label)).toEqual(['Discharged']);
  });

  test('census by zone stacks the active count per zone', () => {
    const chart = censusByZoneChart(METRICS);
    expect(chart.labels).toEqual(['0:00', '1:00', '2:00']);
    expect(chart.datasets.map((d) => d.data)).toEqual([[3, 5, 6], [1, 2, 2]]);
    expect(censusByZoneChart(OLD_METRICS).datasets).toEqual([]);
  });
});

describe('1.2 waits', () => {
  test('state minutes chart reads means per level and counts the patients', () => {
    const chart = stateMinutesChart(METRICS, ['WAITING_FOR_REGISTRATION', 'REGISTRATION'], false);
    expect(chart.labels).toEqual(['CTAS 2', 'CTAS 3']);
    expect(chart.datasets[0].data).toEqual([1.5, 4]);
    expect(chart.datasets[1].data).toEqual([5, 5]);
    expect(chart.datasets[0].stack).toBeUndefined();
    expect(chart.counts).toEqual([2, 3]);
    expect(stateMinutesChart(OLD_METRICS, ['REGISTRATION'], true).datasets).toEqual([]);
  });

  test('arrival to triage carries the 10-minute expectation as a hollow bar', () => {
    const chart = arrivalToTriageChart(METRICS);
    expect(chart.datasets[2]).toMatchObject({ dashed: true, data: [10, 10] });
  });
});

describe('1.3 outcomes', () => {
  test('disposition mix is derived from the cohort counts', () => {
    expect(dispositionMix(METRICS)).toEqual({ completed: 3, discharged: 2, admitted: 1, lwbs: 1, censored: 2, departed: 4 });
    expect(lwbsStates(METRICS)).toEqual([{ state: 'WAITING_FOR_NURSE', label: 'Wait for nurse', n: 1 }]);
    expect(lwbsStates(OLD_METRICS)).toEqual([]);
  });

  test('throughput balance is departures over arrivals, NaN without arrivals', () => {
    const chart = throughputBalanceChart(METRICS);
    expect(chart.datasets[0].data).toEqual([0.25, 1.5]);
    const none = throughputBalanceChart({ ...METRICS, hourly: { arrivalsByCtas: { '3': [0, 1] }, departures: [1, 1] } });
    expect(Number.isNaN(none.datasets[0].data[0])).toBe(true);
  });

  test('surge recovery needs an hour before the peak', () => {
    // Hour 0 is the busiest (4 arrivals), so there is no baseline.
    expect(surgeRecovery(METRICS).reason).toMatch(/no pre-surge baseline/);
    const later = { ...METRICS, hourly: { ...METRICS.hourly, arrivalsByCtas: { '3': [1, 4] } } };
    const result = surgeRecovery(later);
    expect(result.peakHour).toBe(1);
    // Hour 0: six buckets at 1 and six at 3, so the median is 2; waiting 1 x 4, 0 x 2, 2 x 6.
    expect(result.baselineCensus).toBe(2);
    expect(result.baselineWaiting).toBe(1.5);
    expect(result.recoveryBucket).toBe(24);
    expect(result.recoveryMinutes).toBe(0);
  });

  test('within-target chart shows CTAS 1 as its 10-minute share', () => {
    const chart = withinTargetChart({
      ...METRICS,
      compliance: { ...METRICS.compliance, withinCtasTarget: { '1': { n: 1, within5: 0, within10: 1 }, '3': { n: 2, within5: 0, within10: 0, share: 0.5 } } },
    });
    expect(chart.labels).toEqual(['CTAS 1 (within 10 min)', 'CTAS 3']);
    expect(chart.datasets[0].data).toEqual([1, 0.5]);
  });
});

describe('1.4 bottlenecks', () => {
  test('the queue board at a bucket is ranked by depth then oldest wait', () => {
    const rows = queueSnapshot(METRICS, 8);
    expect(rows[0]).toMatchObject({ state: 'WAITING_FOR_NURSE', depth: 2, oldest: 20, owner: 'Space or bedside nurse' });
    expect(rows.every((r) => r.state !== 'WAITING_FOR_EXIT')).toBe(true);
    expect(queueSnapshot(OLD_METRICS, 8)[0].oldest).toBeUndefined();
  });

  test('component ranking sums mean times n across levels and names the owner', () => {
    const ranked = componentRanking(METRICS);
    expect(ranked[0]).toMatchObject({ component: 'resource_blocked', totalMinutes: 100, owner: 'Spaces: beds or boarding' });
    expect(ranked.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 10);
    expect(componentRanking(OLD_METRICS).every((r) => r.totalMinutes === 0)).toBe(true);
  });

  test('EDWIN bands follow Bernstein', () => {
    expect(edwinBand(1.2)).toEqual({ label: 'Not busy', color: ahs.green });
    expect(edwinBand(1.5).label).toBe('Busy');
    expect(edwinBand(2.3).label).toBe('Overcrowded');
  });

  test('bottleneck scores average the parts available and name the dominant one', () => {
    const scores = bottleneckScores(METRICS, 8);
    expect(scores[0].state).toBe('WAITING_FOR_NURSE');
    expect(scores[0].score).toBeGreaterThan(0.6);
    expect(scores[0].reason).toMatch(/dominates/);
  });
});

describe('1.5 staffing', () => {
  test('starvation rows rank by the larger counter and say what the zone needs', () => {
    const rows = starvationRows(METRICS);
    expect(rows.map((r) => r.zone)).toEqual(['major_bed', 'minor_bed']);
    expect(rows[0]).toMatchObject({ label: 'Major beds', needs: 'a space' });
    expect(rows[1].needs).toBe('a nurse');
    expect(starvationRows(OLD_METRICS)).toEqual([]);
  });

  test('nurse utilization pools the patient-facing minutes', () => {
    const result = nurseUtilization(METRICS);
    expect(result.perNurse).toEqual([
      { name: 'Bedside Nurse 1', utilization: 80 / 120 },
      { name: 'Bedside Nurse 2', utilization: 40 / 120 },
    ]);
    expect(result.team).toBeCloseTo(120 / 240, 10);
    expect(result.chart.datasets).toHaveLength(5);
    expect(nurseUtilization(OLD_METRICS).team).toBeUndefined();
  });

  test('triage and clerk utilization divide service minutes by staff times run minutes', () => {
    const load = triageClerkLoad(METRICS);
    // TRIAGE: 3 x 2 + 3.5 x 4 = 20 minutes over 1 nurse x 120 minutes.
    expect(load.triage).toEqual({ minutes: 20, staff: 1, utilization: 20 / 120 });
    expect(load.clerk.minutes).toBe(25);
    expect(triageClerkLoad(OLD_METRICS).clerk.utilization).toBeUndefined();
  });

  test('physician load is the stage-2 census per physician', () => {
    const load = physicianLoadSeries(METRICS);
    expect(load[13]).toBe(0.5);
    expect(load[0]).toBe(0);
    const util = resourceUtilization(METRICS);
    expect(util.physician).toBeCloseTo((8 / 25 / 2) / 4, 10);
  });

  test('zone occupancy share is active over usable spaces, with the full line dashed', () => {
    const chart = zoneOccupancyShareChart(METRICS);
    expect(chart.datasets.map((d) => d.label)).toEqual(['major injuries zone', 'minor injuries zone', 'Full']);
    // Major: 3/9, 5/9 (one bed blocked), 6/10; minor: 1/4, 2/4, 2/4.
    expect(chart.datasets[0].data.map((v) => Number(v.toFixed(3)))).toEqual([0.333, 0.556, 0.6]);
    expect(chart.datasets[1].data).toEqual([0.25, 0.5, 0.5]);
    expect(chart.datasets[2]).toMatchObject({ dashed: true, data: [1, 1, 1] });
    expect(zoneOccupancyShareChart(OLD_METRICS).datasets).toEqual([]);
  });

  test('usable capacity is the last snapshot split into usable and closed, and says if closed beds varied', () => {
    const chart = usableCapacityChart(METRICS);
    expect(chart.labels).toEqual(['major injuries zone', 'minor injuries zone']);
    expect(chart.datasets.map((d) => d.label)).toEqual(['Usable spaces', 'Closed (blocked)']);
    expect(chart.datasets[0].data).toEqual([10, 4]);
    expect(chart.datasets[1].data).toEqual([0, 0]);
    expect(chart.varies).toBe(true);
  });

  test('pickups by hour draw one line per physician, busiest first, and a replay without them draws nothing', () => {
    const chart = physicianPickupsByHourChart(METRICS);
    expect(chart.labels).toEqual(['0–1 h', '1–2 h']);
    expect(chart.datasets.map((d) => d.label)).toEqual(['Doctor 1', 'Doctor 2']);
    expect(chart.datasets[0].data).toEqual([2, 1]);
    expect(chart.datasets.every((d) => !d.dashed)).toBe(true);
    expect(physicianPickupsByHourChart(OLD_METRICS).datasets).toEqual([]);
  });

  test('nurse load is patients in treatment spaces per bedside nurse, against the guide of four', () => {
    const chart = nurseLoadChart(METRICS);
    // Bucket 13: one patient waiting for a test, two bedside nurses.
    expect(chart.datasets[0].data[13]).toBe(0.5);
    expect(chart.datasets[0].data[0]).toBe(0);
    expect(chart.datasets[1]).toMatchObject({ dashed: true, data: Array(25).fill(NURSE_RATIO_GUIDE) });
  });

  test('the average nurse day is one bar per state, largest first, with the spread across nurses', () => {
    const rows = nurseStateBars(METRICS);
    expect(rows.map((r) => [r.label, r.mean, r.min, r.max])).toEqual([
      ['Idle', 60, 40, 80],
      ['With a patient', 45, 30, 60],
      ['Transferring a patient', 10, 0, 20],
      ['Testing with a patient', 5, 0, 10],
      ['Resting', 0, 0, 0],
    ]);
    const chart = nurseStateBarsChart(METRICS);
    expect(chart.labels[0]).toBe('Idle (50%)');
    expect(chart.datasets[0].data).toEqual([60, 45, 10, 5, 0]);
  });

  test('queue averages run over the whole day and rank the deepest queue first', () => {
    const rows = queueAverages(METRICS);
    expect(rows[0]).toMatchObject({ state: 'WAITING_FOR_NURSE', peakDepth: 2, owner: 'Space or bedside nurse' });
    // Two patients waited for a nurse over six of twenty-five buckets.
    expect(rows[0].meanDepth).toBeCloseTo(12 / 25, 10);
    // Oldest wait over those six buckets: 10, 15, 20, 25, 30, 35 minutes.
    expect(rows[0].meanOldest).toBeCloseTo(22.5, 10);
    expect(rows[0].peakOldest).toBe(35);
    expect(queueAverages(OLD_METRICS)[0].meanOldest).toBeUndefined();
    expect(queueDepthAverageChart(METRICS).labels[0]).toBe('Wait for nurse');
    expect(oldestWaitAverageChart(OLD_METRICS).datasets[0].data).toEqual([]);
  });

  test('the day bottleneck score ranks stations and names its driver', () => {
    const scores = bottleneckScoresOverDay(METRICS);
    expect(scores[0].state).toBe('WAITING_FOR_NURSE');
    expect(scores[0].score).toBeGreaterThan(scores[scores.length - 1].score);
    expect(scores.every((s) => s.reason.startsWith('driven by'))).toBe(true);
    expect(bottleneckScoreChart(METRICS).labels[0]).toBe('Wait for nurse');
  });

  test('zone needs spell out the reason and the share of waiting caused by space', () => {
    const needs = zoneNeeds(METRICS);
    expect(needs[0]).toMatchObject({ zone: 'major_bed', needs: 'a space' });
    expect(needs[0].spaceShare).toBeCloseTo(90 / 92, 10);
    expect(needs[0].why).toMatch(/^98% of the 1.5 h its patients waited for a space, no space was free/);
    expect(needs[1]).toMatchObject({ zone: 'minor_bed', needs: 'a nurse' });
    expect(needs[1].why).toMatch(/a space was free but no nurse could take them/);
    const chart = zoneNeedShareChart(METRICS);
    expect(chart.datasets.map((d) => d.label)).toEqual(['No space free', 'Space free, no nurse']);
    expect(chart.datasets[0].data[0] + chart.datasets[1].data[0]).toBeCloseTo(1, 10);
  });

  test('physician pickups are ranked largest first with share and rate per simulated hour', () => {
    expect(physicianPickupRows(METRICS)).toEqual([
      { name: 'Doctor 1', count: 3, share: 0.75, perHour: 1.5 },
      { name: 'Doctor 2', count: 1, share: 0.25, perHour: 0.5 },
    ]);
    expect(pressureSummary(starvationRows(METRICS)[0])).toBe('needs a space: of 2 h waiting for a space, 98% had no space free and 2% had a space but no nurse');
    expect(pressureSummary(undefined)).toBe('No starvation recorded');
  });

  test('starvation diverges from zero in hours: nurse-starved negative, bed-starved positive', () => {
    const chart = starvationChart(METRICS);
    expect(chart.labels).toEqual(['Major beds', 'Minor beds']);
    expect(chart.datasets[0].data.map((v) => Math.round(v * 60))).toEqual([-2, -25]);
    expect(chart.datasets[1].data.map((v) => Math.round(v * 60))).toEqual([90, 4]);
    expect(chart.datasets.every((d) => d.stack === 'starved')).toBe(true);
  });

  test('EDWIN is one line with the two Bernstein bands behind it', () => {
    expect(edwinChart(METRICS).datasets.map((d) => d.label)).toEqual(['EDWIN']);
    const bands = edwinBands(METRICS);
    expect(bands.map((b) => [b.from, b.to])).toEqual([[1.5, 2], [2, 2.5 * 1.05]]);
    expect(edwinChart(OLD_METRICS).datasets).toEqual([]);
  });

  test('the sampled targets behind "time over target" pool the per-level medians by n', () => {
    // doorToDoctor targets: 30 (n 2) and 50 (n 2) -> 40; the other two intervals carry none.
    expect(sampledTargetMedians(METRICS)).toEqual({ stage1: 40, stage2: undefined, stage3: undefined });
  });
});
