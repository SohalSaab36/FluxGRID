"""Rule-based fixed and adaptive signal controllers.

These are prototype algorithms for a hackathon simulation. They are not
reinforcement learning and are not recommendations for deployed signal timing.
Decisions are deterministic for identical input state.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence

from models.schemas import EW_APPROACHES, NS_APPROACHES, PHASE_EW, PHASE_NS


@dataclass(frozen=True)
class TimingBounds:
    min_green: int = 10
    max_green: int = 40
    yellow: int = 3
    fixed_green: int = 30


@dataclass(frozen=True)
class ApproachSnapshot:
    name: str
    queue_length: int
    arrival_rate: float
    waiting_time_sum: float
    vehicles_waiting: int
    seconds_since_green: int


@dataclass(frozen=True)
class ControllerDecision:
    phase: str
    green_seconds: int
    reason: str
    ns_demand: float
    ew_demand: float


def _clip_green(value: float, bounds: TimingBounds) -> int:
    return int(max(bounds.min_green, min(bounds.max_green, round(value))))


def weighted_demand(
    approaches: Iterable[ApproachSnapshot],
    queue_weight: float,
    wait_weight: float,
    arrival_weight: float,
    starvation_seconds: int,
) -> float:
    total = 0.0
    for approach in approaches:
        avg_wait = 0.0
        if approach.vehicles_waiting:
            avg_wait = approach.waiting_time_sum / approach.vehicles_waiting
        starvation_bonus = 0.0
        if approach.seconds_since_green >= starvation_seconds:
            starvation_bonus = 25.0 + (approach.seconds_since_green - starvation_seconds) * 0.5
        total += (
            queue_weight * approach.queue_length
            + wait_weight * avg_wait
            + arrival_weight * approach.arrival_rate * 3600.0 / 100.0
            + starvation_bonus
        )
    return total


def _sensitivity_weights(sensitivity: str) -> tuple[float, float, float]:
    if sensitivity == "conservative":
        return 1.0, 0.15, 0.2
    if sensitivity == "aggressive":
        return 2.2, 0.55, 0.45
    return 1.5, 0.35, 0.3


class FixedTimingController:
    """Predictable two-phase schedule: North-South then East-West."""

    name = "fixed"

    def __init__(self, bounds: TimingBounds) -> None:
        self.bounds = bounds
        self.green = _clip_green(bounds.fixed_green, bounds)

    def next_phase(self, current_phase: str) -> ControllerDecision:
        if current_phase == PHASE_NS:
            nxt = PHASE_EW
        else:
            nxt = PHASE_NS
        return ControllerDecision(
            phase=nxt,
            green_seconds=self.green,
            reason=(
                f"{nxt} selected on the fixed two-phase schedule "
                f"({self.green}s green, {self.bounds.yellow}s yellow clearance)."
            ),
            ns_demand=0.0,
            ew_demand=0.0,
        )

    def planned_green(self, phase: str, approaches: Sequence[ApproachSnapshot]) -> ControllerDecision:
        del approaches
        return ControllerDecision(
            phase=phase,
            green_seconds=self.green,
            reason=f"Fixed timing allocates {self.green}s green to {phase}.",
            ns_demand=0.0,
            ew_demand=0.0,
        )

    def should_end_green(
        self,
        elapsed: int,
        allocated: int,
        serving_queue: int,
        opposing_starved: bool = False,
    ) -> bool:
        del serving_queue, opposing_starved
        return elapsed >= allocated


class AdaptiveController:
    """Explainable demand-based split with min/max green and starvation prevention."""

    name = "adaptive"

    def __init__(
        self,
        bounds: TimingBounds,
        starvation_seconds: int = 60,
        sensitivity: str = "balanced",
    ) -> None:
        self.bounds = bounds
        self.starvation_seconds = starvation_seconds
        self.sensitivity = sensitivity

    def _phase_demands(
        self, approaches: Sequence[ApproachSnapshot]
    ) -> tuple[float, float, dict[str, ApproachSnapshot]]:
        by_name = {a.name: a for a in approaches}
        q_w, w_w, a_w = _sensitivity_weights(self.sensitivity)
        ns = weighted_demand(
            [by_name[n] for n in NS_APPROACHES if n in by_name],
            q_w,
            w_w,
            a_w,
            self.starvation_seconds,
        )
        ew = weighted_demand(
            [by_name[n] for n in EW_APPROACHES if n in by_name],
            q_w,
            w_w,
            a_w,
            self.starvation_seconds,
        )
        return ns, ew, by_name

    def _starved_phase(self, by_name: dict[str, ApproachSnapshot]) -> str | None:
        ns_starved = max(by_name[n].seconds_since_green for n in NS_APPROACHES if n in by_name)
        ew_starved = max(by_name[n].seconds_since_green for n in EW_APPROACHES if n in by_name)
        if ns_starved >= self.starvation_seconds and ns_starved >= ew_starved:
            return PHASE_NS
        if ew_starved >= self.starvation_seconds:
            return PHASE_EW
        return None

    def planned_green(
        self, phase: str, approaches: Sequence[ApproachSnapshot]
    ) -> ControllerDecision:
        ns, ew, by_name = self._phase_demands(approaches)
        budget = self.bounds.max_green  # allocate within max green for the served phase
        total = max(1e-6, ns + ew)
        if phase == PHASE_NS:
            raw = budget * (ns / total)
            served_label = "North–South"
            demand = ns
            other = ew
        else:
            raw = budget * (ew / total)
            served_label = "East–West"
            demand = ew
            other = ns
        green = _clip_green(raw, self.bounds)
        starved = self._starved_phase(by_name)
        reason = (
            f"{served_label} selected because its weighted demand ({demand:.1f}) "
            f"is {'higher' if demand >= other else 'lower'} than the opposing movement "
            f"({other:.1f}) and green is clipped to [{self.bounds.min_green}, {self.bounds.max_green}] s."
        )
        if starved == phase:
            reason = (
                f"{served_label} selected because its waiting time has exceeded the "
                f"{self.starvation_seconds}s priority / starvation threshold "
                f"(weighted demand {demand:.1f} vs {other:.1f})."
            )
        return ControllerDecision(
            phase=phase,
            green_seconds=green,
            reason=reason,
            ns_demand=ns,
            ew_demand=ew,
        )

    def next_phase(self, current_phase: str, approaches: Sequence[ApproachSnapshot]) -> ControllerDecision:
        # Two-phase safety: always alternate after yellow so conflicting
        # movements never skip indefinitely. Demand only changes green length.
        chosen = PHASE_EW if current_phase == PHASE_NS else PHASE_NS
        return self.planned_green(chosen, approaches)

    def should_end_green(
        self,
        elapsed: int,
        allocated: int,
        serving_queue: int,
        opposing_starved: bool = False,
    ) -> bool:
        if elapsed >= self.bounds.max_green:
            return True
        if elapsed < self.bounds.min_green:
            return False
        if opposing_starved:
            return True
        if serving_queue <= 0:
            return True
        return elapsed >= allocated
