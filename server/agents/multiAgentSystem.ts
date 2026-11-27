import {
  autoResolveClearedAlerts,
  completeInterventionsForNode,
  getNodeHistory,
  getThresholds,
  insertAgentLog,
  insertTelemetry,
  SAMPLE_NODES,
  upsertActiveAlert,
} from '../db.ts';
import {
  generateSimulatedEsp32Packet,
  getNodeSimState,
} from '../simulator/esp32Simulator.ts';
import type {
  BlockageDiagnostic,
  BlockageSeverity,
  DecisionRecommendation,
  DrainageNode,
  NodeSnapshot,
  PredictiveAnalysis,
  RiskLevel,
  SafetyThresholds,
  TelemetryReading,
} from '../../src/types/sani.ts';

/**
 * AGENT 1: AI Monitoring Agent
 * Validates incoming simulated ESP32 packets, normalizes telemetry,
 * checks immediate gas & water-level safety thresholds, and persists to SQLite.
 */
function runMonitoringAgent(
  node: DrainageNode,
  reading: TelemetryReading,
  thresholds: SafetyThresholds
): { gasHazard: boolean; gasCritical: boolean; levelWarning: boolean; levelCritical: boolean } {
  insertTelemetry(reading);

  const gasCritical =
    reading.h2sPpm >= thresholds.h2sCriticalPpm ||
    reading.ch4LelPct >= thresholds.ch4CriticalLelPct;
  const gasHazard =
    gasCritical ||
    reading.h2sPpm >= thresholds.h2sWarningPpm ||
    reading.ch4LelPct >= thresholds.ch4WarningLelPct;

  const levelCritical = reading.waterLevelPct >= thresholds.waterLevelCriticalPct;
  const levelWarning = levelCritical || reading.waterLevelPct >= thresholds.waterLevelWarningPct;

  if (gasCritical) {
    upsertActiveAlert({
      nodeId: node.id,
      nodeName: node.name,
      sector: node.sector,
      category: 'Gas Hazard',
      severity: 'Critical',
      title: `Critical Toxic Gas Concentration at ${node.name}`,
      description: `H₂S measured at ${reading.h2sPpm} ppm (limit ${thresholds.h2sCriticalPpm} ppm) and CH₄ at ${reading.ch4LelPct}% LEL.`,
      humanSafetyNote:
        'CONFINED-SPACE ENTRY PROHIBITED. Remote ventilation & robotic operations only.',
      sourceAgent: 'MonitoringAgent',
    });
    insertAgentLog({
      timestamp: reading.timestamp,
      agent: 'MonitoringAgent',
      nodeId: node.id,
      stage: 'Observe',
      severity: 'critical',
      message: `Hazardous gas threshold breached at ${node.id}: H₂S ${reading.h2sPpm} ppm, CH₄ ${reading.ch4LelPct}% LEL.`,
      payloadSummary: `lvl=${reading.waterLevelPct}% flow=${reading.flowRateLps}L/s h2s=${reading.h2sPpm}ppm`,
    });
  } else if (gasHazard) {
    upsertActiveAlert({
      nodeId: node.id,
      nodeName: node.name,
      sector: node.sector,
      category: 'Gas Hazard',
      severity: 'Warning',
      title: `Elevated Sewer Gas Warning at ${node.name}`,
      description: `H₂S at ${reading.h2sPpm} ppm / CH₄ at ${reading.ch4LelPct}% LEL exceeds safety warning threshold.`,
      humanSafetyNote:
        'Direct human entry restricted; deploy portable exhaust purge before any inspection.',
      sourceAgent: 'MonitoringAgent',
    });
  } else {
    autoResolveClearedAlerts(node.id, 'Gas Hazard');
  }

  return { gasHazard, gasCritical, levelWarning, levelCritical };
}

/**
 * AGENT 2: Blockage Detection Agent
 * Correlates water level against hydraulic flow rate.
 * Rising/high water level combined with suppressed flow rate signals physical obstruction.
 */
function runBlockageDetectionAgent(
  node: DrainageNode,
  reading: TelemetryReading,
  history: TelemetryReading[],
  thresholds: SafetyThresholds
): BlockageDiagnostic {
  const hydraulicHeadFactor = Math.min(1.0, (reading.waterLevelPct / 88) * 0.95 + 0.08);
  const expectedFlowLps = Number((node.maxCapacityLps * hydraulicHeadFactor * 0.86).toFixed(1));
  const rawDeficitPct =
    expectedFlowLps > 0 ? ((expectedFlowLps - reading.flowRateLps) / expectedFlowLps) * 100 : 0;
  const flowDeficitPct = Number(Math.max(0, Math.min(99, rawDeficitPct)).toFixed(1));

  // Check recent trend divergence (level up while flow flat/down)
  const recentWindow = history.slice(-6);
  let levelDelta = 0;
  let flowDelta = 0;
  if (recentWindow.length >= 2) {
    levelDelta = recentWindow[recentWindow.length - 1].waterLevelPct - recentWindow[0].waterLevelPct;
    flowDelta = recentWindow[recentWindow.length - 1].flowRateLps - recentWindow[0].flowRateLps;
  }

  const divergenceBonus = levelDelta > 3 && flowDelta <= 5 ? 16 : 0;
  const turbidityFactor = reading.turbidityNtu > 300 ? 10 : 0;
  const probabilityPct = Math.round(
    Math.max(2, Math.min(99, flowDeficitPct * 1.25 + divergenceBonus + turbidityFactor))
  );

  let severity: BlockageSeverity = 'None';
  let isBlocked = false;
  if (flowDeficitPct >= thresholds.blockageFlowDeficitPct + 22 || probabilityPct >= 78) {
    severity = 'Severe';
    isBlocked = true;
  } else if (flowDeficitPct >= thresholds.blockageFlowDeficitPct || probabilityPct >= 55) {
    severity = 'Moderate';
    isBlocked = true;
  } else if (flowDeficitPct >= thresholds.blockageFlowDeficitPct * 0.68 || probabilityPct >= 38) {
    severity = 'Low';
  }

  let suspectedCause = 'Nominal hydraulic flow';
  if (severity !== 'None') {
    if (reading.turbidityNtu > 360) {
      suspectedCause = 'Dense Silt & Grease Accumulation';
    } else if (flowDeficitPct > 50) {
      suspectedCause = 'Solid Debris / Macro-Obstruction';
    } else {
      suspectedCause = 'Partial Sediment & Root Intrusion';
    }
  }

  const summary = isBlocked
    ? `${severity} obstruction detected: flow ${reading.flowRateLps} L/s vs expected ${expectedFlowLps} L/s (${flowDeficitPct}% deficit).`
    : severity === 'Low'
      ? `Minor sediment impedance (${flowDeficitPct}% flow deficit); monitoring closely.`
      : `Clear conduit flow (${reading.flowRateLps} L/s matching ${reading.waterLevelPct}% fill).`;

  if (isBlocked) {
    upsertActiveAlert({
      nodeId: node.id,
      nodeName: node.name,
      sector: node.sector,
      category: 'Blockage',
      severity: severity === 'Severe' ? 'Critical' : 'Warning',
      title: `${severity} Drainage Blockage at ${node.name}`,
      description: `${summary} Suspected cause: ${suspectedCause}.`,
      humanSafetyNote:
        'Use autonomous hydro-jetting crawler instead of manual desilting crew.',
      sourceAgent: 'BlockageDetectionAgent',
    });

    insertAgentLog({
      timestamp: reading.timestamp,
      agent: 'BlockageDetectionAgent',
      nodeId: node.id,
      stage: 'Analyze',
      severity: severity === 'Severe' ? 'critical' : 'warning',
      message: `${severity} blockage flagged at ${node.id} (${probabilityPct}% confidence) — ${suspectedCause}.`,
      payloadSummary: `deficit=${flowDeficitPct}% turbidity=${reading.turbidityNtu}NTU`,
    });
  } else {
    autoResolveClearedAlerts(node.id, 'Blockage');
  }

  return {
    nodeId: node.id,
    isBlocked,
    probabilityPct,
    severity,
    expectedFlowLps,
    actualFlowLps: reading.flowRateLps,
    flowDeficitPct,
    suspectedCause,
    summary,
  };
}

/**
 * AGENT 3: Predictive Analysis Agent
 * Uses Ordinary Least Squares (OLS) linear regression over recent SQLite telemetry
 * combined with logistic overflow scoring to classify Low / Medium / High overflow risk.
 */
function runPredictiveAnalysisAgent(
  node: DrainageNode,
  reading: TelemetryReading,
  history: TelemetryReading[],
  blockage: BlockageDiagnostic,
  thresholds: SafetyThresholds
): PredictiveAnalysis {
  const window = history.slice(-12);
  let slopePctPerTick = 0;

  if (window.length >= 3) {
    const n = window.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += window[i].waterLevelPct;
      sumXY += i * window[i].waterLevelPct;
      sumXX += i * i;
    }
    const denom = n * sumXX - sumX * sumX;
    slopePctPerTick = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  }

  // Assuming ~15s effective interval per reading step for realistic forecast horizon
  const ticksPerMinute = 4;
  const slopePctPerMin = slopePctPerTick * ticksPerMinute;
  const levelTrendCmPerMin = Number(((slopePctPerMin / 100) * node.pipeDiameterCm).toFixed(2));

  const projectedLevelPct30m = Number(
    Math.max(10, Math.min(100, reading.waterLevelPct + slopePctPerMin * 30 * 0.35)).toFixed(1)
  );

  // Logistic risk score combining current fill %, upward slope, and blockage deficit
  const z =
    -4.2 +
    (reading.waterLevelPct - 52) * 0.085 +
    Math.max(0, slopePctPerMin) * 1.45 +
    blockage.flowDeficitPct * 0.035;
  const overflowProbabilityPct = Math.round((1 / (1 + Math.exp(-z))) * 100);

  let estimatedMinutesToOverflow: number | null = null;
  if (reading.waterLevelPct >= 95) {
    estimatedMinutesToOverflow = 2;
  } else if (slopePctPerMin > 0.15) {
    const remainingPct = Math.max(1, 96 - reading.waterLevelPct);
    estimatedMinutesToOverflow = Math.max(3, Math.min(240, Math.round(remainingPct / slopePctPerMin)));
  }

  let riskLevel: RiskLevel = 'Low';
  if (
    reading.waterLevelPct >= thresholds.waterLevelCriticalPct ||
    overflowProbabilityPct >= 72 ||
    (estimatedMinutesToOverflow !== null && estimatedMinutesToOverflow <= 20)
  ) {
    riskLevel = 'High';
  } else if (
    reading.waterLevelPct >= thresholds.waterLevelWarningPct ||
    overflowProbabilityPct >= 40 ||
    blockage.isBlocked
  ) {
    riskLevel = 'Medium';
  }

  let preventiveRecommendation = 'Continue routine automated ESP32 polling every 15 seconds.';
  if (riskLevel === 'High') {
    preventiveRecommendation = blockage.isBlocked
      ? `Immediate robotic hydro-jetting & bypass weir activation required (${estimatedMinutesToOverflow ?? 12} min est. overflow window).`
      : `Divert upstream flow via automated sluice gate and deploy mobile high-head pump.`;
  } else if (riskLevel === 'Medium') {
    preventiveRecommendation = blockage.isBlocked
      ? `Schedule mechanized desilting crawler within 2 hours to restore ${blockage.flowDeficitPct}% lost capacity.`
      : `Increase telemetry cadence and prepare retention basin buffer capacity.`;
  }

  if (riskLevel === 'High') {
    upsertActiveAlert({
      nodeId: node.id,
      nodeName: node.name,
      sector: node.sector,
      category: 'Overflow Risk',
      severity: 'Critical',
      title: `High Overflow Risk Projected at ${node.name}`,
      description: `Water level at ${reading.waterLevelPct}% with ${overflowProbabilityPct}% overflow probability${estimatedMinutesToOverflow ? ` (~${estimatedMinutesToOverflow} min to capacity)` : ''}.`,
      humanSafetyNote:
        'Prevent surface flooding without exposing field personnel to pressurized manhole chambers.',
      sourceAgent: 'PredictiveAnalysisAgent',
    });

    insertAgentLog({
      timestamp: reading.timestamp,
      agent: 'PredictiveAnalysisAgent',
      nodeId: node.id,
      stage: 'Predict',
      severity: 'critical',
      message: `High overflow risk (${overflowProbabilityPct}%) predicted at ${node.id}; trend ${levelTrendCmPerMin >= 0 ? '+' : ''}${levelTrendCmPerMin} cm/min.`,
      payloadSummary: `prob=${overflowProbabilityPct}% eta=${estimatedMinutesToOverflow ?? 'N/A'}m`,
    });
  } else {
    autoResolveClearedAlerts(node.id, 'Overflow Risk');
  }

  return {
    nodeId: node.id,
    riskLevel,
    overflowProbabilityPct,
    estimatedMinutesToOverflow,
    levelTrendCmPerMin,
    projectedLevelPct30m,
    preventiveRecommendation,
  };
}

/**
 * AGENT 4: AI Decision-Making Agent
 * Synthesizes Monitoring, Blockage, and Predictive outputs.
 * Enforces Human-Safety Lockout and recommends mechanized interventions.
 */
function runDecisionMakingAgent(
  node: DrainageNode,
  reading: TelemetryReading,
  monitoringFlags: { gasHazard: boolean; gasCritical: boolean; levelWarning: boolean; levelCritical: boolean },
  blockage: BlockageDiagnostic,
  prediction: PredictiveAnalysis,
  interventionRemainingTicks: number
): DecisionRecommendation {
  const humanEntryProhibited = monitoringFlags.gasHazard || prediction.riskLevel === 'High';
  let safetyLockReason: string | null = null;

  if (monitoringFlags.gasCritical) {
    safetyLockReason = `Toxic gas lockout: H₂S ${reading.h2sPpm} ppm / CH₄ ${reading.ch4LelPct}% LEL`;
  } else if (monitoringFlags.gasHazard) {
    safetyLockReason = `Gas warning lockout: H₂S ${reading.h2sPpm} ppm exceeds safe entry limit`;
  } else if (prediction.riskLevel === 'High') {
    safetyLockReason = `Hydraulic surge lockout: ${reading.waterLevelPct}% conduit fill`;
  }

  const urgencyScore = Math.min(
    100,
    Math.round(
      (monitoringFlags.gasCritical ? 42 : monitoringFlags.gasHazard ? 24 : 0) +
        prediction.overflowProbabilityPct * 0.35 +
        (blockage.isBlocked ? blockage.probabilityPct * 0.28 : 0) +
        reading.waterLevelPct * 0.12
    )
  );

  let recommendedUnit = 'Autonomous Acoustic Inspection Rover';
  let actionTitle = 'Routine Remote Inspection';
  let actionRationale =
    'Parameters remain within nominal safety thresholds; no physical crew deployment needed.';
  let estimatedClearMinutes = 10;

  if (interventionRemainingTicks > 0) {
    recommendedUnit = 'Active Mechanized Mitigation Unit';
    actionTitle = `Automated Clearing In Progress (${interventionRemainingTicks} cycles remaining)`;
    actionRationale =
      'Robotic intervention actively restoring flow & venting hazardous gases with zero human exposure.';
    estimatedClearMinutes = interventionRemainingTicks * 2;
  } else if (monitoringFlags.gasCritical && blockage.isBlocked) {
    recommendedUnit = 'ATEX Mobile Gas Scrubber + Robotic Hydro-Jet Crawler';
    actionTitle = 'Remote Gas Purge & Robotic Unblocking';
    actionRationale =
      'Explosive/toxic atmosphere combined with obstruction. Purge gases remotely before deploying tethered crawler.';
    estimatedClearMinutes = 25;
  } else if (monitoringFlags.gasHazard) {
    recommendedUnit = 'High-CFM Exhaust Blower & Neutralizing Scrubber';
    actionTitle = 'Automated Shaft Ventilation & Gas Scrubbing';
    actionRationale = `Hazardous H₂S (${reading.h2sPpm} ppm) and CH₄ (${reading.ch4LelPct}% LEL) make human descent fatal. Remote ventilation required.`;
    estimatedClearMinutes = 15;
  } else if (blockage.severity === 'Severe' || blockage.severity === 'Moderate') {
    recommendedUnit = 'High-Pressure Robotic Hydro-Jetting Crawler';
    actionTitle = `Mechanized ${blockage.suspectedCause} Clearance`;
    actionRationale = `${blockage.flowDeficitPct}% flow deficit detected. High-pressure crawler clears obstruction from street level.`;
    estimatedClearMinutes = blockage.severity === 'Severe' ? 22 : 14;
  } else if (prediction.riskLevel === 'High') {
    recommendedUnit = 'Automated Bypass Weir & Mobile Dewatering Pump';
    actionTitle = 'Activate Storm Bypass & Surge Pumping';
    actionRationale = `Rapid level rise (${prediction.levelTrendCmPerMin} cm/min) threatens manhole surcharge. Divert flow automatically.`;
    estimatedClearMinutes = 18;
  }

  if (urgencyScore >= 55 && interventionRemainingTicks === 0) {
    insertAgentLog({
      timestamp: reading.timestamp,
      agent: 'DecisionMakingAgent',
      nodeId: node.id,
      stage: 'Decide',
      severity: urgencyScore >= 75 ? 'critical' : 'warning',
      message: `Prescribed "${actionTitle}" using ${recommendedUnit} at ${node.id} (Urgency ${urgencyScore}/100).`,
      payloadSummary: `humanEntryProhibited=${humanEntryProhibited}`,
    });
  }

  return {
    nodeId: node.id,
    nodeName: node.name,
    sector: node.sector,
    priorityRank: 1,
    urgencyScore,
    humanEntryProhibited,
    safetyLockReason,
    recommendedUnit,
    actionTitle,
    actionRationale,
    estimatedClearMinutes,
    interventionActive: interventionRemainingTicks > 0,
  };
}

/**
 * Evaluates current latest telemetry for all nodes (used at startup and after threshold updates)
 * without generating new synthetic packets.
 */
export function evaluateAllNodesSnapshot(): NodeSnapshot[] {
  const thresholds = getThresholds();
  const snapshots: NodeSnapshot[] = [];

  for (const node of SAMPLE_NODES) {
    const history = getNodeHistory(node.id, 30);
    const latest = history[history.length - 1];
    const simState = getNodeSimState(node.id);

    const gasCritical =
      latest.h2sPpm >= thresholds.h2sCriticalPpm ||
      latest.ch4LelPct >= thresholds.ch4CriticalLelPct;
    const gasHazard =
      gasCritical ||
      latest.h2sPpm >= thresholds.h2sWarningPpm ||
      latest.ch4LelPct >= thresholds.ch4WarningLelPct;
    const levelCritical = latest.waterLevelPct >= thresholds.waterLevelCriticalPct;
    const levelWarning = levelCritical || latest.waterLevelPct >= thresholds.waterLevelWarningPct;

    const blockage = runBlockageDetectionAgent(node, latest, history, thresholds);
    const prediction = runPredictiveAnalysisAgent(node, latest, history, blockage, thresholds);
    const decision = runDecisionMakingAgent(
      node,
      latest,
      { gasHazard, gasCritical, levelWarning, levelCritical },
      blockage,
      prediction,
      simState.interventionRemainingTicks
    );

    snapshots.push({
      node,
      telemetry: latest,
      blockage,
      prediction,
      decision,
      activeScenario: simState.scenario,
      interventionRemainingTicks: simState.interventionRemainingTicks,
    });
  }

  return rankSnapshots(snapshots);
}

/**
 * Runs one complete simulation + multi-agent cycle across all 6 ESP32 nodes.
 */
export function runMultiAgentCycle(tickCount: number): NodeSnapshot[] {
  const thresholds = getThresholds();
  const snapshots: NodeSnapshot[] = [];

  for (const node of SAMPLE_NODES) {
    const { reading, completedIntervention } = generateSimulatedEsp32Packet(node, tickCount);
    if (completedIntervention) {
      completeInterventionsForNode(node.id);
      insertAgentLog({
        timestamp: reading.timestamp,
        agent: 'DecisionMakingAgent',
        nodeId: node.id,
        stage: 'Decide',
        severity: 'info',
        message: `Mechanized intervention completed at ${node.id}; telemetry returning to baseline.`,
        payloadSummary: `status=Completed`,
      });
    }

    const monitoringFlags = runMonitoringAgent(node, reading, thresholds);
    const history = getNodeHistory(node.id, 30);
    const blockage = runBlockageDetectionAgent(node, reading, history, thresholds);
    const prediction = runPredictiveAnalysisAgent(node, reading, history, blockage, thresholds);
    const simState = getNodeSimState(node.id);
    const decision = runDecisionMakingAgent(
      node,
      reading,
      monitoringFlags,
      blockage,
      prediction,
      simState.interventionRemainingTicks
    );

    snapshots.push({
      node,
      telemetry: reading,
      blockage,
      prediction,
      decision,
      activeScenario: simState.scenario,
      interventionRemainingTicks: simState.interventionRemainingTicks,
    });
  }

  return rankSnapshots(snapshots);
}

function rankSnapshots(snapshots: NodeSnapshot[]): NodeSnapshot[] {
  const sortedByUrgency = [...snapshots].sort(
    (a, b) => b.decision.urgencyScore - a.decision.urgencyScore
  );
  sortedByUrgency.forEach((snap, idx) => {
    snap.decision.priorityRank = idx + 1;
  });
  return snapshots;
}
