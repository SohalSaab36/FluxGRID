"""CityFlow AI Flask application factory."""

from __future__ import annotations

from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from models.schemas import ValidationError
from routes.auth import auth_bp
from routes.detection import detection_bp
from routes.health import health_bp
from routes.intersections import intersections_bp
from routes.metrics import metrics_bp
from routes.routing import routing_bp
from routes.simulation import simulation_bp
from services.simulation_service import SimulationService
from services.traffic_report_store import TrafficReportStore
from services.vehicle_detector import VehicleDetector
from routes.traffic_reports import traffic_reports_bp
from services.route_service import RouteService, RouteServiceError
from services.account_store import AccountError, AccountStore


def create_app(config: type[Config] = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config)
    CORS(app, origins=config.CORS_ORIGINS, supports_credentials=True)

    app.extensions["simulation"] = SimulationService(config)
    app.extensions["accounts"] = AccountStore(
        config.TRAFFIC_REPORTS_DB_PATH,
        admin_email=config.ADMIN_EMAIL,
        admin_password=config.ADMIN_PASSWORD,
        reset_secret=config.SECRET_KEY,
        reset_ttl_seconds=config.PASSWORD_RESET_OTP_TTL_SECONDS,
    )
    app.extensions["traffic_reports"] = TrafficReportStore(
        config.TRAFFIC_REPORTS_DB_PATH,
        ttl_seconds=config.TRAFFIC_REPORT_TTL_SECONDS,
        max_distance_km=config.TRAFFIC_REPORT_MAX_DISTANCE_KM,
    )
    app.extensions["routing"] = RouteService(
        config,
        app.extensions["simulation"],
        app.extensions["traffic_reports"],
    )
    app.extensions["detector"] = VehicleDetector(config)

    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(intersections_bp, url_prefix="/api")
    app.register_blueprint(simulation_bp, url_prefix="/api")
    app.register_blueprint(traffic_reports_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(routing_bp, url_prefix="/api")
    app.register_blueprint(metrics_bp, url_prefix="/api")
    app.register_blueprint(detection_bp, url_prefix="/api")

    @app.errorhandler(ValidationError)
    def handle_validation(exc: ValidationError):
        return jsonify({"error": str(exc)}), exc.status_code

    @app.errorhandler(AccountError)
    def handle_account_error(exc: AccountError):
        return jsonify({"error": str(exc)}), exc.status_code

    @app.errorhandler(KeyError)
    def handle_missing(exc: KeyError):
        return jsonify({"error": f"Unknown resource: {exc.args[0]}"}), 404

    @app.errorhandler(413)
    def handle_too_large(_exc):
        return jsonify({"error": "Uploaded file exceeds the configured size limit."}), 413

    @app.errorhandler(RouteServiceError)
    def handle_routing_error(exc: RouteServiceError):
        return jsonify({"error": str(exc)}), 502

    @app.get("/")
    def index():
        return jsonify(
            {
                "name": config.APP_NAME,
                "docs": "See backend/README.md",
                "health": "/api/health",
            }
        )

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG,
        use_reloader=False,
    )
