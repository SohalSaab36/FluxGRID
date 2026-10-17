"""OSRM route lookup with transparent simulation-based congestion scoring."""

from __future__ import annotations

import json
import math
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from config import Config
from services.traffic_report_store import TrafficReportStore

ROUTE_PLACES = (
    {"id": "gtbit", "name": "GTBIT, Rajouri Garden", "coordinates": [77.1127, 28.6477]},
    {"id": "connaught-place", "name": "Connaught Place", "coordinates": [77.2167, 28.6315]},
    {"id": "igi-airport", "name": "IGI Airport, Terminal 3", "coordinates": [77.1000, 28.5562]},
    {"id": "india-gate", "name": "India Gate", "coordinates": [77.2295, 28.6129]},
    {
        "id": "new-delhi-railway-station",
        "name": "New Delhi Railway Station",
        "coordinates": [77.2197, 28.6431],
    },
)

REPORT_RISK = {
    "congestion": 12,
    "accident": 24,
    "roadwork": 15,
    "hazard": 20,
    "closure": 30,
}


class RouteServiceError(RuntimeError):
    """Raised when the external routing engine cannot provide a route."""


class RouteService:
    def __init__(
        self,
        config: type[Config] | Config,
        simulation: Any,
        reports: TrafficReportStore,
    ) -> None:
        self.config = config
        self.simulation = simulation
        self.reports = reports

    @staticmethod
    def places() -> list[dict[str, Any]]:
        return [
            {**place, "coordinates": list(place["coordinates"])}
            for place in ROUTE_PLACES
        ]

    def plan(self, origin_id: str, destination_id: str) -> dict[str, Any]:
        places = {place["id"]: place for place in ROUTE_PLACES}
        origin = places[origin_id]
        destination = places[destination_id]
        coords = (
            f'{origin["coordinates"][0]},{origin["coordinates"][1]};'
            f'{destination["coordinates"][0]},{destination["coordinates"][1]}'
        )
        query = urlencode(
            {
                "alternatives": "true",
                "overview": "full",
                "geometries": "geojson",
                "steps": "false",
            }
        )
        request = Request(
            f"{self.config.ROUTING_BASE_URL}/route/v1/driving/{coords}?{query}",
            headers={"User-Agent": "FluxGRID-CityFlowAI/1.0"},
        )
        try:
            with urlopen(request, timeout=self.config.ROUTING_TIMEOUT_SECONDS) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
            raise RouteServiceError(
                "The public routing service is unavailable. Please try again shortly."
            ) from exc

        if not isinstance(payload, dict):
            raise RouteServiceError("The routing service returned an invalid response.")
        raw_routes = payload.get("routes")
        if payload.get("code") != "Ok" or not isinstance(raw_routes, list) or not raw_routes:
            raise RouteServiceError("The routing service could not find a drivable route.")

        intersections = self.simulation.list_intersections()
        reports = self.reports.active()
        network_score = round(
            sum(
                min(
                    100,
                    {"clear": 8, "moderate": 42, "heavy": 78}[item["congestion"]]
                    + min(20, item["queueLength"] // 2),
                )
                for item in intersections
            )
            / max(1, len(intersections))
        )
        reports_by_intersection: dict[str, list[dict[str, Any]]] = {}
        for report in reports:
            reports_by_intersection.setdefault(report["intersectionId"], []).append(report)

        scored_routes = []
        for index, route in enumerate(raw_routes):
            if len(scored_routes) == 3:
                break
            if not isinstance(route, dict):
                continue
            geometry = route.get("geometry")
            coordinates = geometry.get("coordinates") if isinstance(geometry, dict) else None
            if (
                not isinstance(coordinates, list)
                or len(coordinates) < 2
                or any(
                    not isinstance(point, list)
                    or len(point) < 2
                    or any(
                        isinstance(value, bool)
                        or not isinstance(value, (int, float))
                        or not math.isfinite(value)
                        for value in point[:2]
                    )
                    or not -180 <= point[0] <= 180
                    or not -90 <= point[1] <= 90
                    for point in coordinates
                )
            ):
                continue
            if geometry.get("type") != "LineString":
                continue
            try:
                distance_m = float(route["distance"])
                duration_seconds = float(route["duration"])
            except (KeyError, TypeError, ValueError):
                continue
            if (
                not math.isfinite(distance_m)
                or not math.isfinite(duration_seconds)
                or distance_m <= 0
                or duration_seconds <= 0
            ):
                continue
            nearby = []
            for intersection in intersections:
                distance = self._distance_to_route_km(intersection["coordinates"], coordinates)
                if distance <= self.config.ROUTE_INTERSECTION_RADIUS_KM:
                    nearby.append((intersection, distance))

            node_scores = []
            route_report_count = 0
            matched_intersections = []
            for intersection, distance in nearby:
                congestion_points = {
                    "clear": 8,
                    "moderate": 42,
                    "heavy": 78,
                }[intersection["congestion"]]
                congestion_points += min(20, intersection["queueLength"] // 2)
                node_reports = reports_by_intersection.get(intersection["id"], [])
                report_points = min(
                    40,
                    sum(REPORT_RISK[report["type"]] for report in node_reports),
                )
                node_scores.append(min(100, congestion_points + report_points))
                route_report_count += len(node_reports)
                matched_intersections.append(
                    {
                        "id": intersection["id"],
                        "code": intersection["code"],
                        "name": intersection["name"],
                        "distanceKm": round(distance, 2),
                        "congestion": intersection["congestion"],
                        "activeReports": len(node_reports),
                    }
                )

            has_local_data = bool(node_scores)
            score = round(sum(node_scores) / len(node_scores)) if has_local_data else network_score
            estimated_duration = duration_seconds
            estimated_duration *= 1 + score / 300
            if has_local_data:
                estimated_duration += route_report_count * 60
            scored_routes.append(
                {
                    "id": f"route-{index + 1}",
                    "geometry": geometry,
                    "distanceKm": round(distance_m / 1000, 2),
                    "baseDurationSeconds": round(duration_seconds),
                    "estimatedDurationSeconds": round(estimated_duration),
                    "congestionScore": score,
                    "riskLabel": self._risk_label(score),
                    "estimateScope": "route-local" if has_local_data else "regional-demo",
                    "activeReports": route_report_count,
                    "matchedIntersections": matched_intersections,
                }
            )

        if not scored_routes:
            raise RouteServiceError("The routing service returned no usable route geometry.")

        scored_routes.sort(key=lambda item: item["estimatedDurationSeconds"])
        recommended = scored_routes[0]["id"]
        return {
            "origin": origin,
            "destination": destination,
            "routes": scored_routes,
            "recommendedRouteId": recommended,
            "routingProvider": "OSRM / OpenStreetMap",
            "trafficEstimate": "simulated-and-community-reports",
            "trafficDataNote": (
                "Route geometry and baseline duration come from OpenStreetMap routing. "
                "Congestion scores are estimates from this demo's traffic simulation and "
                "unverified community reports; they are not live traffic measurements. "
                "Routes without nearby modeled intersections use a lower-confidence regional demo estimate."
            ),
        }

    @staticmethod
    def _risk_label(score: int | None) -> str:
        if score is None:
            return "no modeled data"
        if score >= 70:
            return "high"
        if score >= 40:
            return "moderate"
        return "low"

    @classmethod
    def _distance_to_route_km(
        cls,
        point: list[float],
        coordinates: list[list[float]],
    ) -> float:
        point_lon, point_lat = point
        return min(
            cls._distance_to_segment_km(point_lon, point_lat, start, end)
            for start, end in zip(coordinates, coordinates[1:])
        )

    @staticmethod
    def _distance_to_segment_km(
        point_lon: float,
        point_lat: float,
        start: list[float],
        end: list[float],
    ) -> float:
        latitude_scale = 111.32
        longitude_scale = latitude_scale * math.cos(math.radians(point_lat))
        px, py = point_lon * longitude_scale, point_lat * latitude_scale
        ax, ay = start[0] * longitude_scale, start[1] * latitude_scale
        bx, by = end[0] * longitude_scale, end[1] * latitude_scale
        dx, dy = bx - ax, by - ay
        segment_length_squared = dx * dx + dy * dy
        if segment_length_squared == 0:
            return math.hypot(px - ax, py - ay)
        fraction = max(
            0.0,
            min(1.0, ((px - ax) * dx + (py - ay) * dy) / segment_length_squared),
        )
        return math.hypot(px - (ax + fraction * dx), py - (ay + fraction * dy))
