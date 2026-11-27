import { ShieldAlert, Wrench } from 'lucide-react';
import type { DashboardSnapshot, NodeSnapshot, ScenarioType } from '../types/sani.ts';
import { StatusLabel } from './StatusLabel.tsx';

interface DrainageMapViewProps {
  data: DashboardSnapshot;
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  onDispatchIntervention: (nodeId: string) => void;
  onTriggerNodeScenario: (nodeId: string, scenario: ScenarioType) => void;
  busy: boolean;
}

function getNodeStatusColor(snap: NodeSnapshot): {
  stroke: string;
  fill: string;
  label: string;
  tone: 'nominal' | 'warning' | 'critical';
} {
  if (snap.decision.humanEntryProhibited || snap.prediction.riskLevel === 'High') {
    return {
      stroke: '#DC2626',
      fill: '#FEF2F2',
      label: snap.decision.humanEntryProhibited ? 'Safety Lockout' : 'High Risk',
      tone: 'critical',
    };
  }
  if (snap.blockage.isBlocked || snap.prediction.riskLevel === 'Medium') {
    return {
      stroke: '#D97706',
      fill: '#FFFBEB',
      label: snap.blockage.isBlocked ? `${snap.blockage.severity} Blockage` : 'Medium Risk',
      tone: 'warning',
    };
  }
  return {
    stroke: '#0D9488',
    fill: '#F0FDFA',
    label: 'Nominal',
    tone: 'nominal',
  };
}

export function DrainageMapView({
  data,
  selectedNodeId,
  onSelectNode,
  onDispatchIntervention,
  onTriggerNodeScenario,
  busy,
}: DrainageMapViewProps) {
  const selectedSnap =
    data.nodes.find((n) => n.node.id === selectedNodeId) ?? data.nodes[0];
  const selectedStatus = getNodeStatusColor(selectedSnap);

  const nodeById = new Map(data.nodes.map((n) => [n.node.id, n]));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
      {/* Interactive Smart-City Schematic Map */}
      <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Municipal Drainage Network Schematic
            </h2>
            <p className="text-xs text-slate-500">
              Simulated sample junctions · Select any node marker to inspect telemetry &amp; dispatch robotics
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600" /> Nominal
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600" /> Warning / Blockage
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Critical / Lockout
            </span>
          </div>
        </div>

        <div className="flex-1 bg-[#F8FAFC] border border-slate-200 rounded-lg overflow-hidden">
          <svg
            viewBox="0 0 920 520"
            className="w-full h-full min-h-[360px]"
            role="img"
            aria-label="Interactive drainage network map"
          >
            {/* Subtle city sector grid */}
            <defs>
              <pattern id="cityGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E2E8F0" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="920" height="520" fill="url(#cityGrid)" />

            {/* District zone outlines */}
            <rect
              x="40"
              y="35"
              width="255"
              height="215"
              rx="10"
              fill="#FFFFFF"
              fillOpacity="0.65"
              stroke="#CBD5E1"
              strokeDasharray="4 4"
            />
            <text x="56" y="60" fontSize="12" fontWeight="600" fill="#475569">
              North Basin · Industrial Corridor
            </text>

            <rect
              x="315"
              y="35"
              width="340"
              height="340"
              rx="10"
              fill="#FFFFFF"
              fillOpacity="0.65"
              stroke="#CBD5E1"
              strokeDasharray="4 4"
            />
            <text x="332" y="60" fontSize="12" fontWeight="600" fill="#475569">
              Central Ward · Commercial &amp; Metro Siphon
            </text>

            <rect
              x="675"
              y="35"
              width="210"
              height="220"
              rx="10"
              fill="#FFFFFF"
              fillOpacity="0.65"
              stroke="#CBD5E1"
              strokeDasharray="4 4"
            />
            <text x="690" y="60" fontSize="12" fontWeight="600" fill="#475569">
              East Sector · Tech Park
            </text>

            <rect
              x="40"
              y="270"
              width="380"
              height="215"
              rx="10"
              fill="#E0F2FE"
              fillOpacity="0.35"
              stroke="#93C5FD"
              strokeDasharray="4 4"
            />
            <text x="56" y="295" fontSize="12" fontWeight="600" fill="#1E40AF">
              West Dock · Riverfront Outfall Channel
            </text>

            <rect
              x="540"
              y="385"
              width="345"
              height="100"
              rx="10"
              fill="#FFFFFF"
              fillOpacity="0.65"
              stroke="#CBD5E1"
              strokeDasharray="4 4"
            />
            <text x="556" y="408" fontSize="12" fontWeight="600" fill="#475569">
              South Basin · Retention Zone
            </text>

            {/* Underground drainage trunk conduits */}
            {data.nodes.map((snap) => {
              if (!snap.node.downstreamId) return null;
              const target = nodeById.get(snap.node.downstreamId);
              if (!target) return null;
              const isImpeded = snap.blockage.isBlocked;
              return (
                <g key={`${snap.node.id}-${target.node.id}`}>
                  <line
                    x1={snap.node.mapX}
                    y1={snap.node.mapY}
                    x2={target.node.mapX}
                    y2={target.node.mapY}
                    stroke={isImpeded ? '#D97706' : '#0F1D36'}
                    strokeWidth={isImpeded ? 5 : 4}
                    strokeOpacity={0.75}
                    strokeDasharray={isImpeded ? '8 5' : undefined}
                  />
                  {/* Midpoint flow indicator */}
                  <circle
                    cx={(snap.node.mapX + target.node.mapX) / 2}
                    cy={(snap.node.mapY + target.node.mapY) / 2}
                    r="4"
                    fill={isImpeded ? '#D97706' : '#0D9488'}
                  />
                </g>
              );
            })}

            {/* Clickable ESP32 Junction Nodes */}
            {data.nodes.map((snap) => {
              const status = getNodeStatusColor(snap);
              const isSelected = snap.node.id === selectedSnap.node.id;
              return (
                <g
                  key={snap.node.id}
                  transform={`translate(${snap.node.mapX}, ${snap.node.mapY})`}
                  onClick={() => onSelectNode(snap.node.id)}
                  className="cursor-pointer"
                >
                  {isSelected && (
                    <circle
                      r="30"
                      fill="none"
                      stroke="#0B1528"
                      strokeWidth="2.5"
                      strokeDasharray="4 3"
                    />
                  )}
                  <circle
                    r="22"
                    fill={status.fill}
                    stroke={status.stroke}
                    strokeWidth="3"
                  />
                  <text
                    textAnchor="middle"
                    y="4"
                    fontSize="11"
                    fontWeight="700"
                    fill="#0F172A"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {Math.round(snap.telemetry.waterLevelPct)}%
                  </text>
                  <rect
                    x="-64"
                    y="28"
                    width="128"
                    height="34"
                    rx="6"
                    fill="#FFFFFF"
                    stroke={isSelected ? '#0B1528' : '#CBD5E1'}
                    strokeWidth={isSelected ? 1.5 : 1}
                  />
                  <text
                    textAnchor="middle"
                    y="42"
                    fontSize="10.5"
                    fontWeight="600"
                    fill="#0F172A"
                  >
                    {snap.node.name.length > 18
                      ? `${snap.node.name.slice(0, 17)}…`
                      : snap.node.name}
                  </text>
                  <text
                    textAnchor="middle"
                    y="55"
                    fontSize="9.5"
                    fill="#475569"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {snap.telemetry.flowRateLps} L/s · {snap.telemetry.h2sPpm} ppm
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Side Node Inspection & Robotic Dispatch Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-5">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-xs font-mono text-slate-500">
                {selectedSnap.node.id} · {selectedSnap.node.district}
              </span>
              <h3 className="text-lg font-semibold text-slate-900">
                {selectedSnap.node.name}
              </h3>
              <p className="text-xs text-slate-500">{selectedSnap.node.sector}</p>
            </div>
            <StatusLabel tone={selectedStatus.tone} label={selectedStatus.label} />
          </div>

          {selectedSnap.decision.humanEntryProhibited && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2.5 text-xs text-red-900">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Human Entry Prohibited</p>
                <p className="mt-0.5 text-red-800">{selectedSnap.decision.safetyLockReason}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
            <div>
              <span className="text-slate-500 block">Water Level</span>
              <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                {selectedSnap.telemetry.waterLevelPct}% ({selectedSnap.telemetry.waterLevelCm} cm)
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Flow Rate</span>
              <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                {selectedSnap.telemetry.flowRateLps} L/s
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">H₂S Gas</span>
              <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                {selectedSnap.telemetry.h2sPpm} ppm
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Overflow Risk</span>
              <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                {selectedSnap.prediction.riskLevel} ({selectedSnap.prediction.overflowProbabilityPct}%)
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-1.5">
            <h4 className="text-xs font-semibold text-slate-900">
              AI Decision-Making Agent Recommendation
            </h4>
            <p className="text-xs font-medium text-teal-800">
              {selectedSnap.decision.recommendedUnit}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              {selectedSnap.decision.actionRationale}
            </p>
          </div>
        </div>

        <div className="space-y-2.5 pt-3 border-t border-slate-200">
          {selectedSnap.decision.interventionActive ? (
            <div className="w-full py-2.5 px-4 rounded-lg bg-teal-50 border border-teal-200 text-center text-xs font-semibold text-teal-800">
              Mechanized Unit Active ({selectedSnap.interventionRemainingTicks} cycles remaining)
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDispatchIntervention(selectedSnap.node.id)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors disabled:opacity-50"
            >
              <Wrench className="w-4 h-4" />
              <span>Dispatch Mechanized Intervention</span>
            </button>
          )}

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => onTriggerNodeScenario(selectedSnap.node.id, 'blockage')}
              className="px-2 py-1.5 text-[11px] font-medium rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Test Blockage
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onTriggerNodeScenario(selectedSnap.node.id, 'gas_leak')}
              className="px-2 py-1.5 text-[11px] font-medium rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Test Gas Spike
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onTriggerNodeScenario(selectedSnap.node.id, 'normal')}
              className="px-2 py-1.5 text-[11px] font-medium rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Reset Node
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
