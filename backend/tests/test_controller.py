from models.schemas import PHASE_EW, PHASE_NS
from services.traffic_controller import (
    AdaptiveController,
    ApproachSnapshot,
    FixedTimingController,
    TimingBounds,
)


BOUNDS = TimingBounds(min_green=10, max_green=40, yellow=3, fixed_green=30)


def _snap(name: str, queue: int, wait: float, starved: int = 0, rate: float = 0.1) -> ApproachSnapshot:
    return ApproachSnapshot(
        name=name,
        queue_length=queue,
        arrival_rate=rate,
        waiting_time_sum=wait * max(1, queue),
        vehicles_waiting=max(1, queue),
        seconds_since_green=starved,
    )


def test_fixed_phase_transitions_alternate():
    controller = FixedTimingController(BOUNDS)
    first = controller.next_phase(PHASE_NS)
    second = controller.next_phase(first.phase)
    assert first.phase == PHASE_EW
    assert second.phase == PHASE_NS
    assert first.green_seconds == 30
    assert controller.should_end_green(29, 30, 8) is False
    assert controller.should_end_green(30, 30, 8) is True


def test_adaptive_demand_prioritization():
    controller = AdaptiveController(BOUNDS, starvation_seconds=60)
    heavy_ns = [
        _snap("north", 20, 40),
        _snap("south", 18, 38),
        _snap("east", 1, 5),
        _snap("west", 1, 4),
    ]
    ns = controller.planned_green(PHASE_NS, heavy_ns)
    ew = controller.planned_green(PHASE_EW, heavy_ns)
    assert ns.green_seconds > ew.green_seconds
    assert ns.ns_demand > ns.ew_demand
    assert "North–South" in ns.reason


def test_maximum_green_limits():
    controller = AdaptiveController(BOUNDS, starvation_seconds=60)
    extreme = [
        _snap("north", 400, 90),
        _snap("south", 400, 90),
        _snap("east", 0, 0, rate=0.0),
        _snap("west", 0, 0, rate=0.0),
    ]
    ns = controller.planned_green(PHASE_NS, extreme)
    assert ns.green_seconds <= BOUNDS.max_green
    assert ns.green_seconds >= BOUNDS.min_green
    assert controller.should_end_green(BOUNDS.max_green, 10_000, 999) is True


def test_starvation_prevention_ends_green_at_min():
    controller = AdaptiveController(BOUNDS, starvation_seconds=60)
    assert controller.should_end_green(10, 40, 50, opposing_starved=True) is True
    assert controller.should_end_green(9, 40, 50, opposing_starved=True) is False
    starved = [
        _snap("north", 1, 2, starved=5),
        _snap("south", 1, 2, starved=5),
        _snap("east", 1, 80, starved=80),
        _snap("west", 1, 70, starved=80),
    ]
    decision = controller.planned_green(PHASE_EW, starved)
    assert "starvation" in decision.reason.lower() or "priority" in decision.reason.lower()


def test_decisions_are_deterministic():
    controller = AdaptiveController(BOUNDS)
    approaches = [
        _snap("north", 8, 20),
        _snap("south", 7, 18),
        _snap("east", 9, 22),
        _snap("west", 4, 11),
    ]
    a = controller.planned_green(PHASE_NS, approaches)
    b = controller.planned_green(PHASE_NS, approaches)
    assert a == b
