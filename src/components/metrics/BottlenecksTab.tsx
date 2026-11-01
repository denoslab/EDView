/** 1.4 Bottleneck analysis: which queue holds the day up, who owns it, how far over target. */
import { useMemo } from 'react';
import type { ReplayMetrics } from '@/replay/types';
import { elapsedLabel } from '@/replay/metricsSelectors';
import {
  bottleneckScoreChart,
  bottleneckScoresOverDay,
  bucketIndexFor,
  componentRanking,
  componentRankingChart,
  edwinBand,
  oldestWaitAverageChart,
  overTargetChart,
  queueAverages,
  queueDepthAverageChart,
  sampledTargetMedians,
  usableCapacityChart,
} from '@/replay/metricsDerived';
import { BarChart, Empty, Panel, Row, Tile, Tiles, hasAny, minutesLabel, shareLabel } from './primitives';

export function BottlenecksTab({ metrics, currentSimTime }: { metrics: ReplayMetrics; currentSimTime?: string }) {
  const bucket = bucketIndexFor(metrics, currentSimTime);
  const at = elapsedLabel(bucket * metrics.axis.bucketMinutes);
  const averages = useMemo(() => queueAverages(metrics), [metrics]);
  const depth = useMemo(() => queueDepthAverageChart(metrics), [metrics]);
  const oldest = useMemo(() => oldestWaitAverageChart(metrics), [metrics]);
  const scores = useMemo(() => bottleneckScoresOverDay(metrics), [metrics]);
  const scoreChart = useMemo(() => bottleneckScoreChart(metrics), [metrics]);
  const ranking = useMemo(() => componentRanking(metrics), [metrics]);
  const rankingChart = useMemo(() => componentRankingChart(metrics), [metrics]);
  const over = useMemo(() => overTargetChart(metrics), [metrics]);
  const targets = useMemo(() => sampledTargetMedians(metrics), [metrics]);
  const capacity = useMemo(() => usableCapacityChart(metrics), [metrics]);
  const edwinNow = metrics.series.edwin?.[bucket];
  const band = edwinNow === undefined ? undefined : edwinBand(edwinNow);
  const top = ranking[0];
  const worst = scores[0];
  const hasOldest = Boolean(metrics.series.oldestWaitByState);

  return (
    <>
      <Tiles>
        <Tile
          title={`EDWIN at ${at}`}
          value={edwinNow === undefined ? '--' : edwinNow.toFixed(2)}
          qualifier={band ? band.label : undefined}
          note={band ? 'Follows the playback slider. Below 1.5 not busy, 1.5 to 2 busy, above 2 overcrowded' : 'Needs bed occupancy and physicians'}
          method="edwin"
          tone={band ? (band.label === 'Not busy' ? 'ok' : band.label === 'Busy' ? 'warn' : 'bad') : undefined}
        />
        <Tile
          title="Bottleneck of the day"
          value={worst ? worst.label : '--'}
          qualifier={worst ? `score ${worst.score.toFixed(2)}, ${worst.reason}` : undefined}
          note={worst ? `Cleared by: ${worst.owner.toLowerCase()}` : 'Nobody waited anywhere'}
          method="bottleneckScore"
        />
        <Tile
          title="Largest pre-physician wait"
          value={top && top.totalMinutes > 0 ? top.label : '--'}
          qualifier={top && top.totalMinutes > 0 ? `${shareLabel(top.share)} of the time before the physician` : undefined}
          note={top && top.totalMinutes > 0 ? `Points at ${top.owner.toLowerCase()}` : 'No stage-1 component file in this replay'}
          method="componentRanking"
        />
      </Tiles>
      <Row>
        <Panel
          title="Patients waiting by station, average over the day"
          method="queueSnapshot"
          reading="Each bar is the average number of patients waiting at that step across the whole day, deepest first. The deepest queue is where patients spend their time; the note gives each queue's peak."
          note={averages.length ? `Peaks: ${averages.map((r) => `${r.label} ${r.peakDepth}`).join(', ')}.` : undefined}
        >
          {hasAny(depth) ? <BarChart series={depth} yTitle="Patients" horizontal /> : <Empty>Nobody waited anywhere.</Empty>}
        </Panel>
        <Panel
          title="Longest wait by station, average over the day"
          method="queueSnapshot"
          reading="For each step, how long the longest-waiting patient had been there, averaged over the moments someone was waiting. A long wait with few waiting is one stuck patient; a long wait with many is a true bottleneck."
          note={hasOldest ? `Worst moments: ${averages.filter((r) => r.peakOldest).map((r) => `${r.label} ${minutesLabel(r.peakOldest)}`).join(', ')}.` : 'The oldest wait is not in this replay (built before the series existed).'}
        >
          {hasAny(oldest) ? <BarChart series={oldest} yTitle="Minutes" horizontal /> : <Empty>Not in this replay.</Empty>}
        </Panel>
      </Row>
      <Row>
        <Panel
          title="Bottleneck score by station over the day"
          method="bottleneckScore"
          reading="A 0-to-1 score per step combining how many waited, how long the longest wait was and how busy the resource that clears it was, highest first. The top bar is the day's bottleneck; the note says what drove each score."
          note={scores.length ? scores.map((r) => `${r.label}: ${r.reason}`).join(' · ') : undefined}
        >
          {hasAny(scoreChart) ? <BarChart series={scoreChart} yTitle="Score" horizontal /> : <Empty>Nobody waited anywhere.</Empty>}
        </Panel>
        <Panel
          title="Where the pre-physician time goes (total minutes, ranked)"
          method="componentRanking"
          reading="The nine parts of the time before the physician, summed over every patient and ranked; the top bar is the first thing to fix."
          note={top ? `Owners: ${ranking.filter((r) => r.totalMinutes > 0).slice(0, 4).map((r) => `${r.label} → ${r.owner}`).join('; ')}` : undefined}
        >
          {hasAny(rankingChart) ? <BarChart series={rankingChart} yTitle="Minutes across the cohort" horizontal /> : <Empty>No stage-1 component file in this replay.</Empty>}
        </Panel>
      </Row>
      <Row>
        <Panel
          title="Time over target by stage (minutes)"
          method="overTarget"
          reading="The targets are each patient's own sampled stage targets: arrival to physician, physician to disposition, disposition to departure. A stage running over them is congested rather than slow by design."
          note={
            over.labels.length
              ? `Completed visits per stage: ${over.counts.join(', ')}. Median sampled targets in this run: stage 1 ${minutesLabel(targets.stage1)}, stage 2 ${minutesLabel(targets.stage2)}, stage 3 ${minutesLabel(targets.stage3)}.`
              : undefined
          }
        >
          {over.labels.length ? <BarChart series={over} yTitle="Minutes over the sampled target" /> : <Empty>No completed-visit stage file in this replay.</Empty>}
        </Panel>
        <Panel
          title="Usable capacity by zone"
          method="blockedCapacity"
          reading="Each bar is a zone's spaces: blue is usable, grey is closed. Closed beds are capacity lost before any patient arrives; a zone that is small here and full on the Staffing tab is the one to open beds in."
          note={capacity.varies ? 'Closed beds changed between snapshots; the bars show the last one.' : 'Closed beds did not change during the run.'}
        >
          {capacity.labels.length ? <BarChart series={capacity} yTitle="Spaces" stacked horizontal /> : <Empty>No bed-occupancy snapshots in this replay.</Empty>}
        </Panel>
      </Row>
    </>
  );
}
