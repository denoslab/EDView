/**
 * A two-hour replay `Metrics` block in 5-minute buckets, shaped as
 * reverie/edview_replay/metrics.py emits it with every derivable block present. Shared
 * by the derived, compare and health selector tests.
 */
import type { ReplayMetrics } from '@/replay/types';

const BUCKETS = 25; // 0:00 to 2:00 inclusive
const zeros = () => Array<number>(BUCKETS).fill(0);
const fill = (from: number, to: number, value = 1): number[] =>
  zeros().map((_, i) => (i >= from && i < to ? value : 0));

const census = zeros().map((_, i) => (i < 6 ? 1 : i < 12 ? 3 : i < 20 ? 2 : 1));

export const METRICS: ReplayMetrics = {
  version: 1,
  cohort: { enrolled: 6, completed: 3, censored: 2, lwbs: 1, admitted: 1 },
  axis: {
    t0: 'October 01, 2025, 06:00:00',
    tEnd: 'October 01, 2025, 08:00:00',
    bucketMinutes: 5,
    buckets: BUCKETS,
    hours: 2,
  },
  series: {
    census,
    censusByCtas: { '1': zeros(), '2': fill(6, 20), '3': census.map((v, i) => (i >= 6 && i < 20 ? v - 1 : v)), '4': zeros(), '5': zeros() },
    byState: {
      WAITING_FOR_TRIAGE: fill(0, 4, 1),
      TRIAGE: fill(4, 6, 1),
      WAITING_FOR_NURSE: fill(6, 12, 2),
      WAITING_FOR_TEST: fill(12, 14, 1),
      GOING_FOR_TEST: zeros(),
      WAITING_FOR_RESULT: fill(14, 18, 1),
      WAITING_FOR_DOCTOR: fill(18, 20, 1),
      WAITING_FOR_BOARDING_BED: fill(20, 22, 1),
      ADMITTED_BOARDING: fill(22, 25, 1),
    },
    boarders: fill(20, 25, 1),
    // One admitted patient from 1:30, a second from 1:50: mean 10/25, peak 2 at 1:50.
    eip: zeros().map((_, i) => (i >= 22 ? 2 : i >= 18 ? 1 : 0)),
    edwin: zeros().map((_, i) => (i < 6 ? 0.5 : i < 12 ? 2.4 : 1.6)),
    oldestWaitByState: {
      WAITING_FOR_TRIAGE: fill(0, 4, 1).map((v, i) => v * i * 5),
      WAITING_FOR_NURSE: fill(6, 12, 1).map((v, i) => v * (i - 6) * 5 + (i >= 6 && i < 12 ? 10 : 0)),
      WAITING_FOR_RESULT: fill(14, 18, 1).map((v) => v * 7),
      WAITING_FOR_DOCTOR: zeros(),
    },
  },
  hourly: {
    arrivalsByCtas: { '1': [0, 0], '2': [1, 1], '3': [3, 1], '4': [0, 0], '5': [0, 0] },
    departures: [1, 3],
    departuresByDisposition: { discharged: [0, 2], admitted: [0, 1], lwbs: [1, 0] },
  },
  stageWaits: {
    doorToTriage: { '2': { n: 2, median: 8, p90: 12, mean: 9 }, '3': { n: 4, median: 12, p90: 20, mean: 13 } },
    doorToBed: { '2': { n: 2, median: 30, p90: 40, mean: 32 }, '3': { n: 2, median: 50, p90: 55, mean: 50 } },
    doorToDoctor: { '2': { n: 2, median: 40, p90: 45, mean: 40, targetMedian: 30 }, '3': { n: 2, median: 60, p90: 70, mean: 62.5, targetMedian: 50 } },
    doctorToDisposition: { '2': { n: 1, median: 80, p90: 80, mean: 80 }, '3': { n: 2, median: 55, p90: 60, mean: 55 } },
    dispositionToDeparture: { '2': { n: 1, median: 260, p90: 260, mean: 260 }, '3': { n: 2, median: 10, p90: 12, mean: 10 } },
    lengthOfStay: { '2': { n: 1, median: 380, p90: 380, mean: 380 }, '3': { n: 2, median: 125, p90: 130, mean: 125 } },
  },
  compliance: {
    ctasTargetMinutes: { '1': 0, '2': 15, '3': 30, '4': 60, '5': 120 },
    withinCtasTarget: {
      '2': { n: 2, within5: 0, within10: 0, share: 0 },
      '3': { n: 2, within5: 0, within10: 0, share: 0.5 },
    },
    triagedWithin10: { n: 6, share: 0.5 },
    dischargedWithin4h: { n: 2, share: 1 },
    admittedWithin8h: { n: 1, share: 1 },
  },
  staff: {
    doctors: 2,
    doctorMaxPatients: 4,
    bedsideNurses: 2,
    triageNurses: 1,
    clerks: 1,
    nurseMinutes: {
      'Bedside Nurse 1': { WITH_PATIENT: 60, TRANSFER_WITH_PATIENT: 20, TESTING_WITH_PATIENT: 0, IDLE: 40, RESTING: 0 },
      'Bedside Nurse 2': { WITH_PATIENT: 30, TRANSFER_WITH_PATIENT: 0, TESTING_WITH_PATIENT: 10, IDLE: 80, RESTING: 0 },
    },
    doctorPatientsSeen: { 'Doctor 1': 3, 'Doctor 2': 1 },
    doctorPickupsByHour: { 'Doctor 1': [2, 1], 'Doctor 2': [1, 0] },
  },
  stage1Components: {
    '2': { n: 2, triage_wait: 5, triage: 2, registration_wait: 1, registration: 4, resource_blocked: 20, nurse_or_priority_wait: 3, transport_walk: 1, target_hold: 0, clinician_wait: 4 },
    '3': { n: 2, triage_wait: 10, triage: 2, registration_wait: 3, registration: 5, resource_blocked: 30, nurse_or_priority_wait: 4, transport_walk: 1, target_hold: 5, clinician_wait: 2 },
  },
  elapsedOverTarget: { stage1: { n: 3, mean: 8, p90: 11.2 }, stage2: { n: 3, mean: 3, p90: 7 }, stage3: { n: 3, mean: 10, p90: 20 } },
  beds: {
    'major injuries zone': { hours: [0, 1, 2], capacity: [10, 10, 10], active: [3, 5, 6], blocked: [1, 1, 0], fastTrackAvailable: [0, 0, 0], available: [6, 4, 4], boarders: [0, 0, 1] },
    'minor injuries zone': { hours: [0, 1, 2], capacity: [4, 4, 4], active: [1, 2, 2], blocked: [0, 0, 0], fastTrackAvailable: [0, 0, 0], available: [3, 2, 2], boarders: [0, 0, 0] },
  },
  ahs: {
    waitToSeeDoctor: { n: 4, median: 42.5, p90: 60, mean: 45 },
    admittedTotalTime: { n: 1, median: 375, p90: 375, mean: 375 },
  },
  walkouts: { byCtas: { '3': { n: 1, median: 35, p90: 35, mean: 35 } }, byState: { WAITING_FOR_NURSE: 1 } },
  starvationByZone: {
    major_bed: { n: 3, nurseStarvedMinutes: 2, bedStarvedMinutes: 90 },
    minor_bed: { n: 2, nurseStarvedMinutes: 25, bedStarvedMinutes: 4 },
  },
  stateMinutes: {
    TRIAGE: { '2': { n: 2, median: 3, p90: 3, mean: 3 }, '3': { n: 4, median: 3, p90: 4, mean: 3.5 } },
    WAITING_FOR_REGISTRATION: { '2': { n: 2, median: 1, p90: 2, mean: 1.5 }, '3': { n: 3, median: 4, p90: 6, mean: 4 } },
    REGISTRATION: { '2': { n: 2, median: 5, p90: 5, mean: 5 }, '3': { n: 3, median: 5, p90: 5, mean: 5 } },
    WAITING_FOR_RESULT: { '2': { n: 1, median: 12, p90: 12, mean: 12 } },
    LEAVING: { '2': { n: 1, median: 10, p90: 10, mean: 10 }, '3': { n: 2, median: 5, p90: 5, mean: 5 } },
  },
  boarding: { n: 1, boardedInBedShare: 1, transferWait: { n: 1, median: 15, p90: 15, mean: 15 } },
  diagnostics: {
    byCtas: { '2': { n: 2, tested: 2, share: 1 }, '3': { n: 4, tested: 1, share: 0.25 } },
    turnaround: { n: 2, median: 27, p90: 30, mean: 27.5 },
  },
  runHealth: {
    costUsd: 0.0114,
    tokens: { prompt: 9232, completion: 7964 },
    callsByChannel: { test_ordering: 2, triage_work_plan: 6 },
    fallbacks: { 'test_ordering:schema': 1 },
    transportRetries: 4,
    latency: { count: 8, totalSeconds: 16, maxSeconds: 5, meanSeconds: 2 },
    observedModels: { 'gpt-5.6-luna': 8 },
    chunks: [
      { index: 0, bootStep: 0, endStep: 720, costUsd: 0.005, wallSeconds: 60, observedSteps: 720, quietEligibleSteps: 100, transportRetries: 1 },
      { index: 1, bootStep: 720, endStep: 1440, costUsd: 0.0064, wallSeconds: 60, observedSteps: 720, quietEligibleSteps: 260, transportRetries: 3 },
    ],
    wallClockSeconds: 120,
    simulatedHours: 2,
    speedFactor: 60,
    quietFraction: 0.25,
    seed: 7501,
    map: 'small_ed_layout',
    template: 'small_ed_n5',
    useLlm: true,
    runValid: true,
    invalidReasons: [],
    terminationReason: 'cohort_complete',
    finalStep: 1440,
    chatModel: 'gpt-5.6-luna',
    dialogueMode: 'single_pass',
    scenarioFamily: 'fam_dev_small',
    runPurpose: 'dev',
    analysisEligible: false,
    channelFlags: { dialogue: true, selection: true, test_ordering: true },
  },
};

/** The same run without any derivable block, as a replay built before they existed. */
export const OLD_METRICS: ReplayMetrics = {
  version: 1,
  cohort: METRICS.cohort,
  axis: METRICS.axis,
  series: { census: METRICS.series.census, censusByCtas: METRICS.series.censusByCtas, byState: METRICS.series.byState, boarders: METRICS.series.boarders },
  hourly: { arrivalsByCtas: METRICS.hourly.arrivalsByCtas, departures: METRICS.hourly.departures },
  stageWaits: METRICS.stageWaits,
  compliance: {
    ctasTargetMinutes: METRICS.compliance.ctasTargetMinutes,
    withinCtasTarget: METRICS.compliance.withinCtasTarget,
    dischargedWithin4h: METRICS.compliance.dischargedWithin4h,
    admittedWithin8h: METRICS.compliance.admittedWithin8h,
  },
  staff: { doctors: 2, doctorMaxPatients: 4, bedsideNurses: 2, triageNurses: 1, clerks: 0, nurseMinutes: {} },
};
