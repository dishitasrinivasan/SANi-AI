import { useCallback, useEffect, useState } from 'react';
import { Sidebar, type NavView } from './components/Sidebar.tsx';
import { TopBar } from './components/TopBar.tsx';
import { OverviewView } from './components/OverviewView.tsx';
import { LiveMonitoringView } from './components/LiveMonitoringView.tsx';
import { BlockageDetectionView } from './components/BlockageDetectionView.tsx';
import { PredictiveAnalyticsView } from './components/PredictiveAnalyticsView.tsx';
import { AgentActivityView } from './components/AgentActivityView.tsx';
import { DrainageMapView } from './components/DrainageMapView.tsx';
import { AlertsSafetyView } from './components/AlertsSafetyView.tsx';
import type { DashboardSnapshot, SafetyThresholds, ScenarioType } from './types/sani.ts';

export default function App() {
  const [activeView, setActiveView] = useState<NavView>('overview');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('ESP32-ND02');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as DashboardSnapshot;
      setData(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach SANI-AI backend.');
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
    const timer = setInterval(fetchSnapshot, 3500);
    return () => clearInterval(timer);
  }, [fetchSnapshot]);

  async function postAction(url: string, body?: unknown) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const payload = (await res.json()) as DashboardSnapshot;
      setData(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveThresholds(thresholds: SafetyThresholds) {
    setBusy(true);
    try {
      const res = await fetch('/api/thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(thresholds),
      });
      if (!res.ok) throw new Error(`Failed to save thresholds (${res.status})`);
      const payload = (await res.json()) as DashboardSnapshot;
      setData(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Threshold update failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full text-center space-y-2">
          <h1 className="text-lg font-semibold text-slate-900">SANI-AI</h1>
          <p className="text-sm text-slate-600">
            {error
              ? `Connection error: ${error}`
              : 'Initializing simulated ESP32 telemetry and multi-agent pipeline...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F4F6F9] text-slate-900">
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        activeAlertsCount={data.summary.activeAlertsCount}
        humanLockoutsCount={data.summary.humanEntryLockouts}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onTriggerScenario={(scenario: ScenarioType) =>
          postAction('/api/simulation/scenario', { scenario, nodeId: 'ALL' })
        }
        busy={busy}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeView={activeView}
          simulation={data.simulation}
          criticalAlertsCount={data.summary.criticalAlertsCount}
          onOpenMobileMenu={() => setMobileOpen(true)}
          onToggleSimulation={() => postAction('/api/simulation/toggle')}
          onStepSimulation={() => postAction('/api/simulation/tick')}
          onJumpToAlerts={() => setActiveView('alerts')}
          busy={busy}
        />

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}

          {activeView === 'overview' && (
            <OverviewView
              data={data}
              onDispatchIntervention={(nodeId) =>
                postAction('/api/interventions/dispatch', { nodeId })
              }
              onSelectNodeAndNavigate={(nodeId, view) => {
                setSelectedNodeId(nodeId);
                setActiveView(view);
              }}
              busy={busy}
            />
          )}

          {activeView === 'monitoring' && (
            <LiveMonitoringView
              data={data}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          )}

          {activeView === 'blockage' && (
            <BlockageDetectionView
              data={data}
              onDispatchIntervention={(nodeId) =>
                postAction('/api/interventions/dispatch', { nodeId })
              }
              onSimulateNodeBlockage={(nodeId) =>
                postAction('/api/simulation/scenario', { scenario: 'blockage', nodeId })
              }
              busy={busy}
            />
          )}

          {activeView === 'predictive' && (
            <PredictiveAnalyticsView
              data={data}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          )}

          {activeView === 'agents' && <AgentActivityView data={data} />}

          {activeView === 'map' && (
            <DrainageMapView
              data={data}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onDispatchIntervention={(nodeId) =>
                postAction('/api/interventions/dispatch', { nodeId })
              }
              onTriggerNodeScenario={(nodeId, scenario) =>
                postAction('/api/simulation/scenario', { scenario, nodeId })
              }
              busy={busy}
            />
          )}

          {activeView === 'alerts' && (
            <AlertsSafetyView
              data={data}
              onAcknowledgeAlert={(id) => postAction(`/api/alerts/${id}/acknowledge`)}
              onResolveAlert={(id) => postAction(`/api/alerts/${id}/resolve`)}
              onSaveThresholds={handleSaveThresholds}
              busy={busy}
            />
          )}
        </main>
      </div>
    </div>
  );
}
