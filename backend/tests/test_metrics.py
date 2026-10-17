from services.metrics_service import compare_metrics, engine_metrics
from services.scenario_service import get_scenario
from services.traffic_controller import TimingBounds
from services.traffic_engine import IntersectionEngine, clone_engine_with_arrivals, generate_arrivals


def _template() -> IntersectionEngine:
    rates = {"north": 0.25, "south": 0.22, "east": 0.18, "west": 0.16}
    return IntersectionEngine(
        intersection_id="int-04",
        meta={
            "code": "J04",
            "name": "Central & 5th",
            "district": "Demo",
            "coordinates": [77.1025, 28.7041],
            "cameraId": "CAM 04",
        },
        base_rates=rates,
        initial_queues={"north": 0, "south": 0, "east": 0, "west": 0},
        bounds=TimingBounds(),
        mode="adaptive",
        scenario_id="uneven",
        seed=42,
    )


def test_waiting_time_metrics_from_events():
    engine = _template()
    engine.step(90)
    metrics = engine_metrics(engine)
    assert metrics["dataProvenance"] == "simulated"
    assert metrics["vehiclesServed"] == len(engine.served_vehicles())
    if metrics["vehiclesServed"]:
        waits = [v.waiting_time for v in engine.served_vehicles() if v.waiting_time is not None]
        assert metrics["averageWaitingTimeSeconds"] == round(sum(waits) / len(waits), 3)
        assert metrics["maxWaitingTimeSeconds"] == max(waits)


def test_reproducible_fixed_versus_adaptive_comparison():
    template = _template()
    scenario = get_scenario("uneven")
    arrivals = generate_arrivals(180, template.base_rates, scenario, seed=99)
    a_fixed = clone_engine_with_arrivals(template, "fixed", arrivals, template.bounds)
    a_adapt = clone_engine_with_arrivals(template, "adaptive", arrivals, template.bounds)
    b_fixed = clone_engine_with_arrivals(template, "fixed", arrivals, template.bounds)
    b_adapt = clone_engine_with_arrivals(template, "adaptive", arrivals, template.bounds)
    a_fixed.step(180)
    a_adapt.step(180)
    b_fixed.step(180)
    b_adapt.step(180)
    first = compare_metrics(engine_metrics(a_fixed), engine_metrics(a_adapt))
    second = compare_metrics(engine_metrics(b_fixed), engine_metrics(b_adapt))
    assert first["identicalArrivals"] is True
    assert first["summary"] == second["summary"]
    assert a_fixed.served_vehicles()[0].arrival_time == b_fixed.served_vehicles()[0].arrival_time


def test_csv_export(client, simulation):
    simulation.step(40)
    response = client.get("/api/metrics/export")
    assert response.status_code == 200
    assert "text/csv" in response.content_type
    body = response.data.decode("utf-8")
    assert "simTimeSeconds" in body
    assert "averageWaitingTimeSeconds" in body


def test_metrics_endpoints(client):
    client.post("/api/simulation/step", json={"seconds": 25})
    metrics = client.get("/api/metrics").get_json()
    assert metrics["simTimeSeconds"] >= 25
    history = client.get("/api/metrics/history").get_json()
    assert history["timestampFormat"]
    assert isinstance(history["points"], list)
