def test_start_pause_reset(client):
    started = client.post("/api/simulation/start")
    assert started.status_code == 200
    assert started.get_json()["status"] == "running"

    paused = client.post("/api/simulation/pause")
    assert paused.status_code == 200
    assert paused.get_json()["status"] == "paused"
    clock = paused.get_json()["simulatedClockSeconds"]

    stepped = client.post("/api/simulation/step", json={"seconds": 5})
    assert stepped.get_json()["simulatedClockSeconds"] == clock + 5

    reset = client.post("/api/simulation/reset")
    assert reset.status_code == 200
    assert reset.get_json()["simulatedClockSeconds"] == 0
    assert reset.get_json()["status"] == "paused"


def test_initial_state_returns_kpis(client):
    response = client.get("/api/simulation/state")
    assert response.status_code == 200
    state = response.get_json()
    assert state["status"] == "paused"
    assert state["kpis"]["throughputDeltaPct"] == 0
    assert state["kpis"]["co2EmissionsReductionPct"] == 0


def test_mode_and_scenario_validation(client):
    ok = client.post("/api/simulation/mode", json={"mode": "fixed"})
    assert ok.status_code == 200
    assert ok.get_json()["controllerMode"] == "fixed"

    bad_mode = client.post("/api/simulation/mode", json={"mode": "reinforcement"})
    assert bad_mode.status_code == 400

    scenario = client.post("/api/simulation/scenario", json={"scenario": "uneven"})
    assert scenario.status_code == 200
    assert scenario.get_json()["scenario"]["id"] == "uneven"

    frontend_scenario = client.post("/api/simulation/scenario", json={"scenarioId": "pm-peak"})
    assert frontend_scenario.status_code == 200
    assert frontend_scenario.get_json()["scenario"]["id"] == "pm-peak"

    bad_scenario = client.post("/api/simulation/scenario", json={"scenario": "teleport"})
    assert bad_scenario.status_code == 400


def test_step_bounds(client):
    too_big = client.post("/api/simulation/step", json={"seconds": 10_000})
    assert too_big.status_code == 400


def test_simulation_settings_validation(client):
    updated = client.post(
        "/api/simulation/settings",
        json={
            "minGreenSeconds": 12,
            "maxGreenSeconds": 45,
            "clearanceSeconds": 5,
            "aiSensitivity": "aggressive",
        },
    )
    assert updated.status_code == 200
    assert updated.get_json()["settings"] == {
        "minGreenSeconds": 12,
        "maxGreenSeconds": 45,
        "clearanceSeconds": 5,
        "aiSensitivity": "aggressive",
    }

    invalid_payloads = [
        {"minGreenSeconds": 4},
        {"maxGreenSeconds": 91},
        {"clearanceSeconds": 9},
        {"aiSensitivity": "reckless"},
        {"minGreenSeconds": "12"},
        {"unknownSetting": 1},
    ]
    for payload in invalid_payloads:
        response = client.post("/api/simulation/settings", json=payload)
        assert response.status_code == 400
        assert "error" in response.get_json()


def test_numeric_endpoints_reject_coercible_or_invalid_values(client):
    assert client.post("/api/simulation/step", json={"seconds": 1.5}).status_code == 400
    assert client.post("/api/simulation/step", json={"seconds": True}).status_code == 400
    assert client.post("/api/simulation/speed", json={"speed": True}).status_code == 400

    for seed in (True, -1, 2**32, "not-a-seed"):
        response = client.post(
            "/api/simulation/compare",
            json={"durationSeconds": 120, "seed": seed},
        )
        assert response.status_code == 400
        assert "error" in response.get_json()


def test_compare_endpoint(client):
    response = client.post(
        "/api/simulation/compare",
        json={"durationSeconds": 120, "seed": 5},
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["identicalArrivals"] is True
    assert "averageWaitingTime" in str(payload["summary"]).replace(" ", "") or (
        "fixedAverageWaitingTime" in payload["summary"]
    )
    assert payload["summary"]["fixedVehiclesServed"] >= 0
    assert payload["totalSimulatedDurationSeconds"] == 120


def test_state_matches_frontend_keys(client):
    state = client.get("/api/simulation/state").get_json()
    assert "intersections" in state
    assert "kpis" in state
    assert "performanceData" in state
    assert "controllerMode" in state
    item = state["intersections"][0]
    assert "approaches" in item
    assert "phases" in item
