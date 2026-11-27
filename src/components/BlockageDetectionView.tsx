import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Wrench, AlertTriangle } from 'lucide-react';
import '../utils/chartSetup.ts';
import type { DashboardSnapshot } from '../types/sani.ts';
import { StatusLabel } from './StatusLabel.tsx';

interface BlockageDetectionViewProps {
  data: DashboardSnapshot;
  onDispatchIntervention: (nodeId: string) => void;
  onSimulateNodeBlockage: (nodeId: string) => void;
  busy: boolean;
}

export function BlockageDetectionView({
  data,
  onDispatchIntervention,
  onSimulateNodeBlockage,
  busy,
}: BlockageDetectionViewProps) {
  const { nodes } = data;

  const sortedByBlockage = useMemo(() => {
    return [...nodes].sort((a, b) => b.blockage.probabilityPct - a.blockage.probabilityPct);
  }, [nodes]);

  const flowComparisonChart = useMemo(() => {
    const ordered = [...nodes].sort((a, b) => a.node.id.localeCompare(b.node.id));
    return {
      labels: ordered.map((n) => n.node.id),
      datasets: [
        {
          label: 'Expected Hydraulic Flow (L/s)',
          data: ordered.map((n) => n.blockage.expectedFlowLps),
          backgroundColor: '#CBD5E1',
          borderRadius: 4,
          barPercentage: 0.65,
        },
        {
          label: 'Actual Measured Flow (L/s)',
          data: ordered.map((n) => n.blockage.actualFlowLps),
          backgroundColor: ordered.map((n) =>
            n.blockage.severity === 'Severe'
              ? '#DC2626'
              : n.blockage.severity === 'Moderate'
                ? '#D97706'
                : '#0D9488'
          ),
          borderRadius: 4,
          barPercentage: 0.65,
        },
      ],
    };
  }, [nodes]);

  return (
    <div className="space-y-6">
      {/* Explanation & Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Expected vs. Actual Hydraulic Flow Analysis
            </h2>
            <p className="text-xs text-slate-500">
              BlockageDetectionAgent flags obstructions when water level rises while measured flow drops below hydraulic baseline
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-600">
            Threshold: {data.thresholds.blockageFlowDeficitPct}% flow deficit
          </span>
        </div>

        <div className="h-72">
          <Bar
            data={flowComparisonChart}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top', align: 'end' },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  grid: { color: 'rgba(148, 163, 184, 0.18)' },
                  title: { display: true, text: 'Flow Rate (L/s)' },
                },
                x: {
                  grid: { display: false },
                },
              },
            }}
          />
        </div>
      </div>

      {/* Node Blockage Diagnostics List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedByBlockage.map(({ node, telemetry, blockage, decision }) => {
          const tone =
            blockage.severity === 'Severe'
              ? 'critical'
              : blockage.severity === 'Moderate' || blockage.severity === 'Low'
                ? 'warning'
                : 'nominal';

          return (
            <div
              key={node.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 font-mono">
                      {node.id} · {node.sector}
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">{node.name}</h3>
                  </div>
                  <StatusLabel
                    tone={tone}
                    label={
                      blockage.severity === 'None'
                        ? 'Clear Conduit'
                        : `${blockage.severity} Blockage`
                    }
                  />
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">{blockage.summary}</p>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-500 block">Confidence</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {blockage.probabilityPct}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Flow Deficit</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {blockage.flowDeficitPct}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Water Level</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {telemetry.waterLevelPct}%
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-600">
                  <span className="font-medium text-slate-800">Suspected Cause:</span>{' '}
                  {blockage.suspectedCause}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSimulateNodeBlockage(node.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Inject Blockage</span>
                </button>

                {decision.interventionActive ? (
                  <StatusLabel tone="info" label="Hydro-Jetting Active" />
                ) : (
                  <button
                    type="button"
                    disabled={busy || !blockage.isBlocked}
                    onClick={() => onDispatchIntervention(node.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      blockage.isBlocked
                        ? 'bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Clear Mechanically</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
