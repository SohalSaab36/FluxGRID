"""Scenario definitions for the in-memory traffic simulation.

Frontend scenario IDs are preserved so the existing Simulation Lab cards
continue to work. Spec IDs (balanced, peak_hour, uneven, changing) are also
accepted by the API.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import sin, pi

from models.schemas import APPROACHES


@dataclass(frozen=True)
class ScenarioDefinition:
    id: str
    name: str
    code: str
    description: str
    arrival_multiplier: float
    incident_severity: float
    approach_bias: dict[str, float]
    time_varying: bool = False
    data_note: str = (
        "Demonstration scenario. Arrival rates are simulated, not live municipal data."
    )


SCENARIOS: dict[str, ScenarioDefinition] = {
    "balanced": ScenarioDefinition(
        id="balanced",
        name="Balanced demonstration demand",
        code="Scenario CF-BAL",
        description="Even arrival rates on all four approaches.",
        arrival_multiplier=1.0,
        incident_severity=0.0,
        approach_bias={a: 1.0 for a in APPROACHES},
    ),
    "peak_hour": ScenarioDefinition(
        id="peak_hour",
        name="Peak-hour demonstration demand",
        code="Scenario CF-PEAK",
        description="Elevated arrival rates representing a peak commuting period.",
        arrival_multiplier=1.45,
        incident_severity=0.0,
        approach_bias={a: 1.0 for a in APPROACHES},
    ),
    "uneven": ScenarioDefinition(
        id="uneven",
        name="Uneven corridor demand",
        code="Scenario CF-UNEV",
        description="North–South heavily loaded; East–West light.",
        arrival_multiplier=1.1,
        incident_severity=0.0,
        approach_bias={"north": 1.8, "south": 1.7, "east": 0.45, "west": 0.4},
    ),
    "changing": ScenarioDefinition(
        id="changing",
        name="Time-varying demand",
        code="Scenario CF-CHG",
        description="Arrival intensity oscillates over the simulated hour.",
        arrival_multiplier=1.2,
        incident_severity=0.0,
        approach_bias={a: 1.0 for a in APPROACHES},
        time_varying=True,
    ),
    "pm-peak": ScenarioDefinition(
        id="pm-peak",
        name="Downtown grid · PM peak",
        code="Scenario CF-024",
        description="High commuter egress demand radiating from commercial district to arterials.",
        arrival_multiplier=1.4,
        incident_severity=0.0,
        approach_bias={a: 1.0 for a in APPROACHES},
    ),
    "am-commute": ScenarioDefinition(
        id="am-commute",
        name="Inbound commute · AM peak",
        code="Scenario CF-012",
        description="Heavy inward migration towards financial district and government offices.",
        arrival_multiplier=1.35,
        incident_severity=0.0,
        approach_bias={"north": 1.3, "south": 0.8, "east": 1.2, "west": 0.9},
    ),
    "rain-storm": ScenarioDefinition(
        id="rain-storm",
        name="Monsoon downpour · Wet asphalt",
        code="Scenario CF-088",
        description="Reduced acceleration rates, higher following distance, waterlogged curbs.",
        arrival_multiplier=1.1,
        incident_severity=0.3,
        approach_bias={a: 1.0 for a in APPROACHES},
    ),
    "incident-stall": ScenarioDefinition(
        id="incident-stall",
        name="Lane obstruction · Central Ave",
        code="Scenario CF-099",
        description="Stalled transit vehicle blocking single lane on Central & 5th approach.",
        arrival_multiplier=1.25,
        incident_severity=0.7,
        approach_bias={"north": 1.6, "south": 1.1, "east": 1.0, "west": 1.0},
    ),
    "special-event": ScenarioDefinition(
        id="special-event",
        name="Civic stadium egress",
        code="Scenario CF-055",
        description="Surge pedestrian crossings and concentrated vehicle exodus from stadium.",
        arrival_multiplier=1.6,
        incident_severity=0.2,
        approach_bias={"east": 1.5, "west": 1.4, "north": 1.1, "south": 1.0},
    ),
}

FRONTEND_SCENARIO_ORDER = [
    "pm-peak",
    "am-commute",
    "rain-storm",
    "incident-stall",
    "special-event",
]


def get_scenario(scenario_id: str) -> ScenarioDefinition:
    if scenario_id not in SCENARIOS:
        raise KeyError(scenario_id)
    return SCENARIOS[scenario_id]


def scenario_to_frontend(scenario: ScenarioDefinition) -> dict:
    return {
        "id": scenario.id,
        "name": scenario.name,
        "code": scenario.code,
        "description": scenario.description,
        "arrivalMultiplier": scenario.arrival_multiplier,
        "incidentSeverity": scenario.incident_severity,
    }


def frontend_scenario_catalog() -> list[dict]:
    return [scenario_to_frontend(SCENARIOS[sid]) for sid in FRONTEND_SCENARIO_ORDER]


def arrival_rate_at(
    base_rate_per_second: float,
    scenario: ScenarioDefinition,
    approach: str,
    sim_time: int,
) -> float:
    bias = scenario.approach_bias.get(approach, 1.0)
    rate = base_rate_per_second * scenario.arrival_multiplier * bias
    if scenario.time_varying:
        # One full sine cycle every 300 simulated seconds.
        wave = 0.55 + 0.45 * (0.5 + 0.5 * sin(2 * pi * (sim_time % 300) / 300.0))
        rate *= wave
    if scenario.incident_severity and approach == "north":
        rate *= 1.0 + 0.4 * scenario.incident_severity
    return max(0.0, rate)
