from models.schemas import PHASE_EW, PHASE_NS
from services.scenario_service import get_scenario
from services.traffic_controller import TimingBounds
from services.traffic_engine import IntersectionEngine, generate_arrivals


BOUNDS = TimingBounds(min_green=10, max_green=40, yellow=3, fixed_green=20)


def _engine(mode: str = "fixed", **kwargs) -> IntersectionEngine:
    rates = {"north": 0.4, "south": 0.35, "east": 0.12, "west": 0.1}
    queues = {"north": 3, "south": 2, "east": 2, "west": 1}
    return IntersectionEngine(
        intersection_id="int-test",
        meta={
            "code": "T01",
            "name": "Test",
            "district": "Demo",
            "coordinates": [77.1, 28.7],
            "cameraId": "CAM T",
        },
        base_rates=rates,
        initial_queues=queues,
        bounds=BOUNDS,
        mode=mode,
        scenario_id="balanced",
        seed=7,
        **kwargs,
    )


def test_fixed_controller_phase_sequence():
    engine = _engine("fixed", start_phase=PHASE_NS, start_remaining=20)
    observed = [engine.phase]
    for _ in range(80):
        engine.step(1)
        if not observed or observed[-1] != engine.phase:
            observed.append(engine.phase)
    assert PHASE_NS in observed
    assert PHASE_EW in observed
    assert "Clearance interval" in observed
    greens = {
        name
        for name, ap in engine.approaches.items()
        if ap.current_signal == "green"
    }
    if engine.phase == PHASE_NS:
        assert greens <= {"north", "south"}
        assert "east" not in greens
    if engine.phase == PHASE_EW:
        assert greens <= {"east", "west"}
        assert "north" not in greens


def test_no_conflicting_greens():
    engine = _engine("adaptive")
    for _ in range(120):
        engine.step(1)
        ns_green = any(engine.approaches[n].current_signal == "green" for n in ("north", "south"))
        ew_green = any(engine.approaches[n].current_signal == "green" for n in ("east", "west"))
        assert not (ns_green and ew_green)


def test_queue_updates_and_waiting_times():
    arrivals = generate_arrivals(
        80,
        {"north": 0.5, "south": 0.4, "east": 0.2, "west": 0.2},
        get_scenario("balanced"),
        seed=3,
    )
    engine = _engine("fixed", arrival_schedule=arrivals, start_remaining=20)
    engine.step(80)
    served = engine.served_vehicles()
    assert len(served) > 0
    for vehicle in served:
        assert vehicle.waiting_time is not None
        assert vehicle.waiting_time >= 0
        assert vehicle.departure_time >= vehicle.arrival_time
    assert all(ap.max_queue >= ap.queue_length for ap in engine.approaches.values())


def test_adaptive_respects_max_green_in_engine():
    engine = _engine("adaptive", start_phase=PHASE_NS, start_remaining=40)
    longest = 0
    current_run = 0
    last = engine.phase
    for _ in range(200):
        engine.step(1)
        if engine.phase == last and engine.phase in {PHASE_NS, PHASE_EW}:
            current_run += 1
            longest = max(longest, current_run)
        else:
            current_run = 1
            last = engine.phase
    assert longest <= BOUNDS.max_green + 1
