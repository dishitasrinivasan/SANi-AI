export type RiskLevel = 'Low' | 'Medium' | 'High';
export type BlockageSeverity = 'None' | 'Low' | 'Moderate' | 'Severe';
export type AlertSeverity = 'Warning' | 'Critical';
export type AlertStatus = 'Active' | 'Acknowledged' | 'Resolved';
export type AgentName =
  | 'MonitoringAgent'
  | 'BlockageDetectionAgent'
  | 'PredictiveAnalysisAgent'
  | 'DecisionMakingAgent';

export type ScenarioType = 'normal' | 'blockage' | 'gas_leak' | 'storm_surge';

export interface DrainageNode {
  id: string;
  name: string;
  sector: string;
  district: string;
  pipeDiameterCm: number;
  maxCapacityLps: number;
  mapX: number; // 0..1000 SVG coordinate
  mapY: number; // 0..560 SVG coordinate
  upstreamIds: string[];
  downstreamId: string | null;
}

export interface TelemetryReading {
  id?: number;
  nodeId: string;
  timestamp: string;
  waterLevelCm: number;
  waterLevelPct: number;
  flowRateLps: number;
  h2sPpm: number;
  ch4LelPct: number;
  coPpm: number;
  turbidityNtu: number;
  temperatureC: number;
  batteryPct: number;
  rssiDbm: number;
  simulatedPacketSeq: number;
}

export interface BlockageDiagnostic {
  nodeId: string;
  isBlocked: boolean;
  probabilityPct: number;
  severity: BlockageSeverity;
  expectedFlowLps: number;
  actualFlowLps: number;
  flowDeficitPct: number;
  suspectedCause: string;
  summary: string;
}

export interface PredictiveAnalysis {
  nodeId: string;
  riskLevel: RiskLevel;
  overflowProbabilityPct: number;
  estimatedMinutesToOverflow: number | null;
  levelTrendCmPerMin: number;
  projectedLevelPct30m: number;
  preventiveRecommendation: string;
}

export interface DecisionRecommendation {
  nodeId: string;
  nodeName: string;
  sector: string;
  priorityRank: number;
  urgencyScore: number;
  humanEntryProhibited: boolean;
  safetyLockReason: string | null;
  recommendedUnit: string;
  actionTitle: string;
  actionRationale: string;
  estimatedClearMinutes: number;
  interventionActive: boolean;
}

export interface NodeSnapshot {
  node: DrainageNode;
  telemetry: TelemetryReading;
  blockage: BlockageDiagnostic;
  prediction: PredictiveAnalysis;
  decision: DecisionRecommendation;
  activeScenario: ScenarioType;
  interventionRemainingTicks: number;
}

export interface SafetyAlert {
  id: number;
  nodeId: string;
  nodeName: string;
  sector: string;
  category: 'Gas Hazard' | 'Blockage' | 'Overflow Risk';
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  humanSafetyNote: string;
  sourceAgent: AgentName;
  createdAt: string;
  updatedAt: string;
}

export interface AgentLogEntry {
  id: number;
  timestamp: string;
  agent: AgentName;
  nodeId: string;
  stage: 'Observe' | 'Analyze' | 'Predict' | 'Decide';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  payloadSummary: string;
}

export interface SafetyThresholds {
  waterLevelWarningPct: number;
  waterLevelCriticalPct: number;
  blockageFlowDeficitPct: number;
  h2sWarningPpm: number;
  h2sCriticalPpm: number;
  ch4WarningLelPct: number;
  ch4CriticalLelPct: number;
}

export interface InterventionRecord {
  id: number;
  nodeId: string;
  nodeName: string;
  unitName: string;
  actionTitle: string;
  triggeredBy: string;
  humanEntriesAvoided: number;
  status: 'Dispatched' | 'Completed';
  createdAt: string;
}

export interface SimulationState {
  running: boolean;
  tickCount: number;
  lastTickAt: string;
  intervalMs: number;
}

export interface DashboardSnapshot {
  simulation: SimulationState;
  thresholds: SafetyThresholds;
  nodes: NodeSnapshot[];
  alerts: SafetyAlert[];
  agentLogs: AgentLogEntry[];
  interventions: InterventionRecord[];
  summary: {
    totalNodes: number;
    nominalNodes: number;
    activeBlockages: number;
    highRiskNodes: number;
    humanEntryLockouts: number;
    activeAlertsCount: number;
    criticalAlertsCount: number;
    humanEntriesPreventedTotal: number;
  };
}
