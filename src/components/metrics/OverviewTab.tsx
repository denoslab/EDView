/**
 * The landing tab: the headline measures as the year against this run, then the summary
 * charts of the day. Each section tab breaks these down further and draws nothing the
 * Overview already shows.
 */
import { useMemo } from 'react';
import type { ReplayMetrics } from '@/replay/types';
import { arrivalsChart, censusChart, departuresByDispositionChart, outcomeTiles, peakCensus } from '@/replay/metricsSelectors';
import {
  HEADLINE_KEYS,
  HEADLINE_KINDS,
  YEAR_REFERENCE,
  headlineLabel,
  headlineValues,
  nurseLoadChart,
  nurseUtilization,
  physicianLoadChart,
  pressureSummary,
  starvationChart,
  starvationRows,
  throughputBalanceChart,
  yearDeltaLabel,
} from '@/replay/metricsDerived';
import type { HeadlineKey } from '@/replay/metricsDerived';
import { BarChart, Caption, CompareGrid, Empty, LineChart, Panel, Row, Tile, Tiles, hasAny, shareLabel } from './primitives';
import type { CompareColumn } from './primitives';

/** Each headline column's title and the entry its info control opens. */
const HEADLINE_COLUMNS: Record<HeadlineKey, { title: string; method: string }> = {
  waitToSeeDoctor: { title: 'Wait to see a doctor', method: 'ahsWait' },
  admittedTotalTime: { title: 'Time in ED, admitted', method: 'ahsAdmitted' },
  withinTarget: { title: 'Seen within CTAS target', method: 'withinTarget' },
  lwbs: { title: 'Left without being seen', method: 'lwbs' },
  admitted: { title: 'Admitted', method: 'disposition' },
  dischargedWithin4h: { title: 'Discharged within 4 h', method: 'lengthOfStayBenchmarks' },
  admittedWithin8h: { title: 'Admitted within 8 h', method: 'lengthOfStayBenchmarks' },
  eip: { title: 'Emergency inpatients (EIP)', method: 'eip' },
};

/** Row 1 is the year figure, row 2 this run with its distance from the year. */
function headlineColumns(metrics: ReplayMetrics): CompareColumn[] {
  const run = headlineValues(metrics);
  return HEADLINE_KEYS.map((key) => {
    const kind = HEADLINE_KINDS[key];
    const year = YEAR_REFERENCE[key];
    const value = run[key];
    const delta = yearDeltaLabel(kind, value.value, year);
    return {
      key,
      ...HEADLINE_COLUMNS[key],
      cells: [
        year
          ? {
              value: headlineLabel(kind, year.value),
              qualifier: `${year.stat}, ${year.scope}`,
              note: year.max !== undefined ? `max ${year.max} · ${year.cite}` : year.cite,
              hint: year.source,
            }
          : { value: '--', qualifier: 'no year figure yet' },
        {
          value: headlineLabel(kind, value.value),
          qualifier: value.qualifier,
          note: [delta, value.note].filter(Boolean).join(' · ') || undefined,
        },
      ],
    };
  });
}

export function OverviewTab({ metrics }: { metrics: ReplayMetrics }) {
  const headline = useMemo(() => headlineColumns(metrics), [metrics]);
  const tiles = useMemo(() => Object.fromEntries(outcomeTiles(metrics).map((t) => [t.key, t])), [metrics]);
  const peak = useMemo(() => peakCensus(metrics), [metrics]);
  const census = useMemo(() => censusChart(metrics), [metrics]);
  const arrivals = useMemo(() => arrivalsChart(metrics, { withDepartures: false }), [metrics]);
  const departures = useMemo(() => departuresByDispositionChart(metrics), [metrics]);
  const balance = useMemo(() => throughputBalanceChart(metrics), [metrics]);
  const pressureRows = useMemo(() => starvationRows(metrics), [metrics]);
  const pressure = useMemo(() => starvationChart(metrics), [metrics]);
  const nurseLoad = useMemo(() => nurseLoadChart(metrics), [metrics]);
  const physicianLoad = useMemo(() => physicianLoadChart(metrics), [metrics]);
  const nurses = useMemo(() => nurseUtilization(metrics), [metrics]);
  const { cohort } = metrics;
  const top = pressureRows[0];

  return (
    <>
      <CompareGrid rows={['Year', 'This run']} columns={headline} />
      <Caption>
        The year row is the published or reported figure closest to Rockyview for each measure, named under its value
        (hover for the full source); a dash means no year figure yet. Rockyview&apos;s own year numbers replace these as
        they arrive. The run row says how far this day sits from the year.
      </Caption>
      <Tiles>
        <Tile title={tiles.enrolled.title} value={tiles.enrolled.value} qualifier={tiles.enrolled.qualifier} note={`${cohort.completed} completed · ${cohort.censored} still in the ED at the end`} method="cohort" />
        <Tile title="Peak census" value={`${peak.value}`} qualifier="patients present at once" note={`at ${peak.at} after the start`} method="census" />
      </Tiles>
      <Row>
        <Panel
          title="Census by CTAS"
          method="census"
          reading="Bands are the levels stacked; the black line is everyone present. A band that keeps widening is a level the department is not clearing. The 1.1 tab shows where those patients are and how the day's arrivals and departures net out."
        >
          <LineChart series={census} yTitle="Patients in the ED" stacked />
        </Panel>
        <Panel
          title="Arrivals per hour by CTAS"
          method="arrivals"
          reading="The demand curve every other chart is read against; the colours are the CTAS code used on every chart that splits by level."
        >
          <BarChart series={arrivals} yTitle="Patients" stacked />
        </Panel>
      </Row>
      <Row>
        <Panel
          title="Departures per hour by disposition"
          method="arrivals"
          reading="Green went home, blue went to a ward, red left before a physician saw them. Hours where this chart sits below the arrivals beside it are hours the backlog grew."
        >
          {departures.datasets.length ? <BarChart series={departures} yTitle="Patients" stacked /> : <Empty>This replay was built without the disposition split.</Empty>}
        </Panel>
        <Panel
          title="Throughput balance (departures ÷ arrivals per hour)"
          method="throughputBalance"
          reading="Below the dashed line for a sustained period means the department is falling behind; above it, the backlog is clearing."
        >
          <LineChart series={balance} yTitle="Ratio" xTitle="Simulated hour" />
        </Panel>
      </Row>
      <Row>
        <Panel
          title="Pressure by zone: no space free against no nurse free"
          method="starvation"
          reading="Bars diverge from zero: orange to the right is hours patients waited because no space was free, green to the left is hours a space was free but no nurse could take them. The longer side is what the zone needs. The 1.5 tab explains each zone's answer."
          note={top ? `${top.label} is under the most pressure and ${pressureSummary(top)}.` : undefined}
        >
          {hasAny(pressure) ? <BarChart series={pressure} yTitle="Hours across the patients routed to the zone" horizontal diverging /> : <Empty>No starvation recorded in this replay.</Empty>}
        </Panel>
      </Row>
      <Row>
        <Panel
          title="Physician load (patients assigned per physician)"
          method="physicianLoad"
          reading="Patients under physician care at each moment divided by the physicians on duty, against the dashed limit each can carry. Load at the limit while patients wait for a physician is the physician constraint; the 1.5 tab shows each physician's pickups by hour."
        >
          <LineChart series={physicianLoad} yTitle="Patients per physician" />
        </Panel>
        <Panel
          title="Bedside nurse load over the day"
          method="nurseLoad"
          reading="Patients in treatment spaces per bedside nurse at each moment, against a guide of four. Time above the dashed line is time the nurses were stretched; the 1.5 tab shows how the average nurse's day was actually spent."
          note={nurses.team !== undefined ? `Measured over the day: ${shareLabel(nurses.team)} of the ${metrics.staff.bedsideNurses} bedside nurses' minutes were tied to a patient.` : undefined}
        >
          <LineChart series={nurseLoad} yTitle="Patients per nurse" />
        </Panel>
      </Row>
    </>
  );
}
