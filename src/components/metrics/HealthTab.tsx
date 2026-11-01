/** 1.7 Simulation health: can the run be trusted, and what did it cost. */
import { useMemo } from 'react';
import type { ReplayMetrics } from '@/replay/types';
import { callsByChannelChart, chunkCostChart, fallbackRows, runCardRows, runHealthTiles } from '@/replay/metricsHealth';
import { BarChart, Caption, Empty, Panel, Row, Tile, Tiles, hasAny, shareLabel } from './primitives';

export function HealthTab({ metrics }: { metrics: ReplayMetrics }) {
  const tiles = useMemo(() => runHealthTiles(metrics), [metrics]);
  const calls = useMemo(() => callsByChannelChart(metrics), [metrics]);
  const chunks = useMemo(() => chunkCostChart(metrics), [metrics]);
  const fallbacks = useMemo(() => fallbackRows(metrics), [metrics]);
  const card = useMemo(() => runCardRows(metrics), [metrics]);
  const health = metrics.runHealth;

  if (!health) {
    return (
      <>
        <Caption>This replay carries no run-health block: the run folder had no usage sidecar when the replay was built.</Caption>
        <Row>
          <Panel title="Run card" method="runValidity">
            <RunCard rows={card} />
          </Panel>
        </Row>
      </>
    );
  }

  const methodFor = (title: string): string => {
    if (title === 'Run validity') return 'runValidity';
    if (title === 'LLM cost' || title === 'Tokens' || title === 'LLM calls') return 'llmCost';
    if (title === 'Fallback rate') return 'fallbackRate';
    return 'wallClock';
  };

  return (
    <>
      <Tiles>
        {tiles.map((tile) => (
          <Tile key={tile.title} title={tile.title} value={tile.value} note={tile.note} tone={tile.tone} method={methodFor(tile.title)} />
        ))}
      </Tiles>
      <Row>
        <Panel
          title="Run card"
          method="runValidity"
          reading="The provenance to cite with the run: model, dialogue mode, seed, scenario family and whether it is analysis-eligible. Metrics from a run with a model channel switched off must not be compared with a full run."
        >
          <RunCard rows={card} />
        </Panel>
        <Panel
          title="LLM calls by channel"
          method="llmCost"
          reading="Which decisions the model was asked to make, and how often. Attribution by agent type needs the gateway to record the calling role."
        >
          {hasAny(calls) ? <BarChart series={calls} yTitle="Calls" horizontal /> : <Empty>No LLM call was made.</Empty>}
        </Panel>
      </Row>
      <Row>
        <Panel
          title="Cost by chunk"
          method="llmCost"
          reading="Chunks are the runner's restart units; a chunk far above its neighbours held more conversations or slower model answers."
        >
          {chunks.labels.length ? <BarChart series={chunks} yTitle="USD" /> : <Empty>No chunk record.</Empty>}
        </Panel>
        <Panel
          title="Fallbacks by channel and category"
          method="fallbackRate"
          reading="A fallback is a decision the engine made by rule because the model's answer was unusable."
          note={`${health.transportRetries} transport retries.`}
        >
          {fallbacks.length ? (
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Category</th>
                  <th>Fallbacks</th>
                  <th>Rate over the channel's calls</th>
                </tr>
              </thead>
              <tbody>
                {fallbacks.map((row) => (
                  <tr key={row.key}>
                    <td>{row.channel}</td>
                    <td>{row.category}</td>
                    <td>{row.count}</td>
                    <td>{shareLabel(row.rate, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No fallback: every model answer was usable.</Empty>
          )}
        </Panel>
      </Row>
    </>
  );
}

function RunCard({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <table className="metrics-table metrics-table-kv">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
