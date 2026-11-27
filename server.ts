import express from 'express';
import path from 'path';
import {
  getAlerts,
  getAgentLogs,
  getInterventions,
  getNodeHistory,
  getThresholds,
  initDatabase,
  recordIntervention,
  SAMPLE_NODES,
  updateAlertStatus,
  updateThresholds,
} from './server/db.ts';
import {
  evaluateAllNodesSnapshot,
  runMultiAgentCycle,
} from './server/agents/multiAgentSystem.ts';
import {
  initSimulatorRuntime,
  setNetworkScenario,
  triggerNodeIntervention,
} from './server/simulator/esp32Simulator.ts';
import type {
  DashboardSnapshot,
  NodeSnapshot,
  ScenarioType,
  SafetyThresholds,
} from './src/types/sani.ts';

const PORT = Number(process.env.PORT) || 3000;

// Initialize SQLite database and ESP32 simulator state
initDatabase();
initSimulatorRuntime();

let simulationRunning = true;
let tickCount = 1;
let lastTickAt = new Date().toISOString();
const INTERVAL_MS = 3500;

let latestSnapshots: NodeSnapshot[] = evaluateAllNodesSnapshot();

function buildDashboardSnapshot(): DashboardSnapshot {
  const alerts = getAlerts(100);
  const agentLogs = getAgentLogs(70);
  const interventions = getInterventions(40);
  const thresholds = getThresholds();

  const activeAlerts = alerts.filter((a) => a.status === 'Active');
  const criticalAlerts = activeAlerts.filter((a) => a.severity === 'Critical');

  const activeBlockages = latestSnapshots.filter((n) => n.blockage.isBlocked).length;
  const highRiskNodes = latestSnapshots.filter((n) => n.prediction.riskLevel === 'High').length;
  const humanEntryLockouts = latestSnapshots.filter((n) => n.decision.humanEntryProhibited).length;
  const nominalNodes = latestSnapshots.filter(
    (n) => !n.blockage.isBlocked && n.prediction.riskLevel === 'Low' && !n.decision.humanEntryProhibited
  ).length;

  const humanEntriesPreventedTotal = interventions.reduce(
    (sum, item) => sum + item.humanEntriesAvoided,
    0
  );

  return {
    simulation: {
      running: simulationRunning,
      tickCount,
      lastTickAt,
      intervalMs: INTERVAL_MS,
    },
    thresholds,
    nodes: latestSnapshots,
    alerts,
    agentLogs,
    interventions,
    summary: {
      totalNodes: latestSnapshots.length,
      nominalNodes,
      activeBlockages,
      highRiskNodes,
      humanEntryLockouts,
      activeAlertsCount: activeAlerts.length,
      criticalAlertsCount: criticalAlerts.length,
      humanEntriesPreventedTotal,
    },
  };
}

// Background simulation tick loop
setInterval(() => {
  if (!simulationRunning) return;
  tickCount += 1;
  lastTickAt = new Date().toISOString();
  latestSnapshots = runMultiAgentCycle(tickCount);
}, INTERVAL_MS);

async function startServer() {
  const app = express();
  app.use(express.json());

  // Full dashboard snapshot endpoint
  app.get('/api/dashboard', (_req, res) => {
    res.json(buildDashboardSnapshot());
  });

  // Historical telemetry for a specific drainage node (for Chart.js trends & regression)
  app.get('/api/nodes/:id/history', (req, res) => {
    const { id } = req.params;
    const limit = Math.min(120, Math.max(5, Number(req.query.limit) || 30));
    const exists = SAMPLE_NODES.some((n) => n.id === id);
    if (!exists) {
      res.status(404).json({ error: `Unknown node ID: ${id}` });
      return;
    }
    const history = getNodeHistory(id, limit);
    res.json({ nodeId: id, history });
  });

  // Manual simulation step
  app.post('/api/simulation/tick', (_req, res) => {
    tickCount += 1;
    lastTickAt = new Date().toISOString();
    latestSnapshots = runMultiAgentCycle(tickCount);
    res.json(buildDashboardSnapshot());
  });

  // Pause / resume automatic simulation
  app.post('/api/simulation/toggle', (req, res) => {
    if (typeof req.body?.running === 'boolean') {
      simulationRunning = req.body.running;
    } else {
      simulationRunning = !simulationRunning;
    }
    res.json(buildDashboardSnapshot());
  });

  // Inject simulated municipal scenarios
  app.post('/api/simulation/scenario', (req, res) => {
    const scenario = req.body?.scenario as ScenarioType | undefined;
    const targetNodeId = req.body?.nodeId as string | undefined;
    const valid: ScenarioType[] = ['normal', 'blockage', 'gas_leak', 'storm_surge'];
    if (!scenario || !valid.includes(scenario)) {
      res.status(400).json({ error: 'Invalid scenario type.' });
      return;
    }
    setNetworkScenario(scenario, targetNodeId);
    tickCount += 1;
    lastTickAt = new Date().toISOString();
    latestSnapshots = runMultiAgentCycle(tickCount);
    res.json(buildDashboardSnapshot());
  });

  // Dispatch mechanized / robotic intervention (zero human confined-space exposure)
  app.post('/api/interventions/dispatch', (req, res) => {
    const nodeId = req.body?.nodeId as string | undefined;
    const snap = latestSnapshots.find((s) => s.node.id === nodeId);
    if (!snap) {
      res.status(404).json({ error: 'Drainage node not found.' });
      return;
    }

    triggerNodeIntervention(snap.node.id, 4);
    recordIntervention({
      nodeId: snap.node.id,
      nodeName: snap.node.name,
      unitName: snap.decision.recommendedUnit,
      actionTitle: snap.decision.actionTitle,
      triggeredBy: 'Sanitation Authority Operator · DecisionMakingAgent',
      humanEntriesAvoided: snap.decision.humanEntryProhibited ? 2 : 1,
      status: 'Dispatched',
    });

    tickCount += 1;
    lastTickAt = new Date().toISOString();
    latestSnapshots = runMultiAgentCycle(tickCount);
    res.json(buildDashboardSnapshot());
  });

  // Acknowledge or resolve an alert
  app.post('/api/alerts/:id/acknowledge', (req, res) => {
    const alertId = Number(req.params.id);
    if (!Number.isFinite(alertId)) {
      res.status(400).json({ error: 'Invalid alert ID.' });
      return;
    }
    updateAlertStatus(alertId, 'Acknowledged');
    res.json(buildDashboardSnapshot());
  });

  app.post('/api/alerts/:id/resolve', (req, res) => {
    const alertId = Number(req.params.id);
    if (!Number.isFinite(alertId)) {
      res.status(400).json({ error: 'Invalid alert ID.' });
      return;
    }
    updateAlertStatus(alertId, 'Resolved');
    res.json(buildDashboardSnapshot());
  });

  // Update configurable safety thresholds
  app.put('/api/thresholds', (req, res) => {
    const body = req.body as Partial<SafetyThresholds>;
    const current = getThresholds();
    const next: SafetyThresholds = {
      waterLevelWarningPct: clampNum(body.waterLevelWarningPct, 30, 90, current.waterLevelWarningPct),
      waterLevelCriticalPct: clampNum(body.waterLevelCriticalPct, 50, 98, current.waterLevelCriticalPct),
      blockageFlowDeficitPct: clampNum(body.blockageFlowDeficitPct, 10, 80, current.blockageFlowDeficitPct),
      h2sWarningPpm: clampNum(body.h2sWarningPpm, 2, 50, current.h2sWarningPpm),
      h2sCriticalPpm: clampNum(body.h2sCriticalPpm, 5, 100, current.h2sCriticalPpm),
      ch4WarningLelPct: clampNum(body.ch4WarningLelPct, 2, 40, current.ch4WarningLelPct),
      ch4CriticalLelPct: clampNum(body.ch4CriticalLelPct, 5, 60, current.ch4CriticalLelPct),
    };

    if (next.waterLevelCriticalPct <= next.waterLevelWarningPct) {
      next.waterLevelCriticalPct = Math.min(98, next.waterLevelWarningPct + 10);
    }
    if (next.h2sCriticalPpm <= next.h2sWarningPpm) {
      next.h2sCriticalPpm = Math.min(100, next.h2sWarningPpm + 5);
    }
    if (next.ch4CriticalLelPct <= next.ch4WarningLelPct) {
      next.ch4CriticalLelPct = Math.min(60, next.ch4WarningLelPct + 5);
    }

    updateThresholds(next);
    latestSnapshots = evaluateAllNodesSnapshot();
    res.json(buildDashboardSnapshot());
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/{*path}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SANI-AI prototype server listening on http://localhost:${PORT}`);
  });
}

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

startServer().catch((err) => {
  console.error('Failed to start SANI-AI server:', err);
  process.exit(1);
});
