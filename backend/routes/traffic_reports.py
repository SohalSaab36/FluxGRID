from flask import Blueprint, current_app, jsonify, request

from models.schemas import parse_traffic_report, require_json_object
from routes.auth import admin_required, current_account

traffic_reports_bp = Blueprint("traffic_reports", __name__)


@traffic_reports_bp.get("/traffic/reports")
def list_traffic_reports():
    reports = current_app.extensions["traffic_reports"].active()
    return jsonify(
        {
            "reports": reports,
            "dataProvenance": "community-reports",
            "expiresAfterSeconds": current_app.config["TRAFFIC_REPORT_TTL_SECONDS"],
            "maxDistanceKm": current_app.config["TRAFFIC_REPORT_MAX_DISTANCE_KM"],
        }
    )


@traffic_reports_bp.post("/traffic/reports")
def create_traffic_report():
    account = current_account()
    if account is None:
        return jsonify({"error": "Sign in to submit a traffic report."}), 401
    payload = require_json_object(request.get_json(silent=True))
    report = parse_traffic_report(payload)
    created = current_app.extensions["traffic_reports"].create(report, submitted_by=account["id"])
    return jsonify({"report": created, "dataProvenance": "community-report"}), 201


@traffic_reports_bp.get("/admin/traffic/reports/pending")
@admin_required
def list_pending_accidents(_account):
    reports = current_app.extensions["traffic_reports"].pending_accidents()
    return jsonify({"reports": reports})


@traffic_reports_bp.post("/admin/traffic/reports/<report_id>/decision")
@admin_required
def decide_accident_report(_account, report_id: str):
    payload = require_json_object(request.get_json(silent=True))
    decision = payload.get("decision")
    if decision not in {"approve", "reject"}:
        from models.schemas import ValidationError

        raise ValidationError("decision must be 'approve' or 'reject'.")
    report = current_app.extensions["traffic_reports"].decide_accident(
        report_id,
        "approved" if decision == "approve" else "rejected",
    )
    return jsonify({"report": report})
