from flask import Blueprint, current_app, jsonify, request

from config import Config
from models.schemas import (
    parse_controller_mode,
    parse_compare_duration,
    parse_scenario_id,
    parse_seed,
    parse_speed,
    parse_step_seconds,
    require_json_object,
)

simulation_bp = Blueprint("simulation", __name__)


@simulation_bp.get("/simulation/state")
def simulation_state():
    return jsonify(current_app.extensions["simulation"].state())


@simulation_bp.post("/simulation/start")
def simulation_start():
    return jsonify(current_app.extensions["simulation"].start())


@simulation_bp.post("/simulation/pause")
def simulation_pause():
    return jsonify(current_app.extensions["simulation"].pause())


@simulation_bp.post("/simulation/reset")
def simulation_reset():
    return jsonify(current_app.extensions["simulation"].reset())


@simulation_bp.post("/simulation/mode")
def simulation_mode():
    payload = require_json_object(request.get_json(silent=True))
    mode = parse_controller_mode(payload)
    intersection_id = payload.get("intersectionId") or payload.get("intersection_id")
    return jsonify(current_app.extensions["simulation"].set_mode(mode, intersection_id))


@simulation_bp.post("/simulation/scenario")
def simulation_scenario():
    payload = require_json_object(request.get_json(silent=True))
    scenario_id = parse_scenario_id(payload)
    state = current_app.extensions["simulation"].set_scenario(scenario_id)
    return jsonify(
        {
            "scenario": state["scenario"],
            "state": state,
        }
    )


@simulation_bp.post("/simulation/step")
def simulation_step():
    payload = request.get_json(silent=True) or {}
    if payload:
        payload = require_json_object(payload)
    seconds = parse_step_seconds(payload, default=1, maximum=Config.MAX_STEP_SECONDS)
    return jsonify(current_app.extensions["simulation"].step(seconds))


@simulation_bp.post("/simulation/speed")
def simulation_speed():
    payload = require_json_object(request.get_json(silent=True))
    speed = parse_speed(payload)
    return jsonify(current_app.extensions["simulation"].set_speed(speed))


@simulation_bp.post("/simulation/settings")
def simulation_settings():
    payload = require_json_object(request.get_json(silent=True))
    return jsonify(current_app.extensions["simulation"].update_settings(payload))


@simulation_bp.post("/simulation/compare")
def simulation_compare():
    payload = request.get_json(silent=True) or {}
    if payload:
        payload = require_json_object(payload)
    duration = parse_compare_duration(
        payload.get("durationSeconds"),
        default=Config.COMPARE_DURATION_SECONDS,
    )
    seed = parse_seed(payload.get("seed"), default=Config.ARRIVAL_SEED)
    result = current_app.extensions["simulation"].compare(duration=duration, seed=seed)
    return jsonify(result)
