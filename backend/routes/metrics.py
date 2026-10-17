from flask import Blueprint, Response, current_app, jsonify

metrics_bp = Blueprint("metrics", __name__)


@metrics_bp.get("/metrics")
def metrics():
    return jsonify(current_app.extensions["simulation"].metrics())


@metrics_bp.get("/metrics/history")
def metrics_history():
    return jsonify(current_app.extensions["simulation"].metrics_history())


@metrics_bp.get("/metrics/export")
def metrics_export():
    csv_text = current_app.extensions["simulation"].export_csv()
    return Response(
        csv_text,
        mimetype="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=cityflow_simulated_metrics.csv"
        },
    )
