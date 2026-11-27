import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type {
  AgentLogEntry,
  AgentName,
  AlertSeverity,
  AlertStatus,
  DrainageNode,
  InterventionRecord,
  SafetyAlert,
  SafetyThresholds,
  TelemetryReading,
} from '../src/types/sani.ts';

import os from 'os';

function openResilientDatabase(): Database.Database {
  const candidates =
    process.env.NODE_ENV === 'production'
      ? [path.join(os.tmpdir(), 'sani_ai_data'), path.resolve(process.cwd(), 'data')]
      : [path.resolve(process.cwd(), 'data'), path.join(os.tmpdir(), 'sani_ai_data')];

  for (const dir of candidates) {
    const dbPath = path.join(dir, 'sani_ai.db');
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      let instance = new Database(dbPath);
      const check = instance.pragma('quick_check', { simple: true });
      if (check !== 'ok') {
        instance.close();
        for (const suffix of ['', '-wal', '-shm']) {
          const f = `${dbPath}${suffix}`;
          if (fs.existsSync(f)) fs.unlinkSync(f);
        }
        instance = new Database(dbPath);
      }
      instance.pragma('journal_mode = DELETE');
      instance.pragma('foreign_keys = ON');
      return instance;
    } catch {
      for (const suffix of ['', '-wal', '-shm']) {
        const f = `${dbPath}${suffix}`;
        try {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        } catch {
          // ignore cleanup failure on read-only path
        }
      }
    }
  }

  const memDb = new Database(':memory:');
  memDb.pragma('foreign_keys = ON');
  return memDb;
}

export const db = openResilientDatabase();

/**
 * Sample municipal drainage network for prototype demonstration.
 * Note: Simulated municipal coordinates and dimensions.
 */
export const SAMPLE_NODES: DrainageNode[] = [
  {
    id: 'ESP32-ND01',
    name: 'Sector 4 Main Trunk',
    sector: 'Industrial Corridor',
    district: 'North Basin',
    pipeDiameterCm: 180,
    maxCapacityLps: 420,
    mapX: 165,
    mapY: 165,
    upstreamIds: [],
    downstreamId: 'ESP32-ND03',
  },
  {
    id: 'ESP32-ND02',
    name: 'Old Market Underpass',
    sector: 'Commercial Core',
    district: 'Central Ward',
    pipeDiameterCm: 140,
    maxCapacityLps: 290,
    mapX: 390,
    mapY: 130,
    upstreamIds: [],
    downstreamId: 'ESP32-ND05',
  },
  {
    id: 'ESP32-ND03',
    name: 'Riverfront Interceptor B',
    sector: 'Outfall Zone',
    district: 'West Dock',
    pipeDiameterCm: 220,
    maxCapacityLps: 610,
    mapX: 300,
    mapY: 360,
    upstreamIds: ['ESP32-ND01', 'ESP32-ND06'],
    downstreamId: null,
  },
  {
    id: 'ESP32-ND04',
    name: 'Tech Park Culvert East',
    sector: 'Innovation Zone',
    district: 'East Sector',
    pipeDiameterCm: 150,
    maxCapacityLps: 330,
    mapX: 775,
    mapY: 155,
    upstreamIds: [],
    downstreamId: 'ESP32-ND05',
  },
  {
    id: 'ESP32-ND05',
    name: 'Central Transit Siphon',
    sector: 'Metro Interchange',
    district: 'Central Ward',
    pipeDiameterCm: 200,
    maxCapacityLps: 520,
    mapX: 575,
    mapY: 315,
    upstreamIds: ['ESP32-ND02', 'ESP32-ND04'],
    downstreamId: 'ESP32-ND03',
  },
  {
    id: 'ESP32-ND06',
    name: 'Greenbelt Retention Basin',
    sector: 'Residential West',
    district: 'South Basin',
    pipeDiameterCm: 160,
    maxCapacityLps: 360,
    mapX: 740,
    mapY: 435,
    upstreamIds: [],
    downstreamId: 'ESP32-ND03',
  },
];

export const DEFAULT_THRESHOLDS: SafetyThresholds = {
  waterLevelWarningPct: 68,
  waterLevelCriticalPct: 85,
  blockageFlowDeficitPct: 32,
  h2sWarningPpm: 10,
  h2sCriticalPpm: 25,
  ch4WarningLelPct: 10,
  ch4CriticalLelPct: 20,
};

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sector TEXT NOT NULL,
      district TEXT NOT NULL,
      pipe_diameter_cm INTEGER NOT NULL,
      max_capacity_lps REAL NOT NULL,
      map_x INTEGER NOT NULL,
      map_y INTEGER NOT NULL,
      upstream_ids TEXT NOT NULL,
      downstream_id TEXT
    );

    CREATE TABLE IF NOT EXISTS telemetry_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      water_level_cm REAL NOT NULL,
      water_level_pct REAL NOT NULL,
      flow_rate_lps REAL NOT NULL,
      h2s_ppm REAL NOT NULL,
      ch4_lel_pct REAL NOT NULL,
      co_ppm REAL NOT NULL,
      turbidity_ntu REAL NOT NULL,
      temperature_c REAL NOT NULL,
      battery_pct REAL NOT NULL,
      rssi_dbm INTEGER NOT NULL,
      simulated_packet_seq INTEGER NOT NULL,
      FOREIGN KEY (node_id) REFERENCES nodes(id)
    );

    CREATE INDEX IF NOT EXISTS idx_telemetry_node_time
      ON telemetry_readings(node_id, id DESC);

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT NOT NULL,
      node_name TEXT NOT NULL,
      sector TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      human_safety_note TEXT NOT NULL,
      source_agent TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      agent TEXT NOT NULL,
      node_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      payload_summary TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS interventions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT NOT NULL,
      node_name TEXT NOT NULL,
      unit_name TEXT NOT NULL,
      action_title TEXT NOT NULL,
      triggered_by TEXT NOT NULL,
      human_entries_avoided INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'Dispatched',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS thresholds (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      water_level_warning_pct REAL NOT NULL,
      water_level_critical_pct REAL NOT NULL,
      blockage_flow_deficit_pct REAL NOT NULL,
      h2s_warning_ppm REAL NOT NULL,
      h2s_critical_ppm REAL NOT NULL,
      ch4_warning_lel_pct REAL NOT NULL,
      ch4_critical_lel_pct REAL NOT NULL
    );
  `);

  // Upsert sample nodes
  const insertNode = db.prepare(`
    INSERT INTO nodes (
      id, name, sector, district, pipe_diameter_cm, max_capacity_lps,
      map_x, map_y, upstream_ids, downstream_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      sector = excluded.sector,
      district = excluded.district,
      pipe_diameter_cm = excluded.pipe_diameter_cm,
      max_capacity_lps = excluded.max_capacity_lps,
      map_x = excluded.map_x,
      map_y = excluded.map_y,
      upstream_ids = excluded.upstream_ids,
      downstream_id = excluded.downstream_id
  `);

  for (const node of SAMPLE_NODES) {
    insertNode.run(
      node.id,
      node.name,
      node.sector,
      node.district,
      node.pipeDiameterCm,
      node.maxCapacityLps,
      node.mapX,
      node.mapY,
      JSON.stringify(node.upstreamIds),
      node.downstreamId
    );
  }

  // Ensure default thresholds exist
  const thresholdRow = db.prepare('SELECT id FROM thresholds WHERE id = 1').get();
  if (!thresholdRow) {
    db.prepare(`
      INSERT INTO thresholds (
        id, water_level_warning_pct, water_level_critical_pct,
        blockage_flow_deficit_pct, h2s_warning_ppm, h2s_critical_ppm,
        ch4_warning_lel_pct, ch4_critical_lel_pct
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      DEFAULT_THRESHOLDS.waterLevelWarningPct,
      DEFAULT_THRESHOLDS.waterLevelCriticalPct,
      DEFAULT_THRESHOLDS.blockageFlowDeficitPct,
      DEFAULT_THRESHOLDS.h2sWarningPpm,
      DEFAULT_THRESHOLDS.h2sCriticalPpm,
      DEFAULT_THRESHOLDS.ch4WarningLelPct,
      DEFAULT_THRESHOLDS.ch4CriticalLelPct
    );
  }

  // Seed initial historical telemetry if database is fresh so charts & regression have real history
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM telemetry_readings').get() as { cnt: number };
  if (countRow.cnt === 0) {
    seedInitialHistory();
  }
}

function seedInitialHistory(): void {
  const now = Date.now();
  const insertReading = db.prepare(`
    INSERT INTO telemetry_readings (
      node_id, timestamp, water_level_cm, water_level_pct, flow_rate_lps,
      h2s_ppm, ch4_lel_pct, co_ppm, turbidity_ntu, temperature_c,
      battery_pct, rssi_dbm, simulated_packet_seq
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (let step = 20; step >= 1; step--) {
      const ts = new Date(now - step * 15000).toISOString();
      SAMPLE_NODES.forEach((node, idx) => {
        // Give ESP32-ND02 a mild developing grease obstruction and ESP32-ND01 elevated H2S so prototype immediately showcases realistic insights
        const isDevelopingBlockage = node.id === 'ESP32-ND02';
        const isElevatedGas = node.id === 'ESP32-ND01';

        const basePct = isDevelopingBlockage
          ? 48 + (20 - step) * 1.15
          : isElevatedGas
            ? 56 + Math.sin((20 - step) * 0.3) * 3
            : 34 + idx * 4 + Math.sin((20 - step) * 0.35 + idx) * 3;

        const clampedPct = Math.max(18, Math.min(92, Number(basePct.toFixed(1))));
        const waterLevelCm = Number(((clampedPct / 100) * node.pipeDiameterCm).toFixed(1));

        const healthyFlow = (clampedPct / 100) * node.maxCapacityLps * 0.85;
        const flowRateLps = isDevelopingBlockage
          ? Number(Math.max(25, healthyFlow * (0.58 - (20 - step) * 0.01)).toFixed(1))
          : Number((healthyFlow + Math.cos(step + idx) * 6).toFixed(1));

        const h2sPpm = isElevatedGas
          ? Number((11.5 + (20 - step) * 0.25 + Math.sin(step) * 0.6).toFixed(1))
          : Number((2.4 + idx * 0.6 + Math.abs(Math.sin(step + idx)) * 1.1).toFixed(1));

        const ch4LelPct = isElevatedGas
          ? Number((8.2 + (20 - step) * 0.14).toFixed(1))
          : Number((2.0 + idx * 0.4 + Math.abs(Math.cos(step)) * 0.8).toFixed(1));

        const coPpm = Number((4.5 + idx * 0.8 + (isElevatedGas ? 6.2 : 0)).toFixed(1));
        const turbidityNtu = Number((145 + (isDevelopingBlockage ? 180 : idx * 22)).toFixed(0));

        insertReading.run(
          node.id,
          ts,
          waterLevelCm,
          clampedPct,
          flowRateLps,
          h2sPpm,
          ch4LelPct,
          coPpm,
          turbidityNtu,
          Number((23.4 + idx * 0.4).toFixed(1)),
          Number((94 - idx * 1.8).toFixed(1)),
          -64 - idx * 3,
          1000 + (21 - step)
        );
      });
    }
  });

  transaction();

  // Seed initial preventive interventions log
  const existingInt = db.prepare('SELECT COUNT(*) as cnt FROM interventions').get() as { cnt: number };
  if (existingInt.cnt === 0) {
    const twoHoursAgo = new Date(now - 7200 * 1000).toISOString();
    db.prepare(`
      INSERT INTO interventions (
        node_id, node_name, unit_name, action_title, triggered_by,
        human_entries_avoided, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'ESP32-ND05',
      'Central Transit Siphon',
      'Automated Exhaust & Gas Scrubber Unit',
      'Pre-shift ventilation purge prior to scheduled inspection',
      'DecisionMakingAgent',
      2,
      'Completed',
      twoHoursAgo
    );
  }
}

export function getThresholds(): SafetyThresholds {
  const row = db.prepare('SELECT * FROM thresholds WHERE id = 1').get() as {
    water_level_warning_pct: number;
    water_level_critical_pct: number;
    blockage_flow_deficit_pct: number;
    h2s_warning_ppm: number;
    h2s_critical_ppm: number;
    ch4_warning_lel_pct: number;
    ch4_critical_lel_pct: number;
  };
  return {
    waterLevelWarningPct: row.water_level_warning_pct,
    waterLevelCriticalPct: row.water_level_critical_pct,
    blockageFlowDeficitPct: row.blockage_flow_deficit_pct,
    h2sWarningPpm: row.h2s_warning_ppm,
    h2sCriticalPpm: row.h2s_critical_ppm,
    ch4WarningLelPct: row.ch4_warning_lel_pct,
    ch4CriticalLelPct: row.ch4_critical_lel_pct,
  };
}

export function updateThresholds(next: SafetyThresholds): SafetyThresholds {
  db.prepare(`
    UPDATE thresholds SET
      water_level_warning_pct = ?,
      water_level_critical_pct = ?,
      blockage_flow_deficit_pct = ?,
      h2s_warning_ppm = ?,
      h2s_critical_ppm = ?,
      ch4_warning_lel_pct = ?,
      ch4_critical_lel_pct = ?
    WHERE id = 1
  `).run(
    next.waterLevelWarningPct,
    next.waterLevelCriticalPct,
    next.blockageFlowDeficitPct,
    next.h2sWarningPpm,
    next.h2sCriticalPpm,
    next.ch4WarningLelPct,
    next.ch4CriticalLelPct
  );
  return getThresholds();
}

export function insertTelemetry(reading: TelemetryReading): void {
  db.prepare(`
    INSERT INTO telemetry_readings (
      node_id, timestamp, water_level_cm, water_level_pct, flow_rate_lps,
      h2s_ppm, ch4_lel_pct, co_ppm, turbidity_ntu, temperature_c,
      battery_pct, rssi_dbm, simulated_packet_seq
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reading.nodeId,
    reading.timestamp,
    reading.waterLevelCm,
    reading.waterLevelPct,
    reading.flowRateLps,
    reading.h2sPpm,
    reading.ch4LelPct,
    reading.coPpm,
    reading.turbidityNtu,
    reading.temperatureC,
    reading.batteryPct,
    reading.rssiDbm,
    reading.simulatedPacketSeq
  );

  // Keep telemetry history bounded per node (latest 150 rows) so SQLite stays snappy
  db.prepare(`
    DELETE FROM telemetry_readings
    WHERE node_id = ? AND id NOT IN (
      SELECT id FROM telemetry_readings WHERE node_id = ? ORDER BY id DESC LIMIT 150
    )
  `).run(reading.nodeId, reading.nodeId);
}

export function getNodeHistory(nodeId: string, limit = 30): TelemetryReading[] {
  const rows = db.prepare(`
    SELECT * FROM telemetry_readings
    WHERE node_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(nodeId, limit) as Array<{
    id: number;
    node_id: string;
    timestamp: string;
    water_level_cm: number;
    water_level_pct: number;
    flow_rate_lps: number;
    h2s_ppm: number;
    ch4_lel_pct: number;
    co_ppm: number;
    turbidity_ntu: number;
    temperature_c: number;
    battery_pct: number;
    rssi_dbm: number;
    simulated_packet_seq: number;
  }>;

  return rows
    .reverse()
    .map((r) => ({
      id: r.id,
      nodeId: r.node_id,
      timestamp: r.timestamp,
      waterLevelCm: r.water_level_cm,
      waterLevelPct: r.water_level_pct,
      flowRateLps: r.flow_rate_lps,
      h2sPpm: r.h2s_ppm,
      ch4LelPct: r.ch4_lel_pct,
      coPpm: r.co_ppm,
      turbidityNtu: r.turbidity_ntu,
      temperatureC: r.temperature_c,
      batteryPct: r.battery_pct,
      rssiDbm: r.rssi_dbm,
      simulatedPacketSeq: r.simulated_packet_seq,
    }));
}

export function getLatestReading(nodeId: string): TelemetryReading {
  const history = getNodeHistory(nodeId, 1);
  return history[0];
}

export function insertAgentLog(entry: Omit<AgentLogEntry, 'id'>): void {
  db.prepare(`
    INSERT INTO agent_logs (
      timestamp, agent, node_id, stage, severity, message, payload_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.timestamp,
    entry.agent,
    entry.nodeId,
    entry.stage,
    entry.severity,
    entry.message,
    entry.payloadSummary
  );

  // Retain latest 200 agent logs
  db.prepare(`
    DELETE FROM agent_logs
    WHERE id NOT IN (SELECT id FROM agent_logs ORDER BY id DESC LIMIT 200)
  `).run();
}

export function getAgentLogs(limit = 60): AgentLogEntry[] {
  const rows = db.prepare(`
    SELECT * FROM agent_logs ORDER BY id DESC LIMIT ?
  `).all(limit) as Array<{
    id: number;
    timestamp: string;
    agent: AgentName;
    node_id: string;
    stage: AgentLogEntry['stage'];
    severity: AgentLogEntry['severity'];
    message: string;
    payload_summary: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp,
    agent: r.agent,
    nodeId: r.node_id,
    stage: r.stage,
    severity: r.severity,
    message: r.message,
    payloadSummary: r.payload_summary,
  }));
}

export function upsertActiveAlert(params: {
  nodeId: string;
  nodeName: string;
  sector: string;
  category: SafetyAlert['category'];
  severity: AlertSeverity;
  title: string;
  description: string;
  humanSafetyNote: string;
  sourceAgent: AgentName;
}): void {
  const now = new Date().toISOString();
  const existing = db
    .prepare(
      `SELECT id, status FROM alerts WHERE node_id = ? AND category = ? AND status IN ('Active', 'Acknowledged') ORDER BY id DESC LIMIT 1`
    )
    .get(params.nodeId, params.category) as { id: number; status: AlertStatus } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE alerts SET
        severity = ?,
        title = ?,
        description = ?,
        human_safety_note = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      params.severity,
      params.title,
      params.description,
      params.humanSafetyNote,
      now,
      existing.id
    );
  } else {
    db.prepare(`
      INSERT INTO alerts (
        node_id, node_name, sector, category, severity, status,
        title, description, human_safety_note, source_agent, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?, ?, ?)
    `).run(
      params.nodeId,
      params.nodeName,
      params.sector,
      params.category,
      params.severity,
      params.title,
      params.description,
      params.humanSafetyNote,
      params.sourceAgent,
      now,
      now
    );
  }
}

export function autoResolveClearedAlerts(nodeId: string, category: SafetyAlert['category']): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE alerts
    SET status = 'Resolved', updated_at = ?
    WHERE node_id = ? AND category = ? AND status IN ('Active', 'Acknowledged')
  `).run(now, nodeId, category);
}

export function updateAlertStatus(alertId: number, status: AlertStatus): void {
  const now = new Date().toISOString();
  db.prepare(`UPDATE alerts SET status = ?, updated_at = ? WHERE id = ?`).run(status, now, alertId);
}

export function getAlerts(limit = 100): SafetyAlert[] {
  const rows = db.prepare(`SELECT * FROM alerts ORDER BY id DESC LIMIT ?`).all(limit) as Array<{
    id: number;
    node_id: string;
    node_name: string;
    sector: string;
    category: SafetyAlert['category'];
    severity: AlertSeverity;
    status: AlertStatus;
    title: string;
    description: string;
    human_safety_note: string;
    source_agent: AgentName;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    nodeId: r.node_id,
    nodeName: r.node_name,
    sector: r.sector,
    category: r.category,
    severity: r.severity,
    status: r.status,
    title: r.title,
    description: r.description,
    humanSafetyNote: r.human_safety_note,
    sourceAgent: r.source_agent,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function recordIntervention(entry: Omit<InterventionRecord, 'id' | 'createdAt'>): InterventionRecord {
  const createdAt = new Date().toISOString();
  const info = db
    .prepare(`
      INSERT INTO interventions (
        node_id, node_name, unit_name, action_title, triggered_by,
        human_entries_avoided, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      entry.nodeId,
      entry.nodeName,
      entry.unitName,
      entry.actionTitle,
      entry.triggeredBy,
      entry.humanEntriesAvoided,
      entry.status,
      createdAt
    );

  return {
    id: Number(info.lastInsertRowid),
    ...entry,
    createdAt,
  };
}

export function completeInterventionsForNode(nodeId: string): void {
  db.prepare(`UPDATE interventions SET status = 'Completed' WHERE node_id = ? AND status = 'Dispatched'`).run(
    nodeId
  );
}

export function getInterventions(limit = 40): InterventionRecord[] {
  const rows = db.prepare(`SELECT * FROM interventions ORDER BY id DESC LIMIT ?`).all(limit) as Array<{
    id: number;
    node_id: string;
    node_name: string;
    unit_name: string;
    action_title: string;
    triggered_by: string;
    human_entries_avoided: number;
    status: InterventionRecord['status'];
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    nodeId: r.node_id,
    nodeName: r.node_name,
    unitName: r.unit_name,
    actionTitle: r.action_title,
    triggeredBy: r.triggered_by,
    humanEntriesAvoided: r.human_entries_avoided,
    status: r.status,
    createdAt: r.created_at,
  }));
}
