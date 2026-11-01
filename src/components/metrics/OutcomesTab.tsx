/** 1.3 Throughput and outcomes: the Overview's outcome tiles, broken down by acuity and reason. */
import { useMemo } from 'react';
import type { ReplayMetrics } from '@/replay/types';
import { percent } from '@/replay/metricsSelectors';
import {
  ahsMeasures,
  diagnosticQueueChart,
  diagnosticsChart,
  dispositionMix,
  lwbsChart,
  lwbsStates,
  surgeRecovery,
  withinTargetChart,
} from '@/replay/metricsDerived';
import { BarChart, Empty, LineChart, Panel, Row, Tile, Tiles, hasAny, hoursLabel, minutesLabel, shareLabel } from './primitives';

export function OutcomesTab({ metrics }: { metrics: ReplayMetrics }) {
  const mix = useMemo(() => dispositionMix(metrics), [metrics]);
  const admitted = useMemo(() => ahsMeasures(metrics)[1], [metrics]);
  const within = useMemo(() => withinTargetChart(metrics), [metrics]);
  const lwbs = useMemo(() => lwbsChart(metrics), [metrics]);
  const lwbsFrom = useMemo(() => lwbsStates(metrics), [metrics]);
  const diagnostics = useMemo(() => diagnosticsChart(metrics), [metrics]);
  const queue = useMemo(() => diagnosticQueueChart(metrics), [metrics]);
  const surge = useMemo(() => surgeRecovery(metrics), [metrics]);
  const { compliance, diagnostics: diag } = metrics;

  return (
    <>
      <Tiles>
        <Tile title="Discharged" value={`${mix.discharged}`} qualifier={mix.completed ? `${shareLabel(mix.discharged / mix.completed)} of ${mix.completed} completed` : 'No completed visit'} method="disposition" />
        <Tile title="Admitted" value={`${mix.admitted}`} qualifier={mix.completed ? `${shareLabel(mix.admitted / mix.completed)} of ${mix.completed} completed` : 'No completed visit'} method="disposition" />
        <Tile title="Left without being seen" value={mix.departed ? shareLabel(mix.lwbs / mix.departed) : '--'} qualifier={`${mix.lwbs} of ${mix.departed} who departed`} method="lwbs" />
        <Tile title="Still in the ED" value={`${mix.censored}`} qualifier="at the end of the day" note="Counted in the time series, not in the visit times" method="cohort" />
        <Tile
          title="Time in ED, admitted"
          value={hoursLabel(admitted.cell.median)}
          qualifier="median, AHS clock"
          method="ahsAdmitted"
          note={admitted.cell.n > 0 ? `90th percentile ${hoursLabel(admitted.cell.p90)} · ${admitted.cell.n} patients · AHS 2024-25: ${hoursLabel(admitted.reference.provincialMedian)}` : 'No admitted patient left during the day'}
        />
      </Tiles>
      <Tiles>
        <Tile title="Discharged within 4 h" value={percent(compliance.dischargedWithin4h.share)} qualifier={`of ${compliance.dischargedWithin4h.n} discharged`} method="lengthOfStayBenchmarks" />
        <Tile title="Admitted within 8 h" value={percent(compliance.admittedWithin8h.share)} qualifier={`of ${compliance.admittedWithin8h.n} admitted`} note="Over 8 h is the CIHI access-block population" method="lengthOfStayBenchmarks" />
        <Tile
          title="Surge recovery"
          value={surge.recoveryMinutes !== undefined ? minutesLabel(surge.recoveryMinutes) : '--'}
          qualifier="after the busiest arrival hour"
          method="surgeRecovery"
          note={surge.reason ?? `Busiest hour ${surge.peakHour}–${surge.peakHour + 1} h (${surge.peakArrivals} arrivals); baseline census ${surge.baselineCensus ?? '--'}, waiting ${surge.baselineWaiting ?? '--'}`}
        />
      </Tiles>
      <Row>
        <Panel
          title="Seen within CTAS target"
          method="withinTarget"
          reading="The share of each level seen by a physician inside the CTAS objective (15, 30, 60 and 120 minutes for levels 2 to 5; CTAS 1 is shown at 10 minutes)."
          note={within.labels.length ? `Patients per level: ${within.counts.join(', ')}` : undefined}
        >
          {within.labels.length ? <BarChart series={within} yTitle="Share" percent /> : <Empty>No patient reached a physician.</Empty>}
        </Panel>
        <Panel
          title="Left without being seen, by CTAS"
          method="lwbs"
          reading="Patients who left before a physician saw them, by acuity. Walkouts concentrate in the levels that wait longest for a space."
          note={
            lwbsFrom.length
              ? `Left from: ${lwbsFrom.map((r) => `${r.label} (${r.n})`).join(', ')}. Median wait before leaving per level: ${Object.entries(metrics.walkouts?.byCtas ?? {}).map(([l, c]) => `CTAS ${l} ${minutesLabel(c.median)}`).join(', ')}.`
              : undefined
          }
        >
          {hasAny(lwbs) ? <BarChart series={lwbs} yTitle="Patients" /> : <Empty>Nobody left without being seen.</Empty>}
        </Panel>
      </Row>
      <Row>
        <Panel
          title="Diagnostics: share with a test ordered, by CTAS"
          method="diagnostics"
          reading="Higher-acuity levels are tested more; a level with a high share and a long result wait is where the lab holds the department's time."
          note={
            diag
              ? `Patients per level: ${diagnostics.counts.join(', ')}. Order-to-result turnaround: median ${minutesLabel(diag.turnaround.median)}, 90th ${minutesLabel(diag.turnaround.p90)} (n = ${diag.turnaround.n}).`
              : 'Not in this replay.'
          }
        >
          {diagnostics.labels.length ? <BarChart series={diagnostics} yTitle="Share" percent /> : <Empty>Not in this replay.</Empty>}
        </Panel>
        <Panel
          title="Diagnostic queue over time"
          method="diagnostics"
          reading="Stacked: the top edge is every patient in the diagnostic loop; a thick result-wait band means the lab, not the ED, holds the queue."
        >
          {queue.datasets.length ? <LineChart series={queue} yTitle="Patients" stacked /> : <Empty>No test was ordered.</Empty>}
        </Panel>
      </Row>
    </>
  );
}
