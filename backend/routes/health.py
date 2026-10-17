from flask import Blueprint, current_app, jsonify

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health():
    simulation = current_app.extensions["simulation"]
    detector = current_app.extensions["detector"]
    status = detector.status()
    state = simulation.state()
    return jsonify(
        {
            "status": "ok",
            "application": current_app.config.get("APP_NAME", "CityFlow AI"),
            "simulation": {
                "status": state["status"],
                "simulatedClockSeconds": state["simulatedClockSeconds"],
            },
            "yoloAvailable": status["yoloAvailable"],
            "modelLoaded": status["modelLoaded"],
            "weightsAvailable": status["weightsAvailable"],
            "note": "This endpoint does not download or load YOLO weights.",
        }
    )
