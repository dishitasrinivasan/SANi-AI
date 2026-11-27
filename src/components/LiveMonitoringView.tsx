import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Radio } from 'lucide-react';
import '../utils/chartSetup.ts';
import type { DashboardSnapshot, TelemetryReading } from '../types/sani.ts';
import { formatTimeShort } from '../utils/chartSetup.ts';
import { StatusLabel } from './StatusLabel.tsx';

interface LiveMonitoringViewProps {
  data: DashboardSnapshot;
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
}

type MetricKey = 'waterLevelPct' | 'flowRateLps' | 'h2sPpm' | 'ch4LelPct';

const METRIC_META: Record<MetricKey, { label: string; unit: string; color: string }> = {
  waterLevelPct: { label: 'Water Level', unit: '% capacity', color: '#0D9488' },
  flowRateLps: { label: 'Water Flow Rate', unit: 'L/s', color: '#0F1D36' },
  h2sPpm: { label: 'H₂S Gas Concentration', unit: 'ppm', color: '#DC2626' },
  ch4LelPct: { label: 'CH₄ Explosive Limit', unit: '% LEL', color: '#D97706' },
};

export function LiveMonitoringView({
  data,
  selectedNodeId,
  onSelectNode,
}: LiveMonitoringViewProps) {
  const [metric, setMetric] = useState<MetricKey>('waterLevelPct');
  const [history, setHistory] = useState<TelemetryReading[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const selectedSnap =
    data.nodes.find((n) => n.node.id === selectedNodeId) ?? data.nodes[0];

  useEffect(() => {
    let active = true;
    setLoadingHistory(true);
    fetch(`/api/nodes/${selectedSnap.node.id}/history?limit=25`)
      .then((res) => res.json())
      .then((payload) => {
        if (active && Array.isArray(payload.history)) {
          setHistory(payload.history);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [selectedSnap.node.id, data.simulation.tickCount]);

  const chartData = useMemo(() => {
    const meta = METRIC_META[metric];
    return {
      labels: history.map((h) => formatTimeShort(h.timestamp)),
      datasets: [
        {
          label: `${meta.label} (${meta.unit})`,
          data: history.map((h) => h[metric]),
          borderColor: meta.color,
          backgroundColor: `${meta.color}1F`,
          fill: true,
          tension: 0.3,
          pointRadius: 2.5,
          borderWidth: 2,
        },
      ],
    };
  }, [history, metric]);

  const { telemetry, node } = selectedSnap;
  const { thresholds } = data;

  return (
    <div className="space-y-6">
      {/* Node Selector Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {data.nodes.map((snap) => {
            const active = snap.node.id === selectedSnap.node.id;
            return (
              <button
                key={snap.node.id}
                type="button"
                onClick={() => onSelectNode(snap.node.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#0B1528] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {snap.node.id} · {snap.node.name}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums shrink-0">
          <Radio className="w-3.5 h-3.5 text-teal-700" />
          <span>
            Simulated ESP32 Packet #{telemetry.simulatedPacketSeq} · RSSI {telemetry.rssiDbm} dBm
          </span>
        </div>
      </div>

      {/* 5 Live Sensor Readout Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Water Level</p>
          <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {telemetry.waterLevelPct}%
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {telemetry.waterLevelCm} / {node.pipeDiameterCm} cm conduit
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Water Flow Rate</p>
          <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {telemetry.flowRateLps} <span className="text-sm font-normal text-slate-500">L/s</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Max capacity {node.maxCapacityLps} L/s
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Hydrogen Sulfide (H₂S)</p>
          <p
            className={`mt-1.5 text-2xl font-bold font-mono tabular-nums ${
              telemetry.h2sPpm >= thresholds.h2sCriticalPpm
                ? 'text-red-600'
                : telemetry.h2sPpm >= thresholds.h2sWarningPpm
                  ? 'text-amber-700'
                  : 'text-slate-900'
            }`}
          >
            {telemetry.h2sPpm} <span className="text-sm font-normal text-slate-500">ppm</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Warn {thresholds.h2sWarningPpm} · Lock {thresholds.h2sCriticalPpm} ppm
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Methane (CH₄)</p>
          <p
            className={`mt-1.5 text-2xl font-bold font-mono tabular-nums ${
              telemetry.ch4LelPct >= thresholds.ch4CriticalLelPct
                ? 'text-red-600'
                : telemetry.ch4LelPct >= thresholds.ch4WarningLelPct
                  ? 'text-amber-700'
                  : 'text-slate-900'
            }`}
          >
            {telemetry.ch4LelPct}% <span className="text-sm font-normal text-slate-500">LEL</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            CO {telemetry.coPpm} ppm · {telemetry.temperatureC}°C
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Turbidity &amp; Node Power</p>
          <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {telemetry.turbidityNtu} <span className="text-sm font-normal text-slate-500">NTU</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Battery {telemetry.batteryPct}% · {node.district}
          </p>
        </div>
      </div>

      {/* Live Historical Trend Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {node.name} — Real-Time Telemetry Trend
            </h2>
            <p className="text-xs text-slate-500">
              Latest 25 SQLite-persisted readings from simulated microcontroller {node.id}
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
            {(Object.keys(METRIC_META) as MetricKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMetric(key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  metric === key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {METRIC_META[key].label.split(' ')[0]} {key === 'h2sPpm' ? 'H₂S' : key === 'ch4LelPct' ? 'CH₄' : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72">
          {loadingHistory && history.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              Loading telemetry history...
            </div>
          ) : (
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(148, 163, 184, 0.18)' },
                  },
                  x: {
                    grid: { display: false },
                    ticks: { maxTicksLimit: 8 },
                  },
                },
              }}
            />
          )}
        </div>
      </div>

      {/* All Nodes Telemetry Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">All Drainage Junctions Telemetry</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-4">Node</th>
                <th className="py-2.5 px-4">Location</th>
                <th className="py-2.5 px-4 text-right">Level (%)</th>
                <th className="py-2.5 px-4 text-right">Flow (L/s)</th>
                <th className="py-2.5 px-4 text-right">H₂S (ppm)</th>
                <th className="py-2.5 px-4 text-right">CH₄ (%LEL)</th>
                <th className="py-2.5 px-4 text-right">Turbidity</th>
                <th className="py-2.5 px-4">Safety Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {data.nodes.map((snap) => {
                const isSelected = snap.node.id === selectedSnap.node.id;
                const critical =
                  snap.decision.humanEntryProhibited || snap.prediction.riskLevel === 'High';
                const warning = !critical && (snap.blockage.isBlocked || snap.prediction.riskLevel === 'Medium');
                return (
                  <tr
                    key={snap.node.id}
                    onClick={() => onSelectNode(snap.node.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-teal-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
                      {snap.node.id}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{snap.node.name}</div>
                      <div className="text-xs text-slate-500">{snap.node.sector}</div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {snap.telemetry.waterLevelPct}%
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {snap.telemetry.flowRateLps}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {snap.telemetry.h2sPpm}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {snap.telemetry.ch4LelPct}%
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {snap.telemetry.turbidityNtu} NTU
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusLabel
                        tone={critical ? 'critical' : warning ? 'warning' : 'nominal'}
                        label={
                          snap.decision.humanEntryProhibited
                            ? 'Entry Locked'
                            : warning
                              ? 'Attention'
                              : 'Nominal'
                        }
                      />
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
