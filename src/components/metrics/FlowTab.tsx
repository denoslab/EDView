/** 1.1 Patient flow: where the Overview's census and arrivals come from, broken down. */
import { useMemo } from 'react';
import type { ReplayMetrics } from '@/replay/types';
import { censusByZoneChart, netFlowChart, outcomeTiles, peakCensus, phaseCensusChart } from '@/replay/metricsSelectors';
import type { OutcomeTileKey } from '@/replay/metricsSelectors';
import { BarChart, Empty, LineChart, Panel, Row, Tile, Tiles, hasAny } from './primitives';

const FLOW_TILES: OutcomeTileKey[] = ['enrolled', 'completed', 'lwbs'];

export function FlowTab({ metrics }: { metrics: ReplayMetrics }) {
  const phases = useMemo(() => phaseCensusChart(metrics), [metrics]);
  const netFlow = useMemo(() => netFlowChart(metrics), [metrics]);
  const zones = useMemo(() => censusByZoneChart(metrics), [metrics]);
  const tiles = useMemo(() => outcomeTiles(metrics).filter((t) => FLOW_TILES.includes(t.key)), [metrics]);
  const peak = useMemo(() => peakCensus(metrics), [metrics]);

  return (
    <>
      <Tiles>
        {tiles.map((tile) => (
          <Tile key={tile.key} title={tile.title} value={tile.value} qualifier={tile.qualifier} note={tile.note} method={tile.method} />
        ))}
        <Tile title="Peak census" value={`${peak.value}`} qualifier="patients present at once" note={`at ${peak.at} after the start`} method="census" />
      </Tiles>
      <Row>
        <Panel
          title="Where the patients are"
          method="phaseCensus"
          reading="The Overview's census split by place: the orange band is the waiting room, blue is patients in a treatment space, grey is patients done with treatment who have not left. A wide orange band over a steady blue one means the beds, not the arrivals, set the wait."
        >
          <LineChart series={phases} yTitle="Patients in the ED" stacked />
        </Panel>
        <Panel
          title="Hourly net flow and backlog"
          method="netFlow"
          reading="Orange is arrivals minus departures in each hour; blue is the running total, the patients the day has added to the department so far. Blue climbing means the day is filling the department; blue falling means it is draining."
        >
          <LineChart series={netFlow} yTitle="Patients" xTitle="Simulated hour" />
        </Panel>
      </Row>
      <Row>
        <Panel
          title="Census by zone"
          method="censusByZone"
          reading="Spaces held in each zone at each hourly snapshot, including patients outside the day's cohort, so this is the department's occupancy rather than the cohort's."
        >
          {hasAny(zones) ? <BarChart series={zones} yTitle="Spaces held" stacked /> : <Empty>No bed-occupancy snapshots in this replay.</Empty>}
        </Panel>
      </Row>
    </>
  );
}
