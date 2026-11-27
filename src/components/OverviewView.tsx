import { useMemo } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { ArrowRight, Bot, ShieldCheck, Wrench } from 'lucide-react';
import '../utils/chartSetup.ts';
import type { DashboardSnapshot } from '../types/sani.ts';
import { StatusLabel } from './StatusLabel.tsx';
import { formatTimeShort } from '../utils/chartSetup.ts';
import type { NavView } from './Sidebar.tsx';

interface OverviewViewProps {
  data: DashboardSnapshot;
  onDispatchIntervention: (nodeId: string) => void;
  onSelectNodeAndNavigate: (nodeId: string, view: NavView) => void;
  busy: boolean;
}

export function OverviewView({
  data,
  onDispatchIntervention,
  onSelectNodeAndNavigate,
  busy,
}: OverviewViewProps) {
  const { summary, nodes, agentLogs, thresholds } = data;

  const networkChartData = useMemo(() => {
    const ordered = [...nodes].sort((a, b) => a.node.id.localeCompare(b.node.id));
    return {
      labels: ordered.map((n) => n.node.name.replace('Sector 4 ', 'S4 ').replace('Riverfront ', 'River ')),
      datasets: [
        {
          label: 'Water Level (% Capacity)',
          data: ordered.map((n) => n.telemetry.waterLevelPct),
          backgroundColor: ordered.map((n) =>
            n.telemetry.waterLevelPct >= thresholds.waterLevelCriticalPct
              ? '#DC2626'
              : n.telemetry.waterLevelPct >= thresholds.waterLevelWarningPct
                ? '#D97706'
                : '#0D9488'
          ),
          borderRadius: 4,
          barPercentage: 0.58,
        },
        {
          label: 'H₂S Gas (ppm)',
          data: ordered.map((n) => n.telemetry.h2sPpm),
          backgroundColor: '#0F1D36',
          borderRadius: 4,
          barPercentage: 0.58,
        },
      ],
    };
  }, [nodes, thresholds]);

  const riskDistribution = useMemo(() => {
    let low = 0;
    let medium = 0;
    let high = 0;
    for (const n of nodes) {
      if (n.prediction.riskLevel === 'High') high += 1;
      else if (n.prediction.riskLevel === 'Medium') medium += 1;
      else low += 1;
    }
    return {
      labels: ['Low Risk', 'Medium Risk', 'High Risk'],
      datasets: [
        {
          data: [low, medium, high],
          backgroundColor: ['#0D9488', '#D97706', '#DC2626'],
          borderColor: '#FFFFFF',
          borderWidth: 2,
        },
      ],
    };
  }, [nodes]);

  const topDecisions = useMemo(() => {
    return [...nodes]
      .sort((a, b) => a.decision.priorityRank - b.decision.priorityRank)
      .slice(0, 4);
  }, [nodes]);

  const recentLogs = agentLogs.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Prototype Safety Banner */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Human-Safety First Protocol:</span>{' '}
            SANI-AI locks confined-space entry whenever H₂S ≥ {thresholds.h2sWarningPpm} ppm or CH₄ ≥{' '}
            {thresholds.ch4WarningLelPct}% LEL and prescribes mechanized cleaning instead.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelectNodeAndNavigate(topDecisions[0]?.node.id ?? 'ESP32-ND01', 'map')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
        >
          <span>Inspect Network Map</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Monitored ESP32 Junctions</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
              {summary.totalNodes}
            </span>
            <span className="text-xs text-slate-600 tabular-nums">
              {summary.nominalNodes} nominal · {summary.totalNodes - summary.nominalNodes} attention
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Detected Blockages</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold tabular-nums font-mono ${
                summary.activeBlockages > 0 ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {summary.activeBlockages}
            </span>
            <StatusLabel
              tone={summary.activeBlockages > 0 ? 'warning' : 'nominal'}
              label={summary.activeBlockages > 0 ? 'Impedance Active' : 'Flow Clear'}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">High Overflow Risk Nodes</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold tabular-nums font-mono ${
                summary.highRiskNodes > 0 ? 'text-red-600' : 'text-slate-900'
              }`}
            >
              {summary.highRiskNodes}
            </span>
            <StatusLabel
              tone={summary.highRiskNodes > 0 ? 'critical' : 'nominal'}
              label={summary.highRiskNodes > 0 ? 'Immediate Action' : 'Contained'}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Human Entries Prevented</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-teal-700 tabular-nums font-mono">
              {summary.humanEntriesPreventedTotal}
            </span>
            <span className="text-xs text-slate-600 tabular-nums">
              {summary.humanEntryLockouts} locked zones
            </span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Network Fill Level &amp; H₂S Gas Profile
              </h2>
              <p className="text-xs text-slate-500">
                Live simulated ESP32 conduit capacity (%) and hydrogen sulfide (ppm) across 6 junctions
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectNodeAndNavigate('ESP32-ND01', 'monitoring')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
            >
              Open Live Sensors
            </button>
          </div>
          <div className="h-72">
            <Bar
              data={networkChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top', align: 'end' },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    suggestedMax: 100,
                    grid: { color: 'rgba(148, 163, 184, 0.18)' },
                  },
                  x: {
                    grid: { display: false },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Overflow Risk Distribution</h2>
            <p className="text-xs text-slate-500">
              Predictive Analysis Agent classification across nodes
            </p>
          </div>
          <div className="h-56 flex-1 flex items-center justify-center">
            <Doughnut
              data={riskDistribution}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '64%',
                plugins: {
                  legend: { position: 'bottom' },
                },
              }}
            />
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Active Alerts</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {summary.activeAlertsCount} ({summary.criticalAlertsCount} critical)
            </span>
          </div>
        </div>
      </div>

      {/* Priority Mechanized Action Queue + Agent Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                AI Decision-Making Agent — Priority Action Queue
              </h2>
              <p className="text-xs text-slate-500">
                Locations ranked by composite gas hazard, blockage severity, and overflow urgency
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {topDecisions.map(({ node, telemetry, blockage, prediction, decision }) => {
              const needsAction =
                decision.urgencyScore >= 40 || blockage.isBlocked || decision.humanEntryProhibited;
              return (
                <div
                  key={node.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                        #{decision.priorityRank}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectNodeAndNavigate(node.id, 'monitoring')}
                        className="text-sm font-semibold text-slate-900 hover:text-teal-700 text-left"
                      >
                        {node.name}
                      </button>
                      <span className="text-xs text-slate-500">
                        {node.id} · {node.sector}
                      </span>
                      {decision.humanEntryProhibited && (
                        <StatusLabel tone="critical" label="No Human Entry" />
                      )}
                      {!decision.humanEntryProhibited && prediction.riskLevel === 'Medium' && (
                        <StatusLabel tone="warning" label="Medium Risk" />
                      )}
                      {!decision.humanEntryProhibited && prediction.riskLevel === 'Low' && (
                        <StatusLabel tone="nominal" label="Nominal" />
                      )}
                    </div>
                    <p className="text-xs text-slate-700">
                      <span className="font-medium text-slate-900">{decision.actionTitle}</span> —{' '}
                      {decision.recommendedUnit}
                    </p>
                    <p className="text-xs text-slate-500 font-mono tabular-nums">
                      Level {telemetry.waterLevelPct}% · Flow {telemetry.flowRateLps} L/s · H₂S{' '}
                      {telemetry.h2sPpm} ppm · Urgency {decision.urgencyScore}/100
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {decision.interventionActive ? (
                      <StatusLabel tone="info" label="Robotic Unit Active" />
                    ) : (
                      <button
                        type="button"
                        disabled={busy || !needsAction}
                        onClick={() => onDispatchIntervention(node.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                          needsAction
                            ? 'bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>{needsAction ? 'Dispatch Robotics' : 'Monitoring Only'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Multi-Agent Feed */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Recent Agent Activity</h2>
              <p className="text-xs text-slate-500">Latest multi-agent reasoning events</p>
            </div>
            <button
              type="button"
              onClick={() => onSelectNodeAndNavigate('ESP32-ND01', 'agents')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
            >
              View All
            </button>
          </div>

          {recentLogs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-xs text-slate-500">
              <Bot className="w-6 h-6 text-slate-400 mb-2" />
              <p>All nodes are operating smoothly. Trigger a test scenario to observe agent coordination.</p>
            </div>
          ) : (
            <div className="space-y-3 divide-y divide-slate-100">
              {recentLogs.map((log) => (
                <div key={log.id} className="pt-3 first:pt-0 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-800">{log.agent}</span>
                    <span className="font-mono tabular-nums text-slate-400">
                      {formatTimeShort(log.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{log.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
