import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import '../utils/chartSetup.ts';
import type { DashboardSnapshot, TelemetryReading } from '../types/sani.ts';
import { formatTimeShort } from '../utils/chartSetup.ts';
import { StatusLabel } from './StatusLabel.tsx';

interface PredictiveAnalyticsViewProps {
  data: DashboardSnapshot;
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
}

export function PredictiveAnalyticsView({
  data,
  selectedNodeId,
  onSelectNode,
}: PredictiveAnalyticsViewProps) {
  const [history, setHistory] = useState<TelemetryReading[]>([]);
  const selectedSnap =
    data.nodes.find((n) => n.node.id === selectedNodeId) ?? data.nodes[0];

  useEffect(() => {
    let active = true;
    fetch(`/api/nodes/${selectedSnap.node.id}/history?limit=16`)
      .then((res) => res.json())
      .then((payload) => {
        if (active && Array.isArray(payload.history)) {
          setHistory(payload.history);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [selectedSnap.node.id, data.simulation.tickCount]);

  const forecastChartData = useMemo(() => {
    const pastLabels = history.map((h) => formatTimeShort(h.timestamp));
    const pastValues = history.map((h) => h.waterLevelPct);

    const latestVal = pastValues[pastValues.length - 1] ?? selectedSnap.telemetry.waterLevelPct;
    const projectedEnd = selectedSnap.prediction.projectedLevelPct30m;
    const futureLabels = ['+5m', '+10m', '+15m', '+20m', '+25m', '+30m'];
    const futureSteps = futureLabels.map((_, idx) => {
      const ratio = (idx + 1) / futureLabels.length;
      return Number(Math.max(10, Math.min(100, latestVal + (projectedEnd - latestVal) * ratio)).toFixed(1));
    });

    const allLabels = [...pastLabels, ...futureLabels];
    const historicalSeries = [...pastValues, ...Array(futureLabels.length).fill(null)];
    const forecastSeries = [
      ...Array(Math.max(0, pastValues.length - 1)).fill(null),
      latestVal,
      ...futureSteps,
    ];
    const criticalLine = Array(allLabels.length).fill(data.thresholds.waterLevelCriticalPct);

    return {
      labels: allLabels,
      datasets: [
        {
          label: 'Observed Level (%)',
          data: historicalSeries,
          borderColor: '#0F1D36',
          backgroundColor: 'rgba(15, 29, 54, 0.08)',
          fill: true,
          tension: 0.25,
          borderWidth: 2,
          pointRadius: 2,
        },
        {
          label: 'Predicted Trajectory (30m Horizon)',
          data: forecastSeries,
          borderColor: '#0D9488',
          borderDash: [6, 4],
          tension: 0.25,
          borderWidth: 2.5,
          pointRadius: 3,
        },
        {
          label: `Critical Overflow Limit (${data.thresholds.waterLevelCriticalPct}%)`,
          data: criticalLine,
          borderColor: '#DC2626',
          borderDash: [3, 3],
          borderWidth: 1.5,
          pointRadius: 0,
        },
      ],
    };
  }, [history, selectedSnap, data.thresholds.waterLevelCriticalPct]);

  return (
    <div className="space-y-6">
      {/* Node Forecast Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Overflow Risk Forecast — {selectedSnap.node.name}
            </h2>
            <p className="text-xs text-slate-500">
              Prototype OLS linear trend regression &amp; logistic overflow probability model over SQLite history
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {data.nodes.map((n) => (
              <button
                key={n.node.id}
                type="button"
                onClick={() => onSelectNode(n.node.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  n.node.id === selectedSnap.node.id
                    ? 'bg-teal-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {n.node.id}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72">
          <Line
            data={forecastChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top', align: 'end' },
              },
              scales: {
                y: {
                  min: 0,
                  max: 105,
                  grid: { color: 'rgba(148, 163, 184, 0.18)' },
                  title: { display: true, text: 'Conduit Fill (%)' },
                },
                x: {
                  grid: { display: false },
                  ticks: { maxTicksLimit: 10 },
                },
              },
            }}
          />
        </div>
      </div>

      {/* Predictive Risk Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            Network Predictive Overflow Matrix
          </h2>
          <p className="text-xs text-slate-500">
            Click any row to inspect its projected trajectory chart above
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-4">Location</th>
                <th className="py-2.5 px-4">Risk Level</th>
                <th className="py-2.5 px-4 text-right">Overflow Prob.</th>
                <th className="py-2.5 px-4 text-right">Trend (cm/min)</th>
                <th className="py-2.5 px-4 text-right">Est. Time to Overflow</th>
                <th className="py-2.5 px-4">Preventive Maintenance Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {data.nodes.map(({ node, prediction }) => {
                const isSelected = node.id === selectedSnap.node.id;
                const tone =
                  prediction.riskLevel === 'High'
                    ? 'critical'
                    : prediction.riskLevel === 'Medium'
                      ? 'warning'
                      : 'nominal';
                return (
                  <tr
                    key={node.id}
                    onClick={() => onSelectNode(node.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-teal-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{node.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{node.id}</div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel tone={tone} label={prediction.riskLevel} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {prediction.overflowProbabilityPct}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {prediction.levelTrendCmPerMin >= 0 ? '+' : ''}
                      {prediction.levelTrendCmPerMin}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {prediction.estimatedMinutesToOverflow !== null
                        ? `${prediction.estimatedMinutesToOverflow} min`
                        : 'Stable'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 max-w-md">
                      {prediction.preventiveRecommendation}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
