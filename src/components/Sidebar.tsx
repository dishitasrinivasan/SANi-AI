import {
  Activity,
  AlertOctagon,
  Bot,
  Gauge,
  LayoutDashboard,
  MapPin,
  ShieldCheck,
  TrendingUp,
  Waves,
  X,
} from 'lucide-react';
import type { ScenarioType } from '../types/sani.ts';

export type NavView =
  | 'overview'
  | 'monitoring'
  | 'blockage'
  | 'predictive'
  | 'agents'
  | 'map'
  | 'alerts';

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  activeAlertsCount: number;
  humanLockoutsCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onTriggerScenario: (scenario: ScenarioType) => void;
  busy: boolean;
}

const NAV_ITEMS: Array<{ id: NavView; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'monitoring', label: 'Live Sensors', icon: Gauge },
  { id: 'blockage', label: 'Blockage Detection', icon: Waves },
  { id: 'predictive', label: 'Predictive Analytics', icon: TrendingUp },
  { id: 'agents', label: 'AI Agent Activity', icon: Bot },
  { id: 'map', label: 'Drainage Map', icon: MapPin },
  { id: 'alerts', label: 'Alerts & Safety', icon: AlertOctagon },
];

export function Sidebar({
  activeView,
  onSelectView,
  activeAlertsCount,
  humanLockoutsCount,
  mobileOpen,
  onCloseMobile,
  onTriggerScenario,
  busy,
}: SidebarProps) {
  const sidebarBody = (
    <div className="flex flex-col h-full bg-[#0B1528] text-slate-100 w-64 select-none">
      {/* Brand header */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shrink-0">
            <ShieldCheck className="w-4.5 h-4.5" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-white whitespace-nowrap">
            SANI-AI
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectView(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-300 hover:bg-[#13223D] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === 'alerts' && activeAlertsCount > 0 && (
                <span
                  className={`text-xs font-mono tabular-nums px-1.5 py-0.5 rounded ${
                    isActive ? 'bg-teal-800 text-white' : 'bg-red-600/90 text-white'
                  }`}
                >
                  {activeAlertsCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Hackathon Demo Scenario Controls */}
      <div className="px-4 py-4 border-t border-slate-800/80 space-y-2.5 bg-[#08101F]">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-medium text-slate-300">Simulation Scenarios</span>
          <Activity className="w-3.5 h-3.5 text-teal-400" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onTriggerScenario('normal')}
            className="px-2.5 py-1.5 text-xs font-medium rounded bg-[#13223D] hover:bg-teal-700/70 text-slate-200 transition-colors text-left truncate disabled:opacity-50"
          >
            Normal Flow
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onTriggerScenario('blockage')}
            className="px-2.5 py-1.5 text-xs font-medium rounded bg-[#13223D] hover:bg-amber-700/70 text-slate-200 transition-colors text-left truncate disabled:opacity-50"
          >
            Test Blockage
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onTriggerScenario('gas_leak')}
            className="px-2.5 py-1.5 text-xs font-medium rounded bg-[#13223D] hover:bg-red-700/70 text-slate-200 transition-colors text-left truncate disabled:opacity-50"
          >
            Gas Surge
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onTriggerScenario('storm_surge')}
            className="px-2.5 py-1.5 text-xs font-medium rounded bg-[#13223D] hover:bg-amber-700/70 text-slate-200 transition-colors text-left truncate disabled:opacity-50"
          >
            Storm Surge
          </button>
        </div>

        <div className="pt-2 border-t border-slate-800/70 text-[11px] text-slate-400 leading-relaxed">
          <div className="flex items-center justify-between text-slate-300 mb-0.5">
            <span>Human-Entry Lockouts</span>
            <span className="font-mono tabular-nums font-semibold text-amber-400">
              {humanLockoutsCount} nodes
            </span>
          </div>
          <p className="text-slate-400">
            Simulated ESP32 prototype. No physical sensors connected.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden lg:block shrink-0 border-r border-slate-800">{sidebarBody}</aside>

      {/* Mobile overlay drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarBody}</div>
        </div>
      )}
    </>
  );
}
