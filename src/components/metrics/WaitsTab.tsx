/** 1.2 Waits and stage times. */
import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { ReplayMetrics, StageWaitKey } from '@/replay/types';
import {
  STAGE_WAIT_KEYS,
  STAGE_WAIT_LABELS,
  STATE_COLORS,
  percent,
  pooledIntervalsChart,
  stage1ComponentsChart,
  stage1GroupedChart,
  stageWaitChart,
  stageWaitCounts,
  waitingByStateChart,
} from '@/replay/metricsSelectors';
import { ahsMeasures, arrivalToTriageChart, stateMinutesChart } from '@/replay/metricsDerived';
import { ahs } from '@/theme/ahs';
import { BarChart, Empty, LineChart, Panel, Row, Tile, Tiles, hasAny, hoursLabel } from './primitives';

const SMALL_SAMPLE = 5;
type ComponentView = 'grouped' | 'detailed';

export function WaitsTab({ metrics }: { metrics: ReplayMetrics }) {
  const [stageKey, setStageKey] = useState<StageWaitKey>('doorToDoctor');
  const [componentView, setComponentView] = useState<ComponentView>('grouped');
  const waiting = useMemo(() => waitingByStateChart(metrics), [metrics]);
  const stageWait = useMemo(() => stageWaitChart(metrics, stageKey), [metrics, stageKey]);
  const counts = useMemo(() => stageWaitCounts(metrics, stageKey), [metrics, stageKey]);
  const grouped = useMemo(() => stage1GroupedChart(metrics), [metrics]);
  const detailed = useMemo(() => stage1ComponentsChart(metrics), [metrics]);
  const pooled = useMemo(() => pooledIntervalsChart(metrics), [metrics]);
  const triage = useMemo(() => arrivalToTriageChart(metrics), [metrics]);
  // The same state colours as the waiting-count chart, so a state looks the same everywhere.
  const registration = useMemo(
    () => stateMinutesChart(metrics, ['WAITING_FOR_REGISTRATION', 'REGISTRATION'], false, [STATE_COLORS.WAITING_FOR_REGISTRATION, ahs.green]),
    [metrics],
  );
  const treatment = useMemo(
    () =>
      stateMinutesChart(
        metrics,
        ['WAITING_FOR_TEST', 'GOING_FOR_TEST', 'WAITING_FOR_RESULT', 'WAITING_FOR_DOCTOR'],
        true,
        [STATE_COLORS.WAITING_FOR_TEST, STATE_COLORS.GOING_FOR_TEST, STATE_COLORS.WAITING_FOR_RESULT, STATE_COLORS.WAITING_FOR_DOCTOR],
      ),
    [metrics],
  );
  const wait = useMemo(() => ahsMeasures(metrics)[0], [metrics]);
  const triaged = metrics.compliance.triagedWithin10;
  const smallSample = counts.some((n) => n < SMALL_SAMPLE);
  const components = componentView === 'grouped' ? grouped : detailed;

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
              ? `90th percentile ${hoursLabel(wait.cell.p90)} · ${wait.cell.n} patients · AHS 2024-25: ${hoursLabel(wait.reference.provincialMedian)} provincial, ${hoursLabel(wait.reference.calgaryMedian)} Calgary Zone`
              : 'No patient reached a physician'
          }
        />
        <Tile
          title="Triaged within 10 minutes"
          value={triaged ? percent(triaged.share) : '--'}
          qualifier={triaged ? `of ${triaged.n} patients` : undefined}
          note={triaged ? 'CTAS expects triage within 10 minutes of arrival' : 'Not in this replay'}
          method="arrivalToTriage"
        />
      </Tiles>
      <Row>
        <Panel
          title="Waiting count by state"
          method="waitingByState"
          reading="Bands stack in flow order, so the top edge is everyone waiting; the thickest band at any moment is the queue to look at first."
        >
          <LineChart series={waiting} yTitle="Patients waiting" stacked />
        </Panel>
      </Row>
      <Row>
        <Panel
          title="Stage waits by CTAS (minutes)"
          method="stageWaits"
          header={
            <select
              className="metrics-select"
              value={stageKey}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setStageKey(e.target.value as StageWaitKey)}
              data-testid="stage-wait-select"
            >
              {STAGE_WAIT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {STAGE_WAIT_LABELS[key]}
                </option>
              ))}
            </select>
          }
          reading="Medians with the 90th percentile beside them: a tall orange bar over a short blue one is a level whose worst waits are far from its typical wait."
          note={
            counts.length === 0
              ? 'No patient reached this interval.'
              : `Patients per level: ${counts.join(', ')}${smallSample ? ` (a level with fewer than ${SMALL_SAMPLE} patients is read with care)` : ''}`
          }
        >
          <BarChart series={stageWait} yTitle="Minutes" />
        </Panel>
        <Panel
          title="Where the visit's time goes (pooled, minutes)"
          method="stageWaits"
          reading="The six intervals of a visit, every level pooled, longest first. The intervals nest: the whole stay is at the top, and the bars below show how much of it had passed by each milestone. Orange is the 90th percentile of the slowest level."
          note={pooled.rows.length ? `Patients behind each bar: ${pooled.rows.map((r) => `${r.label} ${r.n}`).join(', ')}.` : undefined}
        >
          {pooled.rows.length ? <BarChart series={pooled} yTitle="Minutes" horizontal /> : <Empty>No patient reached any interval.</Empty>}
        </Panel>
      </Row>
      <Row>
        <Panel
          title="Time before the physician (mean minutes)"
          method="stage1Components"
          header={
            <select
              className="metrics-select"
              value={componentView}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setComponentView(e.target.value as ComponentView)}
              data-testid="component-view-select"
            >
              <option value="grouped">By stage of the wait (4 parts)</option>
              <option value="detailed">By component (9 parts)</option>
            </select>
          }
          reading={
            componentView === 'grouped'
              ? 'Four parts per level, in flow order: triage, registration, waiting for a space, waiting for the physician once in it. The orange band is the one a space would shorten; the dark band is the one a physician would. Switch to the nine-part view for the split inside each.'
              : 'The nine parts of the time before the physician. The sampled target hold is the historical floor the scenario drew, not congestion; everything else is waiting for someone or something.'
          }
        >
          {components.labels.length ? <BarChart series={components} yTitle="Minutes" stacked /> : <Empty>No stage-1 component file in this replay.</Empty>}
        </Panel>
        <Panel title="Arrival to triage (minutes)" method="arrivalToTriage" reading="Rising values mean the triage nurse is the constraint; the dashed outline is the 10-minute CTAS expectation.">
          {stageWait && triage.labels.length ? <BarChart series={triage} yTitle="Minutes" /> : <Empty>No patient was triaged.</Empty>}
        </Panel>
      </Row>
      <Row>
        <Panel
          title="Registration: wait for the clerk and service (mean minutes)"
          method="stateMinutes"
          reading="Every triaged patient except CTAS 1 registers; a wait far above the service time means too few clerks for the arrival rate."
          note={registration.labels.length ? `Patients per level: ${registration.counts.join(', ')}` : undefined}
        >
          {hasAny(registration) ? (
            <BarChart series={registration} yTitle="Minutes" />
          ) : (
            <Empty>No registration in this run (no clerk staffed, or an older replay).</Empty>
          )}
        </Panel>
        <Panel
          title="Treatment-phase waits by CTAS (mean minutes)"
          method="stateMinutes"
          reading="Stacked: the whole bar is the time between the physician's first assessment and the disposition; the result wait is usually the largest part."
          note={treatment.labels.length ? `Patients per level: ${treatment.counts.join(', ')}. Minutes so far for patients still in a state at the end.` : undefined}
        >
          {hasAny(treatment) ? <BarChart series={treatment} yTitle="Minutes" stacked /> : <Empty>No patient reached the treatment phase.</Empty>}
        </Panel>
      </Row>
    </>
  );
}
