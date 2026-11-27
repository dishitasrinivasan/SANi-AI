import { useMemo, useState } from 'react';
import { ArrowRight, Bot, Cpu, ShieldCheck, TrendingUp, Waves } from 'lucide-react';
import type { AgentName, DashboardSnapshot } from '../types/sani.ts';
import { formatTimeShort } from '../utils/chartSetup.ts';
import { StatusLabel } from './StatusLabel.tsx';

interface AgentActivityViewProps {
  data: DashboardSnapshot;
}

const AGENT_PROFILES: Array<{
  id: AgentName;
  title: string;
  stage: string;
  role: string;
  icon: typeof Cpu;
}> = [
  {
    id: 'MonitoringAgent',
    title: 'AI Monitoring Agent',
    stage: '01. Observe',
    role: 'Ingests simulated ESP32 water level, flow, and H₂S/CH₄ gas packets and enforces entry lockouts.',
    icon: Cpu,
  },
  {
    id: 'BlockageDetectionAgent',
    title: 'Blockage Detection Agent',
    stage: '02. Analyze',
    role: 'Correlates rising water level with hydraulic flow deficit to pinpoint debris or grease obstructions.',
    icon: Waves,
  },
  {
    id: 'PredictiveAnalysisAgent',
    title: 'Predictive Analysis Agent',
    stage: '03. Predict',
    role: 'Applies OLS trend regression and logistic scoring over SQLite history to forecast overflow risk.',
    icon: TrendingUp,
  },
  {
    id: 'DecisionMakingAgent',
    title: 'AI Decision-Making Agent',
    stage: '04. Decide',
    role: 'Synthesizes upstream agent signals, ranks urgency, and prescribes mechanized robotic interventions.',
    icon: ShieldCheck,
  },
];

export function AgentActivityView({ data }: AgentActivityViewProps) {
  const [agentFilter, setAgentFilter] = useState<'ALL' | AgentName>('ALL');

  const filteredLogs = useMemo(() => {
    if (agentFilter === 'ALL') return data.agentLogs;
    return data.agentLogs.filter((l) => l.agent === agentFilter);
  }, [data.agentLogs, agentFilter]);

  return (
    <div className="space-y-6">
      {/* 4-Agent Collaboration Pipeline */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Multi-Agent Collaboration Architecture
          </h2>
          <p className="text-xs text-slate-500">
            Four specialized logical agents collaborate on every simulated ESP32 telemetry cycle
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {AGENT_PROFILES.map((agent, index) => {
            const Icon = agent.icon;
            const agentEventCount = data.agentLogs.filter((l) => l.agent === agent.id).length;
            return (
              <div
                key={agent.id}
                className="relative border border-slate-200 rounded-lg p-4 bg-slate-50/60 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-teal-800">{agent.stage}</span>
                    {index < AGENT_PROFILES.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-slate-400 hidden xl:block" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-[#0B1528] text-white flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">{agent.title}</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{agent.role}</p>
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
                  <span>Logged signals</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-800">
                    {agentEventCount}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filterable Inter-Agent Collaboration Log */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Agent Collaboration Trace Log</h2>
            <p className="text-xs text-slate-500">
              Persisted reasoning events from SQLite (`agent_logs`)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setAgentFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                agentFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Agents
            </button>
            {AGENT_PROFILES.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAgentFilter(a.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  agentFilter === a.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {a.id.replace('Agent', '')}
              </button>
            ))}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
            <Bot className="w-6 h-6 text-slate-400" />
            <p>No agent warning or critical logs recorded yet for this filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Time</th>
                  <th className="py-2.5 px-4">Agent</th>
                  <th className="py-2.5 px-4">Node</th>
                  <th className="py-2.5 px-4">Severity</th>
                  <th className="py-2.5 px-4">Reasoning Output</th>
                  <th className="py-2.5 px-4">Telemetry Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatTimeShort(log.timestamp)}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {log.agent}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {log.nodeId}
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusLabel
                        tone={
                          log.severity === 'critical'
                            ? 'critical'
                            : log.severity === 'warning'
                              ? 'warning'
                              : 'info'
                        }
                        label={
                          log.severity === 'critical'
                            ? 'Critical'
                            : log.severity === 'warning'
                              ? 'Warning'
                              : 'Resolved'
                        }
                      />
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 max-w-md">{log.message}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {log.payloadSummary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
