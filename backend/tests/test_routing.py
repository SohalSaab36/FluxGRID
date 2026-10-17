import json
from urllib.error import URLError
from unittest.mock import patch


class StubResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


def route_payload():
    return {
        "code": "Ok",
        "routes": [
            {
                "distance": 12_000,
                "duration": 1_200,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [77.1127, 28.6477],
                        [77.1025, 28.7041],
                        [77.2167, 28.6315],
                    ],
                },
            },
            {
                "distance": 12_500,
                "duration": 1_000,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [77.1127, 28.6477],
                        [77.1150, 28.6945],
                        [77.2167, 28.6315],
                    ],
                },
            },
        ],
    }


def test_route_planner_scores_osrm_routes_with_community_reports(client):
    phone = "+91 98765 43212"
    assert client.post(
        "/api/auth/signup/phone-verification",
        json={"phone": phone},
    ).status_code == 200
    account = client.post(
        "/api/auth/signup",
        json={
            "email": "router@example.test",
            "password": "test-user-password-123",
            "fullName": "Test Router",
            "phone": phone,
            "city": "Delhi",
            "phoneVerificationCode": "123456",
        },
    )
    assert account.status_code == 201
    created = client.post(
        "/api/traffic/reports",
        json={
            "type": "accident",
            "latitude": 28.7041,
            "longitude": 77.1025,
            "description": "Incident for route scoring test.",
        },
    )
    assert created.status_code == 201

    with patch(
        "services.route_service.urlopen",
        return_value=StubResponse(route_payload()),
    ) as mocked_urlopen:
        response = client.post(
            "/api/routing/plan",
            json={"originId": "gtbit", "destinationId": "connaught-place"},
        )

    assert response.status_code == 200
    request = mocked_urlopen.call_args.args[0]
    assert "router.project-osrm.org/route/v1/driving/" in request.full_url
    plan = response.get_json()
    assert plan["routingProvider"] == "OSRM / OpenStreetMap"
    assert plan["trafficEstimate"] == "simulated-and-community-reports"
    assert "not live traffic measurements" in plan["trafficDataNote"]
    assert len(plan["routes"]) == 2
    assert plan["recommendedRouteId"] == plan["routes"][0]["id"]
    assert plan["routes"][0]["estimatedDurationSeconds"] <= plan["routes"][1]["estimatedDurationSeconds"]
    matched = [
        node
        for route in plan["routes"]
        for node in route["matchedIntersections"]
        if node["id"] == "int-04"
    ]
    assert matched
    assert any(node["activeReports"] == 1 for node in matched)
    assert all(route["estimateScope"] == "route-local" for route in plan["routes"])


def test_routing_places_and_request_validation(client):
    places = client.get("/api/routing/places")
    assert places.status_code == 200
    assert {place["id"] for place in places.get_json()["places"]} >= {
        "gtbit",
        "connaught-place",
    }

    assert client.post("/api/routing/plan", json={}).status_code == 400
    assert client.post(
        "/api/routing/plan",
        json={"originId": "gtbit", "destinationId": "gtbit"},
    ).status_code == 400


def test_routing_service_failure_is_reported(client):
    with patch("services.route_service.urlopen", side_effect=URLError("offline")):
        response = client.post(
            "/api/routing/plan",
            json={"originId": "gtbit", "destinationId": "connaught-place"},
        )
    assert response.status_code == 502
    assert "routing service is unavailable" in response.get_json()["error"]


def test_route_without_local_intersections_uses_labeled_regional_estimate(client):
    remote_route = {
        "code": "Ok",
        "routes": [
            {
                "distance": 12_000,
                "duration": 1_200,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[77.1127, 28.6477], [77.2167, 28.6315]],
                },
            }
        ],
    }
    with patch(
        "services.route_service.urlopen",
        return_value=StubResponse(remote_route),
    ):
        response = client.post(
            "/api/routing/plan",
            json={"originId": "gtbit", "destinationId": "connaught-place"},
        )

    route = response.get_json()["routes"][0]
    assert response.status_code == 200
    assert route["matchedIntersections"] == []
    assert route["congestionScore"] is not None
    assert route["estimateScope"] == "regional-demo"
    assert "lower-confidence regional demo estimate" in response.get_json()["trafficDataNote"]
