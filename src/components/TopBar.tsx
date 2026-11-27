import { Menu, Pause, Play, SkipForward, ShieldAlert } from 'lucide-react';
import type { NavView } from './Sidebar.tsx';
import type { SimulationState } from '../types/sani.ts';

interface TopBarProps {
  activeView: NavView;
  simulation: SimulationState;
  criticalAlertsCount: number;
  onOpenMobileMenu: () => void;
  onToggleSimulation: () => void;
  onStepSimulation: () => void;
  onJumpToAlerts: () => void;
  busy: boolean;
}

const VIEW_TITLES: Record<NavView, string> = {
  overview: 'Municipal Overview',
  monitoring: 'Live ESP32 Sensor Monitoring',
  blockage: 'Blockage Detection Diagnostics',
  predictive: 'Predictive Overflow Analytics',
  agents: 'Multi-Agent Collaboration Pipeline',
  map: 'Drainage Network Location Map',
  alerts: 'Safety Alerts & Threshold Controls',
};

export function TopBar({
  activeView,
  simulation,
  criticalAlertsCount,
  onOpenMobileMenu,
  onToggleSimulation,
  onStepSimulation,
  onJumpToAlerts,
  busy,
}: TopBarProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-6 shrink-0">
      {/* Zone 1: Mobile menu button + View breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
            <span>SANI-AI</span>
            <span aria-hidden="true">/</span>
            <span className="truncate">Simulated Prototype Telemetry</span>
          </div>
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
            {VIEW_TITLES[activeView]}
          </h1>
        </div>
      </div>

      {/* Zone 2: Simulation controls */}
      <div className="hidden md:flex items-center gap-2 shrink-0">
        <span className="text-xs text-slate-500 font-mono tabular-nums mr-1 whitespace-nowrap">
          Cycle #{simulation.tickCount}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={onToggleSimulation}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          {simulation.running ? (
            <>
              <Pause className="w-3.5 h-3.5 text-teal-700" />
              <span>Pause Stream</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-teal-700" />
              <span>Resume Stream</span>
            </>
          )}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onStepSimulation}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <SkipForward className="w-3.5 h-3.5 text-slate-600" />
          <span>Step Tick</span>
        </button>
      </div>

      {/* Zone 3: Single primary action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onJumpToAlerts}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            criticalAlertsCount > 0
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-teal-700 text-white hover:bg-teal-800'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span className="tabular-nums">
            {criticalAlertsCount > 0
              ? `${criticalAlertsCount} Critical Alert${criticalAlertsCount > 1 ? 's' : ''}`
              : 'Safety & Thresholds'}
          </span>
        </button>
      </div>
    </header>
  );
}
