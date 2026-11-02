/**
 * How each number on the dashboard is computed (section 1.8 of the recommendations
 * document). Every tile and chart names one of these by id; the info control opens it,
 * and the 1.8 Information tab lists them grouped by the tab each metric sits on.
 *
 * `section` is the dashboard tab (`./metricsTabs`), which follows the document's own
 * numbering: 1.1 flow, 1.2 waits, 1.3 outcomes, 1.4 bottlenecks, 1.5 staffing, 1.6
 * comparison, 1.7 health. The Overview repeats headline tiles from these tabs and names
 * the tab each belongs to. The arithmetic lives in reverie/edview_replay/metrics.py;
 * keep the wording here in step with that file, and docs/metrics-traceability.md
 * carries the file-and-line trail for every entry.
 */
import type { MetricsTabId } from './metricsTabs';

/** A tab a metric can sit on: every tab but the Information tab itself. */
export type MethodSection = Exclude<MetricsTabId, 'method'>;

export interface MethodEntry {
  title: string;
  /** Where the clock starts and ends, or what is counted. */
  computation: string;
  population: string;
  source: string;
  /** The dashboard tab the metric sits on; a metric on several tabs names the one that explains it. */
  section: MethodSection;
  /** Built in the engine's metrics block, derived in the viewer, or an approximation. */
  status: 'built' | 'derived' | 'approximate';
}

export const METHODS: Record<string, MethodEntry> = {
  // ── 1.1 Patient flow ───────────────────────────────────────────────────────────────
  cohort: {
    title: 'Patients of the day',
    computation: 'Everyone who arrived during the simulated day, plus anyone already in the department when it started. Completed means treated and gone out through the exit; still in the ED means the day ended before they left; left without being seen means they walked out before a physician saw them, counted as a share of everyone who departed.',
    population: 'Every patient of the day',
    source: 'data_collection.json: Patient; Metrics.cohort',
    section: 'flow',
    status: 'built',
  },
  arrivals: {
    title: 'Arrivals and departures per hour',
    computation: 'Arrivals are counted in the hour they walk in, split by triage level. Departures are counted in the hour they leave, split into discharged home, admitted to a ward, and left without being seen. Patients already present at the start are not arrivals.',
    population: 'Every patient of the day',
    source: 'Metrics.hourly.arrivalsByCtas, departures, departuresByDisposition',
    section: 'flow',
    status: 'built',
  },
  census: {
    title: 'Census by CTAS',
    computation: 'At every 5-minute mark, the number of patients in the department (arrived and not yet left), split by triage level. Peak census is the highest point of the day.',
    population: 'Patients present at that moment',
    source: 'Metrics.series.census, censusByCtas',
    section: 'flow',
    status: 'built',
  },
  censusByZone: {
    title: 'Census by zone',
    computation: 'Once an hour the simulation notes which treatment spaces are occupied in each zone; the bars are those counts, including patients who were already there when the day began.',
    population: 'Every occupied space, whoever holds it',
    source: 'bed_occupancy.jsonl; Metrics.beds[zone].active',
    section: 'flow',
    status: 'built',
  },

  phaseCensus: {
    title: 'Where the patients are',
    computation: 'The census split by place: still in the waiting area (before a treatment space), in a treatment space being worked up, or finished with treatment and waiting to leave or for a ward bed. The three bands add up to everyone present.',
    population: 'Patients present at that moment',
    source: 'Metrics.series.byState',
    section: 'flow',
    status: 'derived',
  },
  netFlow: {
    title: 'Hourly net flow and backlog',
    computation: 'Arrivals minus departures in each hour, and the running total of that difference: how many more patients are in the department than when the day started.',
    population: 'Every patient of the day',
    source: 'Metrics.hourly.arrivalsByCtas, departures',
    section: 'flow',
    status: 'derived',
  },
  // ── 1.2 Waits ──────────────────────────────────────────────────────────────────────
  waitingByState: {
    title: 'Waiting count by state',
    computation: 'At every 5-minute mark, how many patients are waiting at each step: for triage, for registration, for a treatment space, for the physician\'s first assessment, for a test, for a result, for the physician to return, and to leave. Stacked, so the top edge is everyone waiting.',
    population: 'Patients present and waiting',
    source: 'data_collection.json: Patient.state_entered_at; Metrics.series.byState',
    section: 'waits',
    status: 'built',
  },
  stageWaits: {
    title: 'Stage waits',
    computation: 'Six intervals of a visit, measured from the time stamps the simulation records: arrival to triage, arrival to a treatment space, arrival to the physician, physician to the decision to admit or discharge, that decision to leaving, and total time in the department. By level: the median (the typical patient) and the 90th percentile (the slow tail). Pooled: every level together, weighted by how many patients each level had, longest first.',
    population: 'Patients who reached that point; the last two intervals only patients who left',
    source: 'Metrics.stageWaits, compliance.ctasTargetMinutes',
    section: 'waits',
    status: 'built',
  },
  ahsWait: {
    title: 'ED wait time to see a doctor (AHS measure)',
    computation: 'Alberta Health Services measures this from triage to the moment a physician takes the patient on, and the dashboard uses the same clock so the number compares with the published AHS figure. Median and 90th percentile.',
    population: 'Every patient who reached a physician, all triage levels together',
    source: 'Metrics.ahs.waitToSeeDoctor',
    section: 'waits',
    status: 'derived',
  },
  arrivalToTriage: {
    title: 'Arrival to triage',
    computation: 'Minutes from walking in to the start of triage, per triage level. CTAS expects triage to start within 10 minutes of arrival.',
    population: 'Every patient who was triaged',
    source: 'Metrics.stageWaits.doorToTriage, compliance.triagedWithin10',
    section: 'waits',
    status: 'built',
  },
  stateMinutes: {
    title: 'Minutes in a step (registration, treatment phase)',
    computation: 'The simulation keeps a clock of how long each patient spends in each step. These are the averages per triage level for the registration steps, and for the treatment steps: waiting for a test, going for a test, waiting for a result, waiting for the physician to return.',
    population: 'Every patient who entered the step; a patient still in it at the end counts the time so far',
    source: 'data_collection.json: Patient.time_spent_state; Metrics.stateMinutes',
    section: 'waits',
    status: 'derived',
  },
  stage1Components: {
    title: 'Time before the physician',
    computation: 'The time from arrival to the physician, split by what the patient was waiting for. The four-part view groups it by stage: triage (waiting and the handover), registration (waiting and service), waiting for a treatment space (no space free, a space free but no nurse, the escort to it), and waiting for the physician once in the space (a scenario-set minimum wait plus the real wait). The nine-part view shows each of those parts on its own. Averages per triage level; the parts add up to the whole.',
    population: 'Every patient a physician took on',
    source: 'stage1_components.csv; Metrics.stage1Components',
    section: 'waits',
    status: 'built',
  },

  // ── 1.3 Outcomes ───────────────────────────────────────────────────────────────────
  disposition: {
    title: 'Disposition mix',
    computation: 'How the completed visits ended: discharged home or admitted to a ward. Left without being seen is counted against everyone who departed; still in the ED is the number the day ended on.',
    population: 'Every patient of the day who departed',
    source: 'Metrics.cohort',
    section: 'outcomes',
    status: 'built',
  },
  ahsAdmitted: {
    title: 'Total time in ED, admitted patients (AHS measure)',
    computation: 'For patients admitted to a ward, the time from triage to leaving the emergency department, the way AHS reports it. Median and 90th percentile.',
    population: 'Admitted patients who left the department during the day',
    source: 'Metrics.ahs.admittedTotalTime',
    section: 'outcomes',
    status: 'derived',
  },
  withinTarget: {
    title: 'Seen within CTAS target',
    computation: 'The share of each triage level seen by a physician within the CTAS time objective: 15 minutes for level 2, 30 for level 3, 60 for level 4, 120 for level 5. Level 1 is meant to be immediate, so it is shown as the share seen within 10 minutes.',
    population: 'Every patient who reached a physician',
    source: 'Metrics.compliance.withinCtasTarget',
    section: 'outcomes',
    status: 'built',
  },
  lengthOfStayBenchmarks: {
    title: 'Discharged within 4 h and admitted within 8 h',
    computation: 'Of the discharged patients, the share who left within 4 hours of arriving; of the admitted patients, the share who left the department within 8 hours. Patients still present at the end are not counted.',
    population: 'Patients who left during the day',
    source: 'Metrics.compliance.dischargedWithin4h, admittedWithin8h',
    section: 'outcomes',
    status: 'built',
  },
  lwbs: {
    title: 'Left without being seen',
    computation: 'Patients who walked out before a physician saw them. In the simulation, each waiting patient periodically decides whether to stay. The chart counts those who left per triage level; the note says which step they left from and how long they had waited.',
    population: 'Every patient of the day',
    source: 'Metrics.walkouts',
    section: 'outcomes',
    status: 'derived',
  },
  diagnostics: {
    title: 'Diagnostics',
    computation: 'The share of each triage level that had a test ordered, and the time from the order to the result coming back. The queue chart shows how many patients are waiting for a test, out for a test, or waiting for a result at each moment.',
    population: 'Every patient of the day; turnaround only for results that came back',
    source: 'Metrics.diagnostics, series.byState',
    section: 'outcomes',
    status: 'derived',
  },
  surgeRecovery: {
    title: 'Surge recovery time',
    computation: 'After the busiest arrival hour, how long until the number of patients present and the number waiting are both back within 10% of where they were in the hour before the surge.',
    population: 'Patients present',
    source: 'Metrics.series.census, byState, hourly.arrivalsByCtas',
    section: 'outcomes',
    status: 'derived',
  },
  throughputBalance: {
    title: 'Throughput balance',
    computation: 'Departures divided by arrivals, hour by hour. Below 1 the department takes in more than it sends out and the backlog grows; above 1 it is catching up.',
    population: 'Every patient of the day',
    source: 'Metrics.hourly',
    section: 'outcomes',
    status: 'derived',
  },

  // ── 1.4 Bottlenecks ────────────────────────────────────────────────────────────────
  queueSnapshot: {
    title: 'Patients waiting and longest wait by station',
    computation: 'At every 5-minute mark the simulation knows who is waiting at each step and for how long. Patients waiting is the average of that count over the whole day; longest wait is how long the longest-waiting patient had been there, averaged over the moments someone was waiting. Both are ranked so the biggest queue is at the top.',
    population: 'Every patient of the day, at every moment they waited',
    source: 'Metrics.series.byState, oldestWaitByState',
    section: 'bottlenecks',
    status: 'derived',
  },
  componentRanking: {
    title: 'Where the pre-physician time goes',
    computation: 'The parts of the time before the physician (see Time before the physician) added up over every patient and ranked, so the biggest cause of waiting before the physician is at the top.',
    population: 'Every patient a physician took on',
    source: 'Metrics.stage1Components',
    section: 'bottlenecks',
    status: 'derived',
  },
  overTarget: {
    title: 'Time over target by stage',
    computation: 'Each patient in the run carries its own target time for three stages (arrival to physician, physician to decision, decision to departure), drawn from the hospital\'s historical pattern when the run was set up. This is how far the actual stage ran over that target, on average and for the slow tail. Running over means congestion, not a slow process by design.',
    population: 'Patients who left during the day',
    source: 'completed_patient_stage_times.csv; Metrics.elapsedOverTarget; the scenario file\'s arrivals[].stage_targets_minutes',
    section: 'bottlenecks',
    status: 'built',
  },
  bottleneckScore: {
    title: 'Bottleneck score by station',
    computation: 'A 0-to-1 score for each waiting step over the whole day, combining three things, each scaled against the other steps: the average number waiting, the average length of the longest wait, and how busy the resource that clears the step was. The highest score is the day\'s bottleneck, and the note says which of the three drove each score.',
    population: 'Every patient of the day; the staff on duty',
    source: 'Metrics.series, stateMinutes, staff',
    section: 'bottlenecks',
    status: 'approximate',
  },
  eip: {
    title: 'Emergency inpatients (EIP)',
    computation: 'An emergency inpatient is a patient the physician has decided to admit who is still in the ED: counted from the disposition until they are out of the door, whether they are boarding in a bed or waiting to go up. The Overview shows the average count over the day and the highest count at once; the chart shows it at every moment.',
    population: 'Admitted patients present after their disposition, every 5 minutes',
    source: 'Metrics.series.eip',
    section: 'bottlenecks',
    status: 'built',
  },
  edwin: {
    title: 'EDWIN crowding score',
    computation: 'A published crowding index. Every present patient counts by acuity (CTAS 1 counts 5, down to CTAS 5 counting 1); the total is divided by the number of physicians on duty times the number of usable treatment spaces. Bands from the published scale: under 1.5 not busy, 1.5 to 2 busy, over 2 overcrowded.',
    population: 'Patients present at that moment; spaces from the latest bed count',
    source: 'Metrics.series.edwin; bed_occupancy.jsonl; meta starting_amount',
    section: 'bottlenecks',
    status: 'built',
  },
  blockedCapacity: {
    title: 'Usable capacity by zone',
    computation: 'Each zone\'s treatment spaces split into those usable and those closed (out of service) during the run.',
    population: 'Every space',
    source: 'bed_occupancy.jsonl; Metrics.beds[zone].capacity, blocked',
    section: 'bottlenecks',
    status: 'built',
  },

  // ── 1.5 Staffing ───────────────────────────────────────────────────────────────────
  starvation: {
    title: 'What each zone needs',
    computation: 'For every patient waiting for a treatment space, the simulation records whether the wait was because no space was free, or because a space was free but no nurse could take them. Summed per zone and shown in hours. The larger cause is the need: mostly no space free means a space (open one, or free one sooner through faster discharge or transfer) and another nurse would not help; mostly no nurse means a nurse or a faster handover, and a space would not help.',
    population: 'Every patient of the day, by the zone they were sent to',
    source: 'data_collection.json nurse_or_priority_wait_minutes, resource_blocked_minutes; Metrics.starvationByZone',
    section: 'staffing',
    status: 'built',
  },
  nurseUtilization: {
    title: 'Bedside nurse utilization',
    computation: 'The share of each bedside nurse\'s day spent tied to a patient (bringing them to a space, moving them, or in testing) rather than idle or resting, from the simulation\'s record of what each nurse was doing. The team figure pools all the nurses; the average-nurse chart shows the typical day\'s minutes per state, with the spread between the least and most loaded nurse. Monitoring a settled patient is not counted as tied to a patient.',
    population: 'Every bedside nurse on duty',
    source: 'data_collection.json: BedsideNurse.State_Durations; Metrics.staff.nurseMinutes',
    section: 'staffing',
    status: 'built',
  },
  nurseLoad: {
    title: 'Bedside nurse load over the day',
    computation: 'The number of patients in treatment spaces at each moment divided by the bedside nurses on duty: how many patients each nurse is covering. The dashed line marks four patients per nurse, a common emergency-department staffing guide. The simulation does not record what each nurse is doing minute by minute, so this is the load carried rather than a measured activity curve.',
    population: 'Patients in treatment spaces; the bedside nurses on duty',
    source: 'Metrics.series.byState, staff.bedsideNurses',
    section: 'staffing',
    status: 'approximate',
  },
  physicianLoad: {
    title: 'Physician load and pickups',
    computation: 'Load is the number of patients under physician care at each moment (from the first assessment to the decision) divided by the physicians on duty, against the number each physician is allowed to carry. Pickups per hour counts, for each physician, the patients they took on in each hour of the day.',
    population: 'Patients present; every physician on duty',
    source: 'Metrics.series.byState, staff.doctors, doctorMaxPatients, doctorPatientsSeen',
    section: 'staffing',
    status: 'approximate',
  },
  triageClerkLoad: {
    title: 'Triage nurse and clerk load',
    computation: 'Utilization is the total minutes of triage (or registration) done during the day divided by the minutes the triage nurses (or clerks) on duty had available. The load charts show the queue for each step stacked on the patients being served at that moment.',
    population: 'Every patient of the day; the triage nurses and clerks on duty',
    source: 'Metrics.series.byState, stateMinutes, staff',
    section: 'staffing',
    status: 'derived',
  },
  zoneOccupancy: {
    title: 'Occupancy by zone',
    computation: 'Once an hour, the share of each zone\'s usable spaces that are occupied. A zone on the dashed line is full.',
    population: 'Every occupied space, whoever holds it',
    source: 'bed_occupancy.jsonl; Metrics.beds',
    section: 'staffing',
    status: 'derived',
  },

  // ── 1.6 Compare runs ───────────────────────────────────────────────────────────────
  changeBand: {
    title: 'Change legend (comparison)',
    computation: 'A metric that moved 3% or more in the desirable direction counts as an improvement, 3% or more the wrong way as a deterioration, and anything smaller as stable: the same convention as the AHS annual report.',
    population: 'The two runs being compared',
    source: 'AHS 2024-25 Annual Report legend',
    section: 'compare',
    status: 'derived',
  },

  // ── 1.7 Run health ─────────────────────────────────────────────────────────────────
  llmCost: {
    title: 'Model cost and calls',
    computation: 'What the simulation\'s language model cost to run, how much text it read and wrote, and how many decisions it was asked to make, from the run\'s own usage log.',
    population: 'The whole run',
    source: 'llm_usage_chunks.json (cost_estimate_usd, tokens); openai_config.json model-costs',
    section: 'health',
    status: 'built',
  },
  fallbackRate: {
    title: 'Fallback rate',
    computation: 'How often the model\'s answer was unusable and the simulation fell back on a built-in rule instead. A high rate means fewer decisions were the model\'s own.',
    population: 'Every decision the model was asked for',
    source: 'llm_usage_chunks.json',
    section: 'health',
    status: 'built',
  },
  wallClock: {
    title: 'Wall-clock time and speed',
    computation: 'How long the computer took to run the day, and how many simulated hours that is per real hour.',
    population: 'The whole run',
    source: 'reverie/benchmark.json; llm_usage_chunks.json; reverie/meta.json',
    section: 'health',
    status: 'derived',
  },
  runValidity: {
    title: 'Run validity',
    computation: 'Whether the run finished cleanly and is fit to be cited: how it ended, which model and settings it used, and whether it was marked eligible for analysis.',
    population: 'The whole run',
    source: 'run_summary.json; run_manifest.json',
    section: 'health',
    status: 'built',
  },
};

export const METHOD_IDS = Object.keys(METHODS);

export function methodsForSection(section: MethodSection): [string, MethodEntry][] {
  return Object.entries(METHODS).filter(([, m]) => m.section === section);
}
