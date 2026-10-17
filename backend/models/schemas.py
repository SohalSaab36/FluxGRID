"""Request validation and documented constants for the CityFlow API."""

from __future__ import annotations

import math
from typing import Any

CONTROLLER_MODES = ("fixed", "adaptive")

# Spec scenarios plus the existing frontend scenario identifiers.
BACKEND_SCENARIOS = ("balanced", "peak_hour", "uneven", "changing")
FRONTEND_SCENARIOS = (
    "pm-peak",
    "am-commute",
    "rain-storm",
    "incident-stall",
    "special-event",
)
AI_SENSITIVITIES = ("conservative", "balanced", "aggressive")
TRAFFIC_REPORT_TYPES = ("congestion", "accident", "roadwork", "hazard", "closure")
ROUTE_PLACE_IDS = (
    "gtbit",
    "connaught-place",
    "igi-airport",
    "india-gate",
    "new-delhi-railway-station",
)
SETTING_LIMITS = {
    "minGreenSeconds": (5, 20),
    "maxGreenSeconds": (30, 90),
    "clearanceSeconds": (4, 8),
}
ALL_SCENARIOS = BACKEND_SCENARIOS + FRONTEND_SCENARIOS

APPROACHES = ("north", "south", "east", "west")
NS_APPROACHES = ("north", "south")
EW_APPROACHES = ("east", "west")

PHASE_NS = "North-South green"
PHASE_EW = "East-West green"
PHASE_CLEARANCE = "Clearance interval"

VEHICLE_CLASSES = ("car", "motorcycle", "bus", "truck")
COCO_VEHICLE_IDS = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}


class ValidationError(ValueError):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


def require_json_object(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValidationError("Request body must be a JSON object.")
    return payload


def parse_controller_mode(payload: dict[str, Any]) -> str:
    mode = payload.get("mode") or payload.get("controllerMode")
    if mode not in CONTROLLER_MODES:
        raise ValidationError(
            f"Invalid controller mode. Expected one of: {', '.join(CONTROLLER_MODES)}."
        )
    return str(mode)


def parse_scenario_id(payload: dict[str, Any]) -> str:
    scenario = payload.get("scenario") or payload.get("scenarioId")
    if scenario not in ALL_SCENARIOS:
        raise ValidationError(
            "Invalid scenario. Expected one of: "
            + ", ".join(ALL_SCENARIOS)
            + "."
        )
    return str(scenario)


def parse_step_seconds(payload: dict[str, Any], default: int, maximum: int) -> int:
    raw = payload.get("seconds", payload.get("stepSeconds", default))
    if isinstance(raw, bool) or not isinstance(raw, int):
        raise ValidationError("step seconds must be an integer.")
    seconds = raw
    if seconds < 1 or seconds > maximum:
        raise ValidationError(f"step seconds must be between 1 and {maximum}.")
    return seconds


def parse_speed(payload: dict[str, Any]) -> float:
    raw = payload.get("speed", payload.get("simulationSpeed", 1))
    if isinstance(raw, bool) or not isinstance(raw, (int, float)):
        raise ValidationError("speed must be a number.")
    speed = float(raw)
    if speed not in {0.5, 1.0, 2.0, 5.0}:
        raise ValidationError("speed must be one of: 0.5, 1, 2, 5.")
    return speed


def parse_simulation_settings(
    payload: dict[str, Any],
    current: dict[str, Any],
) -> dict[str, Any]:
    allowed = set(SETTING_LIMITS) | {"aiSensitivity"}
    unknown = set(payload) - allowed
    if unknown:
        raise ValidationError(f"Unknown simulation setting: {sorted(unknown)[0]}.")

    parsed: dict[str, Any] = {}
    for name, (minimum, maximum) in SETTING_LIMITS.items():
        if name not in payload:
            continue
        value = payload[name]
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValidationError(f"{name} must be an integer.")
        if not minimum <= value <= maximum:
            raise ValidationError(f"{name} must be between {minimum} and {maximum}.")
        parsed[name] = value

    if "aiSensitivity" in payload:
        sensitivity = payload["aiSensitivity"]
        if sensitivity not in AI_SENSITIVITIES:
            raise ValidationError(
                "aiSensitivity must be one of: " + ", ".join(AI_SENSITIVITIES) + "."
            )
        parsed["aiSensitivity"] = sensitivity

    min_green = parsed.get("minGreenSeconds", current["minGreenSeconds"])
    max_green = parsed.get("maxGreenSeconds", current["maxGreenSeconds"])
    if min_green > max_green:
        raise ValidationError("minGreenSeconds cannot exceed maxGreenSeconds.")
    return parsed


def parse_compare_duration(value: Any, default: int) -> int:
    if value is None:
        return default
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("durationSeconds must be an integer.")
    if value < 30 or value > 3600:
        raise ValidationError("durationSeconds must be between 30 and 3600.")
    return value


def parse_seed(value: Any, default: int) -> int:
    if value is None:
        return default
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("seed must be an integer.")
    if value < 0 or value > 2**32 - 1:
        raise ValidationError(f"seed must be between 0 and {2**32 - 1}.")
    return value


def parse_traffic_report(payload: dict[str, Any]) -> dict[str, Any]:
    report_type = payload.get("type")
    if report_type not in TRAFFIC_REPORT_TYPES:
        raise ValidationError(
            "type must be one of: " + ", ".join(TRAFFIC_REPORT_TYPES) + "."
        )

    coordinates = {}
    for name, minimum, maximum in (
        ("latitude", -90.0, 90.0),
        ("longitude", -180.0, 180.0),
    ):
        value = payload.get(name)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValidationError(f"{name} must be a number.")
        value = float(value)
        if not math.isfinite(value) or not minimum <= value <= maximum:
            raise ValidationError(f"{name} must be between {minimum:g} and {maximum:g}.")
        coordinates[name] = value

    description = payload.get("description", "")
    if not isinstance(description, str):
        raise ValidationError("description must be text.")
    description = description.strip()
    if len(description) > 300:
        raise ValidationError("description must be 300 characters or fewer.")

    return {
        "type": report_type,
        "latitude": coordinates["latitude"],
        "longitude": coordinates["longitude"],
        "description": description,
    }


def parse_route_request(payload: dict[str, Any]) -> tuple[str, str]:
    origin = payload.get("originId")
    destination = payload.get("destinationId")
    if origin not in ROUTE_PLACE_IDS:
        raise ValidationError("originId must identify a supported route location.")
    if destination not in ROUTE_PLACE_IDS:
        raise ValidationError("destinationId must identify a supported route location.")
    if origin == destination:
        raise ValidationError("Choose different origin and destination locations.")
    return str(origin), str(destination)
