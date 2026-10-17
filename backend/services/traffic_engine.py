"""Independent four-approach intersection simulation.

Assumptions (prototype, not a calibrated traffic model):
- Discrete 1-second ticks.
- Arrivals are Poisson per approach using a seeded NumPy Generator.
- A vehicle is served (departs) according to saturation flow while its
  approach has green or yellow. Default: 0.5 veh/s on green, 0.2 veh/s on yellow.
- Waiting time is departure_time - arrival_time (seconds in queue including
  the second of service).
- Two-phase operation: North–South green, yellow clearance, East–West green,
  yellow clearance. Conflicting movements never receive green together.
- All measurements are simulated.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

import numpy as np

from models.schemas import (
    APPROACHES,
    EW_APPROACHES,
    NS_APPROACHES,
    PHASE_CLEARANCE,
    PHASE_EW,
    PHASE_NS,
)
from services.scenario_service import ScenarioDefinition, arrival_rate_at, get_scenario
from services.traffic_controller import (
    AdaptiveController,
    ApproachSnapshot,
    ControllerDecision,
    FixedTimingController,
    TimingBounds,
)


SignalColor = Literal["green", "amber", "red"]


@dataclass
class Vehicle:
    vehicle_id: int
    approach: str
    arrival_time: int
    departure_time: int | None = None

    @property
    def waiting_time(self) -> int | None:
        if self.departure_time is None:
            return None
        return max(0, self.departure_time - self.arrival_time)


@dataclass
class ApproachState:
    name: str
    base_arrival_rate: float
    queue: list[Vehicle] = field(default_factory=list)
    served: list[Vehicle] = field(default_factory=list)
    max_queue: int = 0
    waiting_time_accum: float = 0.0
    seconds_since_green: int = 0
    current_signal: SignalColor = "red"
    green_allocated: int = 30
    discharge_credit: float = 0.0

    @property
    def queue_length(self) -> int:
        return len(self.queue)

    def live_waiting_sum(self, now: int) -> float:
        return float(sum(max(0, now - v.arrival_time) for v in self.queue))


@dataclass(frozen=True)
class ArrivalEvent:
    time: int
    approach: str


def generate_arrivals(
    duration: int,
    base_rates: dict[str, float],
    scenario: ScenarioDefinition,
    seed: int,
) -> list[ArrivalEvent]:
    """Pre-generate a reproducible arrival sequence for comparison runs."""
    rng = np.random.default_rng(seed)
    events: list[ArrivalEvent] = []
    for t in range(duration):
        for approach in APPROACHES:
            lam = arrival_rate_at(base_rates[approach], scenario, approach, t)
            count = int(rng.poisson(lam))
            for _ in range(count):
                events.append(ArrivalEvent(time=t, approach=approach))
    events.sort(key=lambda e: (e.time, e.approach))
    return events


class IntersectionEngine:
    def __init__(
        self,
        intersection_id: str,
        meta: dict,
        base_rates: dict[str, float],
        initial_queues: dict[str, int],
        bounds: TimingBounds,
        mode: str = "adaptive",
        scenario_id: str = "pm-peak",
        seed: int = 42,
        starvation_seconds: int = 60,
        green_service_rate: float = 0.5,
        yellow_service_rate: float = 0.2,
        sensitivity: str = "balanced",
        arrival_schedule: list[ArrivalEvent] | None = None,
        start_phase: str = PHASE_NS,
        start_remaining: int | None = None,
        cycle_length: int = 66,
    ) -> None:
        self.intersection_id = intersection_id
        self.meta = meta
        self.base_rates = dict(base_rates)
        self.bounds = bounds
        self.mode = mode
        self.scenario_id = scenario_id
        self.seed = seed
        self.starvation_seconds = starvation_seconds
        self.green_service_rate = green_service_rate
        self.yellow_service_rate = yellow_service_rate
        self.sensitivity = sensitivity
        self.cycle_length = cycle_length
        self.time = 0
        self.next_vehicle_id = 1
        self.phase = start_phase
        self.phase_elapsed = 0
        self.last_reason = "Simulation initialized on the documented two-phase prototype."
        self.phase_history: list[dict] = []
        self._external_arrivals = arrival_schedule
        self._arrival_index = 0
        self.rng = np.random.default_rng(seed)
        self.approaches = {
            name: ApproachState(
                name=name,
                base_arrival_rate=base_rates[name],
                current_signal="green" if name in NS_APPROACHES and start_phase == PHASE_NS else (
                    "green" if name in EW_APPROACHES and start_phase == PHASE_EW else "red"
                ),
            )
            for name in APPROACHES
        }
        self._seed_initial_queues(initial_queues)
        self._rebuild_controllers()
        allocated = (
            self.adaptive.planned_green(self.phase, self.snapshots()).green_seconds
            if self.mode == "adaptive"
            else self.fixed.green
        )
        self.phase_remaining = start_remaining if start_remaining is not None else allocated
        self.allocated_green = allocated
        self._clearance_from = NS_APPROACHES if start_phase != PHASE_EW else EW_APPROACHES
        self._apply_signals()
        self._record_phase(self.phase, allocated, self.last_reason)

    def _rebuild_controllers(self) -> None:
        self.fixed = FixedTimingController(self.bounds)
        self.adaptive = AdaptiveController(
            self.bounds, self.starvation_seconds, self.sensitivity
        )

    def _seed_initial_queues(self, initial_queues: dict[str, int]) -> None:
        for name, count in initial_queues.items():
            for _ in range(max(0, count)):
                self.approaches[name].queue.append(
                    Vehicle(self.next_vehicle_id, name, arrival_time=0)
                )
                self.next_vehicle_id += 1
            self.approaches[name].max_queue = self.approaches[name].queue_length

    def snapshots(self) -> list[ApproachSnapshot]:
        snaps = []
        for name in APPROACHES:
            ap = self.approaches[name]
            snaps.append(
                ApproachSnapshot(
                    name=name,
                    queue_length=ap.queue_length,
                    arrival_rate=arrival_rate_at(
                        ap.base_arrival_rate,
                        get_scenario(self.scenario_id),
                        name,
                        self.time,
                    ),
                    waiting_time_sum=ap.live_waiting_sum(self.time),
                    vehicles_waiting=ap.queue_length,
                    seconds_since_green=ap.seconds_since_green,
                )
            )
        return snaps

    def set_mode(self, mode: str) -> None:
        self.mode = mode

    def set_scenario(self, scenario_id: str) -> None:
        self.scenario_id = scenario_id

    def update_bounds(self, bounds: TimingBounds, sensitivity: str | None = None) -> None:
        self.bounds = bounds
        if sensitivity:
            self.sensitivity = sensitivity
        self._rebuild_controllers()

    def _serving_approaches(self) -> tuple[str, ...]:
        if self.phase == PHASE_NS:
            return NS_APPROACHES
        if self.phase == PHASE_EW:
            return EW_APPROACHES
        # Clearance: amber on the approaches that were green.
        amber = tuple(n for n, ap in self.approaches.items() if ap.current_signal == "amber")
        return amber if amber else NS_APPROACHES

    def _apply_signals(self) -> None:
        for name, ap in self.approaches.items():
            if self.phase == PHASE_NS:
                ap.current_signal = "green" if name in NS_APPROACHES else "red"
            elif self.phase == PHASE_EW:
                ap.current_signal = "green" if name in EW_APPROACHES else "red"
            else:
                if name in self._clearance_from:
                    ap.current_signal = "amber"
                else:
                    ap.current_signal = "red"
            if ap.current_signal == "green":
                ap.green_allocated = self.allocated_green

    def _record_phase(self, phase: str, green: int, reason: str) -> None:
        self.phase_history.append(
            {
                "simTimeSeconds": self.time,
                "phase": phase,
                "allocatedGreenSeconds": green,
                "mode": self.mode,
                "reason": reason,
            }
        )
        self.last_reason = reason

    def _spawn_arrivals(self) -> None:
        if self._external_arrivals is not None:
            while (
                self._arrival_index < len(self._external_arrivals)
                and self._external_arrivals[self._arrival_index].time == self.time
            ):
                event = self._external_arrivals[self._arrival_index]
                self._push_vehicle(event.approach)
                self._arrival_index += 1
            return
        scenario = get_scenario(self.scenario_id)
        for name, ap in self.approaches.items():
            lam = arrival_rate_at(ap.base_arrival_rate, scenario, name, self.time)
            count = int(self.rng.poisson(lam))
            for _ in range(count):
                self._push_vehicle(name)

    def _push_vehicle(self, approach: str) -> None:
        vehicle = Vehicle(self.next_vehicle_id, approach, arrival_time=self.time)
        self.next_vehicle_id += 1
        ap = self.approaches[approach]
        ap.queue.append(vehicle)
        ap.max_queue = max(ap.max_queue, ap.queue_length)

    def _discharge(self) -> None:
        for name, ap in self.approaches.items():
            if ap.current_signal == "green":
                ap.discharge_credit += self.green_service_rate
            elif ap.current_signal == "amber":
                ap.discharge_credit += self.yellow_service_rate
            else:
                ap.discharge_credit = 0.0
            while ap.discharge_credit >= 1.0 and ap.queue:
                ap.discharge_credit -= 1.0
                vehicle = ap.queue.pop(0)
                vehicle.departure_time = self.time + 1
                wait = vehicle.waiting_time or 0
                ap.waiting_time_accum += wait
                ap.served.append(vehicle)

    def _tick_starvation_clocks(self) -> None:
        serving = set()
        if self.phase == PHASE_NS:
            serving = set(NS_APPROACHES)
        elif self.phase == PHASE_EW:
            serving = set(EW_APPROACHES)
        for name, ap in self.approaches.items():
            if name in serving and ap.current_signal == "green":
                ap.seconds_since_green = 0
            else:
                ap.seconds_since_green += 1

    def _transition_if_needed(self) -> None:
        serving_queue = sum(self.approaches[n].queue_length for n in self._serving_approaches())
        controller: FixedTimingController | AdaptiveController
        if self.mode == "adaptive":
            controller = self.adaptive
        else:
            controller = self.fixed

        if self.phase in {PHASE_NS, PHASE_EW}:
            opposing = EW_APPROACHES if self.phase == PHASE_NS else NS_APPROACHES
            opposing_starved = any(
                self.approaches[n].seconds_since_green >= self.starvation_seconds
                for n in opposing
            )
            end = controller.should_end_green(
                self.phase_elapsed,
                self.allocated_green,
                serving_queue,
                opposing_starved=opposing_starved,
            )
            if not end:
                return
            self._clearance_from = tuple(self._serving_approaches())
            self.phase = PHASE_CLEARANCE
            self.phase_elapsed = 0
            self.phase_remaining = self.bounds.yellow
            self._apply_signals()
            self._record_phase(
                PHASE_CLEARANCE,
                self.bounds.yellow,
                f"{self.bounds.yellow}s simulated yellow clearance after {self._clearance_from[0].title()} corridor.",
            )
            return

        # End of clearance → next green
        if self.mode == "adaptive":
            decision: ControllerDecision = self.adaptive.next_phase(
                PHASE_NS if self._clearance_from[0] in NS_APPROACHES else PHASE_EW,
                self.snapshots(),
            )
        else:
            previous = PHASE_NS if self._clearance_from[0] in NS_APPROACHES else PHASE_EW
            decision = self.fixed.next_phase(previous)
        self.phase = decision.phase
        self.allocated_green = decision.green_seconds
        self.phase_elapsed = 0
        self.phase_remaining = decision.green_seconds
        self._apply_signals()
        self._record_phase(self.phase, decision.green_seconds, decision.reason)

    def step(self, seconds: int = 1) -> None:
        for _ in range(seconds):
            if not hasattr(self, "_clearance_from"):
                self._clearance_from = NS_APPROACHES if self.phase != PHASE_EW else EW_APPROACHES
            self._spawn_arrivals()
            self._discharge()
            self._tick_starvation_clocks()
            self.phase_elapsed += 1
            self.phase_remaining = max(0, self.phase_remaining - 1)
            self._transition_if_needed()
            self.time += 1

    def served_vehicles(self) -> list[Vehicle]:
        out: list[Vehicle] = []
        for ap in self.approaches.values():
            out.extend(ap.served)
        return out

    def queued_vehicles(self) -> list[Vehicle]:
        out: list[Vehicle] = []
        for ap in self.approaches.values():
            out.extend(ap.queue)
        return out

    def congestion_level(self) -> str:
        total = sum(ap.queue_length for ap in self.approaches.values())
        if total > 20:
            return "heavy"
        if total >= 10:
            return "moderate"
        return "clear"

    def to_frontend_intersection(self) -> dict:
        ns = self.approaches["north"]
        ew = self.approaches["east"]
        ns_fixed = self.fixed.green
        ew_fixed = self.fixed.green
        if self.mode == "adaptive":
            ns_ai = self.adaptive.planned_green(PHASE_NS, self.snapshots()).green_seconds
            ew_ai = self.adaptive.planned_green(PHASE_EW, self.snapshots()).green_seconds
            action = self.last_reason.split(" because ")[0] if " because " in self.last_reason else self.last_reason
        else:
            ns_ai = ns_fixed
            ew_ai = ew_fixed
            action = "Fixed two-phase schedule"
        safety = (
            self.bounds.min_green <= ns_ai <= self.bounds.max_green
            and self.bounds.min_green <= ew_ai <= self.bounds.max_green
            and self.bounds.yellow >= 3
        )
        total_queue = sum(ap.queue_length for ap in self.approaches.values())
        served = sum(len(ap.served) for ap in self.approaches.values())
        approaches_payload = {}
        for name in APPROACHES:
            ap = self.approaches[name]
            avg_wait = 0.0
            if ap.queue:
                avg_wait = ap.live_waiting_sum(self.time) / ap.queue_length
            elif ap.served:
                avg_wait = ap.waiting_time_accum / len(ap.served)
            approaches_payload[name] = {
                "direction": name.title(),
                "vehiclesInQueue": ap.queue_length,
                "flowRateVehPerHour": round(ap.base_arrival_rate * 3600, 1),
                "averageWaitSeconds": round(avg_wait, 1),
                "currentSignal": ap.current_signal,
                "greenAllocatedSeconds": ap.green_allocated,
            }
        phases = [
            {
                "id": "p1",
                "name": PHASE_NS,
                "fixedDuration": ns_fixed,
                "aiDuration": ns_ai,
                "changeSeconds": ns_ai - ns_fixed,
                "active": self.phase == PHASE_NS,
                "type": "ns-green",
            },
            {
                "id": "p2",
                "name": PHASE_EW,
                "fixedDuration": ew_fixed,
                "aiDuration": ew_ai,
                "changeSeconds": ew_ai - ew_fixed,
                "active": self.phase == PHASE_EW,
                "type": "ew-green",
            },
            {
                "id": "p3",
                "name": PHASE_CLEARANCE,
                "fixedDuration": self.bounds.yellow,
                "aiDuration": self.bounds.yellow,
                "changeSeconds": 0,
                "active": self.phase == PHASE_CLEARANCE,
                "type": "clearance",
            },
        ]
        return {
            "id": self.intersection_id,
            "code": self.meta["code"],
            "name": self.meta["name"],
            "district": self.meta["district"],
            "coordinates": self.meta["coordinates"],
            "congestion": self.congestion_level(),
            "totalVehicles": total_queue + served,
            "queueLength": total_queue,
            "currentPhase": self.phase,
            "phaseRemainingSeconds": max(0, self.phase_remaining),
            "cycleLengthSeconds": self.cycle_length,
            "aiRecommendation": action[:180],
            "aiRecommendationReason": self.last_reason,
            "safetyPassed": safety,
            "controllerMode": self.mode,
            "cameraId": self.meta["cameraId"],
            "approaches": approaches_payload,
            "phases": phases,
            "dataProvenance": "simulated",
            "demonstrationNote": (
                "Demonstration intersection near Delhi coordinates. "
                "Not live municipal traffic data."
            ),
        }


def clone_engine_with_arrivals(
    template: IntersectionEngine,
    mode: str,
    arrivals: list[ArrivalEvent],
    bounds: TimingBounds,
) -> IntersectionEngine:
    initial_queues = {name: 0 for name in APPROACHES}
    return IntersectionEngine(
        intersection_id=template.intersection_id,
        meta=template.meta,
        base_rates=template.base_rates,
        initial_queues=initial_queues,
        bounds=bounds,
        mode=mode,
        scenario_id=template.scenario_id,
        seed=template.seed,
        starvation_seconds=template.starvation_seconds,
        green_service_rate=template.green_service_rate,
        yellow_service_rate=template.yellow_service_rate,
        sensitivity=template.sensitivity,
        arrival_schedule=arrivals,
        start_phase=PHASE_NS,
        start_remaining=None,
        cycle_length=template.cycle_length,
    )
