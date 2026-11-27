import { getLatestReading, SAMPLE_NODES } from '../db.ts';
import type { DrainageNode, ScenarioType, TelemetryReading } from '../../src/types/sani.ts';

interface NodeSimRuntime {
  scenario: ScenarioType;
  interventionRemainingTicks: number;
  packetSeq: number;
}

const runtimeMap = new Map<string, NodeSimRuntime>();

export function initSimulatorRuntime(): void {
  for (const node of SAMPLE_NODES) {
    const latest = getLatestReading(node.id);
    const defaultScenario: ScenarioType =
      node.id === 'ESP32-ND02'
        ? 'blockage'
        : node.id === 'ESP32-ND01'
          ? 'gas_leak'
          : 'normal';

    runtimeMap.set(node.id, {
      scenario: defaultScenario,
      interventionRemainingTicks: 0,
      packetSeq: latest ? latest.simulatedPacketSeq : 1020,
    });
  }
}

export function getNodeSimState(nodeId: string): NodeSimRuntime {
  if (!runtimeMap.has(nodeId)) {
    runtimeMap.set(nodeId, {
      scenario: 'normal',
      interventionRemainingTicks: 0,
      packetSeq: 1020,
    });
  }
  return runtimeMap.get(nodeId)!;
}

export function setNodeScenario(nodeId: string, scenario: ScenarioType): void {
  const state = getNodeSimState(nodeId);
  state.scenario = scenario;
  if (scenario !== 'normal') {
    state.interventionRemainingTicks = 0;
  }
}

export function setNetworkScenario(scenario: ScenarioType, targetNodeId?: string): void {
  if (targetNodeId && targetNodeId !== 'ALL') {
    setNodeScenario(targetNodeId, scenario);
    return;
  }
  if (scenario === 'normal') {
    for (const node of SAMPLE_NODES) {
      setNodeScenario(node.id, 'normal');
    }
    return;
  }
  if (scenario === 'storm_surge') {
    for (const node of SAMPLE_NODES) {
      setNodeScenario(node.id, 'storm_surge');
    }
    return;
  }
  // For single-node scenarios when ALL is chosen, pick representative nodes
  if (scenario === 'blockage') {
    setNodeScenario('ESP32-ND02', 'blockage');
    setNodeScenario('ESP32-ND05', 'blockage');
  } else if (scenario === 'gas_leak') {
    setNodeScenario('ESP32-ND01', 'gas_leak');
  }
}

export function triggerNodeIntervention(nodeId: string, ticks = 5): void {
  const state = getNodeSimState(nodeId);
  state.interventionRemainingTicks = ticks;
  state.scenario = 'normal';
}

/**
 * Simulates an ESP32 telemetry packet for a given municipal drainage node.
 * Clearly labeled as simulated prototype hardware telemetry.
 */
export function generateSimulatedEsp32Packet(
  node: DrainageNode,
  tickCount: number
): { reading: TelemetryReading; completedIntervention: boolean } {
  const state = getNodeSimState(node.id);
  const prev = getLatestReading(node.id);
  state.packetSeq += 1;

  let completedIntervention = false;
  const isMitigating = state.interventionRemainingTicks > 0;
  if (isMitigating) {
    state.interventionRemainingTicks -= 1;
    if (state.interventionRemainingTicks === 0) {
      completedIntervention = true;
    }
  }

  const prevLevelPct = prev ? prev.waterLevelPct : 38;
  const prevH2s = prev ? prev.h2sPpm : 3.0;
  const prevCh4 = prev ? prev.ch4LelPct : 2.5;
  const prevCo = prev ? prev.coPpm : 5.0;
  const prevTurbidity = prev ? prev.turbidityNtu : 160;

  // Baseline diurnal smooth curve
  const wave = Math.sin(tickCount * 0.35 + node.mapX * 0.01) * 1.4;
  const jitter = (Math.random() - 0.5) * 1.6;

  let targetLevelPct = 35 + wave;
  let flowMultiplier = 0.86;
  let targetH2s = 3.2;
  let targetCh4 = 2.6;
  let targetCo = 5.2;
  let targetTurbidity = 165;

  if (isMitigating) {
    // Mechanized unit actively draining/scrubbing back toward safe baseline
    targetLevelPct = Math.max(36, prevLevelPct - 9.5);
    flowMultiplier = 0.92;
    targetH2s = Math.max(3.5, prevH2s * 0.62);
    targetCh4 = Math.max(2.4, prevCh4 * 0.65);
    targetCo = Math.max(4.8, prevCo * 0.72);
    targetTurbidity = Math.max(170, prevTurbidity - 45);
  } else if (state.scenario === 'blockage') {
    // Rising water level paired with severe flow drop (hydraulic impedance)
    targetLevelPct = Math.min(96, prevLevelPct + 3.4 + Math.random() * 1.3);
    flowMultiplier = 0.28 + Math.random() * 0.08;
    targetH2s = Math.min(22, prevH2s + 1.1);
    targetCh4 = Math.min(14, prevCh4 + 0.6);
    targetCo = Math.min(18, prevCo + 0.7);
    targetTurbidity = Math.min(540, prevTurbidity + 28);
  } else if (state.scenario === 'gas_leak') {
    // Toxic gas surge (H2S + CH4) even if water level is moderate
    targetLevelPct = Math.min(78, Math.max(52, prevLevelPct + 0.6 + jitter * 0.5));
    flowMultiplier = 0.74;
    targetH2s = Math.min(44, prevH2s + 3.8 + Math.random() * 1.5);
    targetCh4 = Math.min(28, prevCh4 + 2.1 + Math.random() * 0.8);
    targetCo = Math.min(34, prevCo + 1.8);
    targetTurbidity = Math.min(340, prevTurbidity + 10);
  } else if (state.scenario === 'storm_surge') {
    // Heavy stormwater inflow: high water level AND high flow velocity
    targetLevelPct = Math.min(95, prevLevelPct + 4.2 + Math.random() * 1.5);
    flowMultiplier = 1.08;
    targetH2s = Math.max(2.8, prevH2s * 0.92 + 0.4);
    targetCh4 = Math.max(2.2, prevCh4 * 0.94 + 0.3);
    targetCo = 6.0;
    targetTurbidity = Math.min(620, prevTurbidity + 35);
  } else {
    // Nominal smooth relaxation back toward healthy municipal baseline
    const nominalAnchor = 34 + (node.pipeDiameterCm % 15);
    targetLevelPct = prevLevelPct + (nominalAnchor - prevLevelPct) * 0.22 + wave * 0.4;
    targetH2s = prevH2s + (3.4 - prevH2s) * 0.25 + Math.abs(jitter) * 0.3;
    targetCh4 = prevCh4 + (2.5 - prevCh4) * 0.25 + Math.abs(jitter) * 0.2;
    targetCo = prevCo + (5.2 - prevCo) * 0.25;
    targetTurbidity = prevTurbidity + (165 - prevTurbidity) * 0.25;
  }

  const waterLevelPct = Number(Math.max(12, Math.min(98, targetLevelPct + jitter * 0.4)).toFixed(1));
  const waterLevelCm = Number(((waterLevelPct / 100) * node.pipeDiameterCm).toFixed(1));

  // Expected Manning-like capacity scales smoothly with fill level up to ~85%
  const hydraulicHeadFactor = Math.min(1.0, (waterLevelPct / 88) * 0.95 + 0.08);
  const rawFlow = node.maxCapacityLps * hydraulicHeadFactor * flowMultiplier + jitter * 4.5;
  const flowRateLps = Number(Math.max(12, Math.min(node.maxCapacityLps * 1.15, rawFlow)).toFixed(1));

  const h2sPpm = Number(Math.max(0.8, targetH2s + jitter * 0.35).toFixed(1));
  const ch4LelPct = Number(Math.max(0.5, targetCh4 + jitter * 0.25).toFixed(1));
  const coPpm = Number(Math.max(1.0, targetCo + jitter * 0.4).toFixed(1));
  const turbidityNtu = Number(Math.max(60, targetTurbidity + jitter * 8).toFixed(0));

  const reading: TelemetryReading = {
    nodeId: node.id,
    timestamp: new Date().toISOString(),
    waterLevelCm,
    waterLevelPct,
    flowRateLps,
    h2sPpm,
    ch4LelPct,
    coPpm,
    turbidityNtu,
    temperatureC: Number((23.6 + Math.sin(tickCount * 0.1) * 0.8).toFixed(1)),
    batteryPct: Number(Math.max(72, (prev?.batteryPct ?? 92) - 0.01).toFixed(1)),
    rssiDbm: Math.round(-63 - Math.abs(wave) * 2),
    simulatedPacketSeq: state.packetSeq,
  };

  return { reading, completedIntervention };
}
