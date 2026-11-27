"""
SANI-AI: Multi-Agent Sewage Management & Human Safety Reference Engine (Python)
------------------------------------------------------------------------------
This standalone Python module demonstrates the four logical AI agents
operating over the shared SQLite telemetry database (`data/sani_ai.db`):
  1. MonitoringAgent: Reads simulated ESP32 water-level, flow, and gas readings.
  2. BlockageDetectionAgent: Detects hydraulic impedance (level rise vs flow drop).
  3. PredictiveAnalysisAgent: Computes OLS linear trend + logistic overflow risk.
  4. DecisionMakingAgent: Enforces human-entry lockouts and prescribes robotics.

Note: Prototype uses simulated ESP32 telemetry and does not connect to
physical municipal sewage infrastructure.
"""

from __future__ import annotations

import json
import math
import sqlite3
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Optional

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "sani_ai.db"


@dataclass
class AgentReport:
    node_id: str
    node_name: str
    water_level_pct: float
    flow_rate_lps: float
    h2s_ppm: float
    blockage_severity: str
    overflow_risk_level: str
    overflow_probability_pct: int
    human_entry_prohibited: bool
    recommended_intervention: str


class MonitoringAgent:
    """Agent 1: Validates simulated ESP32 readings and flags toxic gas thresholds."""

    def evaluate_gas_safety(self, h2s_ppm: float, ch4_lel_pct: float, thresholds: dict) -> bool:
        return (
            h2s_ppm >= thresholds["h2s_warning_ppm"]
            or ch4_lel_pct >= thresholds["ch4_warning_lel_pct"]
        )


class BlockageDetectionAgent:
    """Agent 2: Compares actual flow against expected Manning-style hydraulic flow."""

    def analyze(self, level_pct: float, flow_lps: float, max_capacity_lps: float, deficit_limit: float) -> tuple[str, float]:
        head_factor = min(1.0, (level_pct / 88.0) * 0.95 + 0.08)
        expected_flow = max_capacity_lps * head_factor * 0.86
        deficit_pct = max(0.0, ((expected_flow - flow_lps) / expected_flow) * 100.0) if expected_flow > 0 else 0.0

        if deficit_pct >= deficit_limit + 22:
            return "Severe", round(deficit_pct, 1)
        if deficit_pct >= deficit_limit:
            return "Moderate", round(deficit_pct, 1)
        if deficit_pct >= deficit_limit * 0.68:
            return "Low", round(deficit_pct, 1)
        return "None", round(deficit_pct, 1)


class PredictiveAnalysisAgent:
    """Agent 3: Runs Ordinary Least Squares trend + logistic overflow probability."""

    def predict(self, levels: List[float], flow_deficit_pct: float, thresholds: dict) -> tuple[str, int]:
        n = len(levels)
        slope = 0.0
        if n >= 3:
            mean_x = (n - 1) / 2.0
            mean_y = sum(levels) / n
            num = sum((i - mean_x) * (y - mean_y) for i, y in enumerate(levels))
            den = sum((i - mean_x) ** 2 for i in range(n))
            slope = num / den if den else 0.0

        slope_per_min = slope * 4.0
        latest_level = levels[-1] if levels else 0.0
        z = -4.2 + (latest_level - 52.0) * 0.085 + max(0.0, slope_per_min) * 1.45 + flow_deficit_pct * 0.035
        prob = round((1.0 / (1.0 + math.exp(-z))) * 100)

        if latest_level >= thresholds["water_level_critical_pct"] or prob >= 72:
            return "High", prob
        if latest_level >= thresholds["water_level_warning_pct"] or prob >= 40:
            return "Medium", prob
        return "Low", prob


class DecisionMakingAgent:
    """Agent 4: Synthesizes upstream agent findings into mechanized interventions."""

    def recommend(self, gas_hazard: bool, blockage_severity: str, risk_level: str) -> tuple[bool, str]:
        human_entry_prohibited = gas_hazard or risk_level == "High"
        if gas_hazard and blockage_severity in ("Moderate", "Severe"):
            return True, "Deploy ATEX Mobile Gas Scrubber + Robotic Hydro-Jet Crawler"
        if gas_hazard:
            return True, "Activate High-CFM Exhaust Blower & Neutralizing Scrubber (No Human Entry)"
        if blockage_severity in ("Moderate", "Severe"):
            return human_entry_prohibited, "Dispatch Street-Operated Robotic Hydro-Jetting Crawler"
        if risk_level == "High":
            return True, "Open Automated Bypass Weir & Engage Surge Dewatering Pump"
        return False, "Continue Automated ESP32 Telemetry Monitoring"


def run_python_audit(db_path: Path = DB_PATH) -> List[AgentReport]:
    if not db_path.exists():
        raise FileNotFoundError(f"SQLite database not found at {db_path}. Start the SANI-AI server first.")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    thresholds = dict(conn.execute("SELECT * FROM thresholds WHERE id = 1").fetchone())
    nodes = conn.execute("SELECT * FROM nodes ORDER BY id").fetchall()

    monitor = MonitoringAgent()
    blockage_agent = BlockageDetectionAgent()
    predictor = PredictiveAnalysisAgent()
    decider = DecisionMakingAgent()

    reports: List[AgentReport] = []
    for node in nodes:
        rows = conn.execute(
            "SELECT * FROM telemetry_readings WHERE node_id = ? ORDER BY id DESC LIMIT 12",
            (node["id"],),
        ).fetchall()
        if not rows:
            continue
        ordered = list(reversed(rows))
        latest = ordered[-1]
        levels = [r["water_level_pct"] for r in ordered]

        gas_hazard = monitor.evaluate_gas_safety(latest["h2s_ppm"], latest["ch4_lel_pct"], thresholds)
        blockage_sev, deficit_pct = blockage_agent.analyze(
            latest["water_level_pct"],
            latest["flow_rate_lps"],
            node["max_capacity_lps"],
            thresholds["blockage_flow_deficit_pct"],
        )
        risk_level, prob_pct = predictor.predict(levels, deficit_pct, thresholds)
        lockout, intervention = decider.recommend(gas_hazard, blockage_sev, risk_level)

        reports.append(
            AgentReport(
                node_id=node["id"],
                node_name=node["name"],
                water_level_pct=latest["water_level_pct"],
                flow_rate_lps=latest["flow_rate_lps"],
                h2s_ppm=latest["h2s_ppm"],
                blockage_severity=blockage_sev,
                overflow_risk_level=risk_level,
                overflow_probability_pct=prob_pct,
                human_entry_prohibited=lockout,
                recommended_intervention=intervention,
            )
        )

    conn.close()
    return reports


if __name__ == "__main__":
    if DB_PATH.exists():
        print(json.dumps([asdict(r) for r in run_python_audit()], indent=2))
    else:
        print("SANI-AI Python Multi-Agent Module loaded. Run server first to initialize data/sani_ai.db.")
