import { useEffect, useMemo, useState } from 'react';
import { Check, Save, ShieldCheck } from 'lucide-react';
import type { AlertStatus, DashboardSnapshot, SafetyThresholds } from '../types/sani.ts';
import { formatTimeShort } from '../utils/chartSetup.ts';
import { StatusLabel } from './StatusLabel.tsx';

interface AlertsSafetyViewProps {
  data: DashboardSnapshot;
  onAcknowledgeAlert: (id: number) => void;
  onResolveAlert: (id: number) => void;
  onSaveThresholds: (thresholds: SafetyThresholds) => void;
  busy: boolean;
}

export function AlertsSafetyView({
  data,
  onAcknowledgeAlert,
  onResolveAlert,
  onSaveThresholds,
  busy,
}: AlertsSafetyViewProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | AlertStatus>('ALL');
  const [draft, setDraft] = useState<SafetyThresholds>(data.thresholds);
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    setDraft(data.thresholds);
  }, [data.thresholds]);

  const filteredAlerts = useMemo(() => {
    if (statusFilter === 'ALL') return data.alerts;
    return data.alerts.filter((a) => a.status === statusFilter);
  }, [data.alerts, statusFilter]);

  function handleThresholdSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSaveThresholds(draft);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  }

  return (
    <div className="space-y-6">
      {/* Human Safety & Mechanized Dispatch Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Threshold Configuration Card */}
        <form
          onSubmit={handleThresholdSubmit}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Configurable Safety Thresholds
            </h2>
            <p className="text-xs text-slate-500">
              Updates immediately re-evaluate AI agents and persist to SQLite
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="space-y-1">
              <span className="text-slate-600 block">Water Warn (%)</span>
              <input
                type="number"
                min={30}
                max={90}
                value={draft.waterLevelWarningPct}
                onChange={(e) =>
                  setDraft({ ...draft, waterLevelWarningPct: Number(e.target.value) })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono tabular-nums text-slate-900"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-600 block">Water Critical (%)</span>
              <input
                type="number"
                min={50}
                max={98}
                value={draft.waterLevelCriticalPct}
                onChange={(e) =>
                  setDraft({ ...draft, waterLevelCriticalPct: Number(e.target.value) })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono tabular-nums text-slate-900"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-600 block">H₂S Lockout (ppm)</span>
              <input
                type="number"
                min={2}
                max={50}
                value={draft.h2sWarningPpm}
                onChange={(e) => setDraft({ ...draft, h2sWarningPpm: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono tabular-nums text-slate-900"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-600 block">H₂S Critical (ppm)</span>
              <input
                type="number"
                min={5}
                max={100}
                value={draft.h2sCriticalPpm}
                onChange={(e) => setDraft({ ...draft, h2sCriticalPpm: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono tabular-nums text-slate-900"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-600 block">CH₄ Warn (%LEL)</span>
              <input
                type="number"
                min={2}
                max={40}
                value={draft.ch4WarningLelPct}
                onChange={(e) => setDraft({ ...draft, ch4WarningLelPct: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono tabular-nums text-slate-900"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-600 block">Flow Deficit (%)</span>
              <input
                type="number"
                min={10}
                max={80}
                value={draft.blockageFlowDeficitPct}
                onChange={(e) =>
                  setDraft({ ...draft, blockageFlowDeficitPct: Number(e.target.value) })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono tabular-nums text-slate-900"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0B1528] text-white hover:bg-[#13223D] transition-colors disabled:opacity-50"
          >
            {savedFeedback ? (
              <>
                <Check className="w-4 h-4 text-teal-400" />
                <span>Thresholds Saved</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Apply Safety Thresholds</span>
              </>
            )}
          </button>
        </form>

        {/* Mechanized Intervention Audit Log */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Mechanized Intervention &amp; Exposure Prevention Log
              </h2>
              <p className="text-xs text-slate-500">
                Tracks robotic deployments replacing manual confined-space sewage cleaning
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800">
              <ShieldCheck className="w-4 h-4 text-teal-700" />
              <span className="font-mono tabular-nums">
                {data.summary.humanEntriesPreventedTotal} entries avoided
              </span>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3">Location</th>
                  <th className="py-2 px-3">Mechanized Unit</th>
                  <th className="py-2 px-3 text-right">Staff Avoided</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.interventions.slice(0, 8).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatTimeShort(item.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{item.nodeName}</td>
                    <td className="py-2.5 px-3 text-slate-700">{item.unitName}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-teal-800">
                      {item.humanEntriesAvoided}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusLabel
                        tone={item.status === 'Completed' ? 'nominal' : 'info'}
                        label={item.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Alert & Notification History */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Alerts &amp; Safety Notification History
            </h2>
            <p className="text-xs text-slate-500">
              Active, acknowledged, and resolved alerts persisted in SQLite
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
            {(['ALL', 'Active', 'Acknowledged', 'Resolved'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === status
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status === 'ALL' ? 'All' : status}
              </button>
            ))}
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No alerts match the selected status filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 sm:px-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusLabel
                      tone={alert.severity === 'Critical' ? 'critical' : 'warning'}
                      label={`${alert.severity} · ${alert.category}`}
                    />
                    <span className="text-sm font-semibold text-slate-900">{alert.title}</span>
                    <span className="text-xs text-slate-500 font-mono tabular-nums">
                      {alert.nodeId} · {formatTimeShort(alert.updatedAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">{alert.description}</p>
                  <p className="text-xs font-medium text-red-800">{alert.humanSafetyNote}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {alert.status === 'Active' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onAcknowledgeAlert(alert.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Acknowledge
                    </button>
                  )}
                  {alert.status !== 'Resolved' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onResolveAlert(alert.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
                    >
                      Mark Resolved
                    </button>
                  ) : (
                    <StatusLabel tone="nominal" label="Resolved" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
