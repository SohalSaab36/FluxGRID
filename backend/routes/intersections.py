from flask import Blueprint, current_app, jsonify

intersections_bp = Blueprint("intersections", __name__)


@intersections_bp.get("/intersections")
def list_intersections():
    simulation = current_app.extensions["simulation"]
    return jsonify(
        {
            "dataProvenance": "simulated",
            "demonstrationNote": (
                "Intersection coordinates are demonstration points around Delhi, India. "
                "They are not live municipal traffic sensors."
            ),
            "intersections": simulation.list_intersections(),
        }
    )


@intersections_bp.get("/intersections/<intersection_id>")
def get_intersection(intersection_id: str):
    simulation = current_app.extensions["simulation"]
    try:
        payload = simulation.get_intersection(intersection_id)
    except KeyError:
        return jsonify({"error": f"Unknown intersection id: {intersection_id}"}), 404
    return jsonify(payload)
