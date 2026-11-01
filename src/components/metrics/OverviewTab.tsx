/**
 * The landing tab: the headline tiles and the summary charts of the day. Each section tab
 * breaks these down further and draws nothing the Overview already shows.
 */
import { useMemo } from 'react';
import type { ReplayMetrics } from '@/replay/types';
import {
  arrivalsChart,
  censusChart,
  departuresByDispositionChart,
  outcomeTiles,
  peakCensus,
  percent,
  stageWaitChart,
  stageWaitCounts,
} from '@/replay/metricsSelectors';
import {
  ahsMeasures,
  edwinBand,
  edwinBands,
  edwinChart,
  nurseLoadChart,
  nurseUtilization,
  physicianLoadChart,
  pressureSummary,
  starvationChart,
  starvationRows,
  throughputBalanceChart,
} from '@/replay/metricsDerived';
import { BarChart, Empty, LineChart, Panel, Row, Tile, Tiles, hasAny, hoursLabel, shareLabel } from './primitives';

export function OverviewTab({ metrics }: { metrics: ReplayMetrics }) {
  const [wait, admittedTime] = useMemo(() => ahsMeasures(metrics), [metrics]);
  const tiles = useMemo(() => Object.fromEntries(outcomeTiles(metrics).map((t) => [t.key, t])), [metrics]);
  const peak = useMemo(() => peakCensus(metrics), [metrics]);
  const census = useMemo(() => censusChart(metrics), [metrics]);
  const arrivals = useMemo(() => arrivalsChart(metrics, { withDepartures: false }), [metrics]);
  const departures = useMemo(() => departuresByDispositionChart(metrics), [metrics]);
  const stay = useMemo(() => stageWaitChart(metrics, 'lengthOfStay'), [metrics]);
  const stayCounts = useMemo(() => stageWaitCounts(metrics, 'lengthOfStay'), [metrics]);
  const balance = useMemo(() => throughputBalanceChart(metrics), [metrics]);
  const edwin = useMemo(() => edwinChart(metrics), [metrics]);
  const bands = useMemo(() => edwinBands(metrics), [metrics]);
  const pressureRows = useMemo(() => starvationRows(metrics), [metrics]);
  const pressure = useMemo(() => starvationChart(metrics), [metrics]);
  const nurseLoad = useMemo(() => nurseLoadChart(metrics), [metrics]);
  const physicianLoad = useMemo(() => physicianLoadChart(metrics), [metrics]);
  const nurses = useMemo(() => nurseUtilization(metrics), [metrics]);
  const { cohort, compliance } = metrics;
  const edwinSeries = metrics.series.edwin;
  const edwinMean = edwinSeries && edwinSeries.length ? edwinSeries.reduce((a, b) => a + b, 0) / edwinSeries.length : undefined;
  const edwinPeak = edwinSeries && edwinSeries.length ? Math.max(...edwinSeries) : undefined;
  const top = pressureRows[0];

  return (
    <>
      <Tiles>
        <Tile
          title="Wait to see a doctor"
          value={hoursLabel(wait.cell.median)}
          qualifier="median, AHS clock"
          method="ahsWait"
          note={
            wait.cell.n > 0
              ? `90th percentile ${hoursLabel(wait.cell.p90)} · ${wait.cell.n} patients · AHS 2024-25: ${hoursLabel(wait.reference.provincialMedian)}`
              : 'No patient reached a physician'
          }
        />
        <Tile
          title="Time in ED, admitted"
          value={hoursLabel(admittedTime.cell.median)}
          qualifier="median, AHS clock"
          method="ahsAdmitted"
          note={
            admittedTime.cell.n > 0
              ? `90th percentile ${hoursLabel(admittedTime.cell.p90)} · ${admittedTime.cell.n} patients · AHS 2024-25: ${hoursLabel(admittedTime.reference.provincialMedian)}`
              : 'No admitted patient left during the day'
          }
        />
        <Tile title={tiles.withinTarget.title} value={tiles.withinTarget.value} qualifier={tiles.withinTarget.qualifier} note={tiles.withinTarget.note} method="withinTarget" />
        <Tile title={tiles.lwbs.title} value={tiles.lwbs.value} qualifier={tiles.lwbs.qualifier} method="lwbs" />
        <Tile
          title="Admitted"
          value={cohort.completed > 0 ? percent(cohort.admitted / cohort.completed) : '--'}
          qualifier={`${cohort.admitted} of ${cohort.completed} completed visits`}
          method="disposition"
        />
        <Tile title={tiles.dischargedWithin4h.title} value={tiles.dischargedWithin4h.value} qualifier={tiles.dischargedWithin4h.qualifier} method="lengthOfStayBenchmarks" />
        <Tile
          title="Admitted within 8 h"
          value={percent(compliance.admittedWithin8h.share)}
          qualifier={`of ${compliance.admittedWithin8h.n} admitted`}
          method="lengthOfStayBenchmarks"
        />
      </Tiles>
      <Tiles>
        <Tile title={tiles.enrolled.title} value={tiles.enrolled.value} qualifier={tiles.enrolled.qualifier} note={`${cohort.completed} completed · ${cohort.censored} still in the ED at the end`} method="cohort" />
        <Tile title="Peak census" value={`${peak.value}`} qualifier="patients present at once" note={`at ${peak.at} after the start`} method="census" />
        <Tile
          title="EDWIN"
          value={edwinMean === undefined ? '--' : edwinMean.toFixed(2)}
          qualifier="mean over the day"
          note={edwinPeak === undefined ? 'Needs bed occupancy and physicians' : `peak ${edwinPeak.toFixed(2)}, ${edwinBand(edwinPeak).label.toLowerCase()}`}
          method="edwin"
        />
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
          title="Total time in ED by CTAS (completed visits)"
          method="stageWaits"
          reading="Median and 90th percentile of arrival to departure per level, admitted and discharged pooled. The 1.2 tab splits the stay into its stages; the 1.3 tab has the benchmarks."
          note={stayCounts.length ? `Patients per level: ${stayCounts.join(', ')}.` : 'No completed visit.'}
        >
          {stay.labels.length ? <BarChart series={stay} yTitle="Minutes" /> : <Empty>No completed visit in the run.</Empty>}
        </Panel>
      </Row>
      <Row>
        <Panel
          title="Throughput balance (departures ÷ arrivals per hour)"
          method="throughputBalance"
          reading="Below the dashed line for a sustained period means the department is falling behind; above it, the backlog is clearing."
        >
          <LineChart series={balance} yTitle="Ratio" xTitle="Simulated hour" />
        </Panel>
        <Panel
          title="EDWIN over the day"
          method="edwin"
          reading="Below the yellow band the department is not busy; inside it busy; in the red, overcrowded. The 1.4 tab names the queue behind the score at any moment."
        >
          {edwin.datasets.length ? <LineChart series={edwin} yTitle="EDWIN" bands={bands} /> : <Empty>Needs bed occupancy and at least one physician.</Empty>}
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
