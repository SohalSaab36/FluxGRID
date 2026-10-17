from flask import Blueprint, current_app, jsonify, request

from models.schemas import parse_route_request, require_json_object

routing_bp = Blueprint("routing", __name__)


@routing_bp.get("/routing/places")
def routing_places():
    return jsonify({"places": current_app.extensions["routing"].places()})


@routing_bp.post("/routing/plan")
def plan_route():
    payload = require_json_object(request.get_json(silent=True))
    origin_id, destination_id = parse_route_request(payload)
    plan = current_app.extensions["routing"].plan(origin_id, destination_id)
    return jsonify(plan)
