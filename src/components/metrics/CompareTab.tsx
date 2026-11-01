/** 1.6 Scenario comparison: a baseline replay beside the loaded one, with the AHS change legend. */
import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { ReplayMetrics } from '@/replay/types';
import { loadReplayFromFile } from '@/replay/loadReplay';
import { BAND_COLORS, compareRows, pairingWarnings, runLabel } from '@/replay/metricsCompare';
import type { CompareRow, Unit } from '@/replay/metricsCompare';
import { tabNumber } from '@/replay/metricsTabs';
import { Caption, Empty, MethodButton, Panel, Row, hoursLabel, minutesLabel, shareLabel } from './primitives';

function formatValue(value: number | undefined, unit: Unit): string {
  if (value === undefined || Number.isNaN(value)) return '--';
  switch (unit) {
    case 'min':
      return value >= 120 ? hoursLabel(value) : minutesLabel(value);
    case 'share':
      return shareLabel(value, 1);
    case 'usd':
      return `$${value.toFixed(4)}`;
    case 'index':
      return value.toFixed(2);
    default:
      return `${Math.round(value)}`;
  }
}

function BandChip({ row }: { row: CompareRow }) {
  const { band } = row;
  const label =
    band.kind === 'none' ? 'n/a' : band.kind === 'stable' ? 'stable' : band.kind === 'improvement' ? 'improvement' : 'deterioration';
  const relative = band.relative !== undefined ? ` ${band.relative > 0 ? '+' : ''}${(band.relative * 100).toFixed(0)}%` : '';
  return (
    <span className="metrics-chip" style={{ borderColor: BAND_COLORS[band.kind] }}>
      <span className="metrics-chip-dot" style={{ background: BAND_COLORS[band.kind] }} />
      {label}
      {relative}
    </span>
  );
}

export function CompareTab({ metrics }: { metrics: ReplayMetrics }) {
  const [baseline, setBaseline] = useState<ReplayMetrics | null>(null);
  const [baselineName, setBaselineName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const rows = useMemo(() => (baseline ? compareRows(metrics, baseline) : []), [metrics, baseline]);
  const warnings = useMemo(() => (baseline ? pairingWarnings(metrics, baseline) : []), [metrics, baseline]);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const replay = await loadReplayFromFile(file);
      if (!replay.Metrics) {
        setError(`${file.name} carries no Metrics block; rebuild it with reverie/build_edview_replay.py.`);
        setBaseline(null);
        return;
      }
      setBaseline(replay.Metrics);
      setBaselineName(file.name);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBaseline(null);
    }
  };

  return (
    <>
      <Caption>
        Comparing a baseline with an alternative (one more nurse in a zone, one more physician, two more spaces, a
        surge arrival pattern) needs the simulation run again with the same scenario and seed; a run cannot be
        re-scored for staffing it did not have. Load the baseline run's replay below to see every headline metric
        side by side with its delta and change band. <MethodButton id="changeBand" />
      </Caption>
      <Row>
        <Panel
          title="Baseline run"
          header={
            <label className="metrics-file">
              Load baseline replay.json
              <input type="file" accept="application/json,.json" onChange={onFile} data-testid="baseline-file" />
            </label>
          }
          note={error ? <span className="metrics-error">{error}</span> : undefined}
        >
          {baseline ? (
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>This run</th>
                  <th>Baseline</th>
                  <th>Change</th>
                  <th>Desired</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      {row.label}
                      {row.section && <span className="metrics-muted"> ({tabNumber(row.section)})</span>}
                    </td>
                    <td>
                      {formatValue(row.value, row.unit)}
                      {row.n !== undefined && <span className="metrics-muted"> n={row.n}</span>}
                    </td>
                    <td>
                      {formatValue(row.baseline, row.unit)}
                      {row.baselineN !== undefined && <span className="metrics-muted"> n={row.baselineN}</span>}
                    </td>
                    <td>
                      <BandChip row={row} />
                    </td>
                    <td>{row.direction === 'down' ? 'lower' : 'higher'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No baseline loaded. This run: {runLabel(metrics, 'the loaded replay')}.</Empty>
          )}
        </Panel>
      </Row>
      {baseline && (
        <Row>
          <Panel title="Pairing check" note={`Baseline: ${baselineName} (${runLabel(baseline, 'no run card')}). This run: ${runLabel(metrics, 'no run card')}.`}>
            {warnings.length ? (
              <ul className="metrics-list">
                {warnings.map((w) => (
                  <li key={w} className="metrics-error">
                    {w}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Same family, same seed, same LLM flags: the pair is honest.</Empty>
            )}
          </Panel>
          <Panel title="Reading the comparison">
            <ul className="metrics-list">
              <li>Improvement (green): 3% or more in the desirable direction. Stable (grey): under 3% either way. Deterioration (red): 3% or more the wrong way.</li>
              <li>The LLM layer is not deterministic, so run at least three replicates per arm and read the spread, not a single pair.</li>
              <li>Report what did not move: adding a nurse to a bed-starved zone should leave both starvation signals unchanged.</li>
              <li>The price of each arm (cost, wall-clock) is on the Run health tab of each replay.</li>
            </ul>
          </Panel>
        </Row>
      )}
    </>
  );
}
