"""In-memory network simulation used by Flask routes."""

from __future__ import annotations

import copy
import threading
import time
from typing import Any

from config import Config
from models.schemas import (
    APPROACHES,
    PHASE_EW,
    PHASE_NS,
    parse_simulation_settings,
)
from services.demo_intersections import DEMO_INTERSECTIONS
from services.metrics_service import compare_metrics, engine_metrics, metrics_csv
from services.scenario_service import (
    frontend_scenario_catalog,
    get_scenario,
    scenario_to_frontend,
)
from services.traffic_controller import TimingBounds
from services.traffic_engine import (
    IntersectionEngine,
    clone_engine_with_arrivals,
    generate_arrivals,
)


class SimulationService:
    def __init__(self, config: type[Config] | Config = Config) -> None:
        self.config = config
        self.lock = threading.RLock()
        self.running = False
        self.speed = 1.0
        self.scenario_id = "pm-peak"
        self.sensitivity = "balanced"
        self.history: list[dict] = []
        self.queue_integral = 0.0
        self.compare_cache: dict | None = None
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._reset_unlocked()

    def _bounds(self) -> TimingBounds:
        return TimingBounds(
            min_green=self.min_green,
            max_green=self.max_green,
            yellow=self.yellow,
            fixed_green=self.fixed_green,
        )

    def _build_engines(self) -> dict[str, IntersectionEngine]:
        engines = {}
        bounds = self._bounds()
        for item in DEMO_INTERSECTIONS:
            rates = {k: v / 3600.0 for k, v in item["ratesPerHour"].items()}
            engines[item["id"]] = IntersectionEngine(
                intersection_id=item["id"],
                meta={
                    "code": item["code"],
                    "name": item["name"],
                    "district": item["district"],
                    "coordinates": item["coordinates"],
                    "cameraId": item["cameraId"],
                },
                base_rates=rates,
                initial_queues=item["initialQueues"],
                bounds=bounds,
                mode=item.get("mode", "adaptive"),
                scenario_id=self.scenario_id,
                seed=self.config.ARRIVAL_SEED + int(item["id"].split("-")[-1]),
                starvation_seconds=self.config.STARVATION_SECONDS,
                green_service_rate=self.config.GREEN_SERVICE_RATE,
                yellow_service_rate=self.config.YELLOW_SERVICE_RATE,
                sensitivity=self.sensitivity,
                start_phase=item["startPhase"],
                start_remaining=item["startRemaining"],
                cycle_length=item["cycleLengthSeconds"],
            )
        return engines

    def _reset_unlocked(self) -> None:
        self.min_green = self.config.MIN_GREEN_SECONDS
        self.max_green = self.config.MAX_GREEN_SECONDS
        self.yellow = self.config.YELLOW_SECONDS
        self.fixed_green = self.config.FIXED_GREEN_SECONDS
        self.running = False
        self.speed = 1.0
        self.scenario_id = "pm-peak"
        self.sensitivity = "balanced"
        self.history = []
        self.queue_integral = 0.0
        self.compare_cache = None
        self.clock = 0
        self.engines = self._build_engines()
        self._record_history_unlocked()

    def reset(self) -> dict:
        with self.lock:
            was_running = self.running
            self.running = False
            self._reset_unlocked()
        if was_running:
            self.start()
        return self.state()

    def start(self) -> dict:
        with self.lock:
            self.running = True
            if self._thread is None or not self._thread.is_alive():
                self._stop_event.clear()
                self._thread = threading.Thread(target=self._loop, daemon=True)
                self._thread.start()
        return self.state()

    def pause(self) -> dict:
        with self.lock:
            self.running = False
        return self.state()

    def set_speed(self, speed: float) -> dict:
        with self.lock:
            self.speed = speed
        return self.state()

    def set_mode(self, mode: str, intersection_id: str | None = None) -> dict:
        with self.lock:
            if intersection_id:
                engine = self._require(intersection_id)
                engine.set_mode(mode)
            else:
                for engine in self.engines.values():
                    engine.set_mode(mode)
        return self.state()

    def set_scenario(self, scenario_id: str) -> dict:
        with self.lock:
            get_scenario(scenario_id)
            self.scenario_id = scenario_id
            for engine in self.engines.values():
                engine.set_scenario(scenario_id)
        return self.state()

    def update_settings(self, payload: dict[str, Any]) -> dict:
        with self.lock:
            parsed = parse_simulation_settings(
                payload,
                {
                    "minGreenSeconds": self.min_green,
                    "maxGreenSeconds": self.max_green,
                    "clearanceSeconds": self.yellow,
                    "aiSensitivity": self.sensitivity,
                },
            )
            self.min_green = parsed.get("minGreenSeconds", self.min_green)
            self.max_green = parsed.get("maxGreenSeconds", self.max_green)
            self.yellow = parsed.get("clearanceSeconds", self.yellow)
            self.sensitivity = parsed.get("aiSensitivity", self.sensitivity)
            bounds = self._bounds()
            for engine in self.engines.values():
                engine.update_bounds(bounds, self.sensitivity)
        return self.state()

    def step(self, seconds: int) -> dict:
        with self.lock:
            self._step_unlocked(seconds)
        return self.state()

    def _step_unlocked(self, seconds: int) -> None:
        for _ in range(seconds):
            for engine in self.engines.values():
                engine.step(1)
                self.queue_integral += sum(ap.queue_length for ap in engine.approaches.values())
            self.clock += 1
            if self.clock % self.config.HISTORY_INTERVAL_SECONDS == 0:
                self._record_history_unlocked()

    def _loop(self) -> None:
        while not self._stop_event.is_set():
            with self.lock:
                running = self.running
                speed = self.speed
            if running:
                with self.lock:
                    self._step_unlocked(1)
            delay = max(0.05, 1.0 / max(0.5, speed))
            self._stop_event.wait(delay)

    def _require(self, intersection_id: str) -> IntersectionEngine:
        if intersection_id not in self.engines:
            raise KeyError(intersection_id)
        return self.engines[intersection_id]

    def list_intersections(self) -> list[dict]:
        with self.lock:
            return [engine.to_frontend_intersection() for engine in self._ordered()]

    def get_intersection(self, intersection_id: str) -> dict:
        with self.lock:
            return self._require(intersection_id).to_frontend_intersection()

    def _ordered(self) -> list[IntersectionEngine]:
        order = [item["id"] for item in DEMO_INTERSECTIONS]
        return [self.engines[i] for i in order]

    def _record_history_unlocked(self) -> None:
        kpis = self._kpis_unlocked()
        primary = self.engines["int-04"]
        metrics = engine_metrics(primary)
        self.history.append(
            {
                "simTimeSeconds": self.clock,
                "time": self._clock_label(self.clock),
                "averageWaitingTimeSeconds": metrics["averageWaitingTimeSeconds"],
                "maxWaitingTimeSeconds": metrics["maxWaitingTimeSeconds"],
                "averageQueueSize": metrics["averageQueueSize"],
                "maxQueueLength": metrics["maxQueueLength"],
                "vehiclesServed": metrics["vehiclesServed"],
                "throughputPerSimulatedMinute": metrics["throughputPerSimulatedMinute"],
                "controllerMode": primary.mode,
                "networkCongestionPct": kpis["networkCongestionPct"],
                "fixedWait": kpis["fixedBaselineWaitSeconds"],
                "aiWait": kpis["averageWaitSeconds"],
                "throughput": kpis["throughputVehPerHour"],
                "co2Index": kpis["co2Index"],
            }
        )
        self.history = self.history[-240:]

    def _clock_label(self, seconds: int) -> str:
        hours = 17
        minutes = (seconds // 60) % 60
        return f"{hours:02d}:{minutes:02d}"

    def _kpis_unlocked(self) -> dict:
        intersections = [e.to_frontend_intersection() for e in self._ordered()]
        waits = []
        vehicles = 0
        clear = moderate = heavy = 0
        served = 0
        for engine in self.engines.values():
            served += len(engine.served_vehicles())
            payload = engine.to_frontend_intersection()
            vehicles += payload["totalVehicles"]
            if payload["congestion"] == "heavy":
                heavy += 1
            elif payload["congestion"] == "moderate":
                moderate += 1
            else:
                clear += 1
            for ap in payload["approaches"].values():
                if ap["vehiclesInQueue"]:
                    waits.append(ap["averageWaitSeconds"])
        avg_wait = round(sum(waits) / len(waits), 1) if waits else 0.0
        duration = max(1, self.clock)
        throughput = round((served / duration) * 3600) if served else 0
        baseline_fixed = 0.0
        throughput_delta = None
        if self.compare_cache:
            baseline_fixed = self.compare_cache["summary"]["fixedAverageWaitingTime"]
            pct = self.compare_cache["summary"]["averageWaitingTimePctChange"]
            if self.compare_cache["summary"]["fixedVehiclesServed"]:
                f = self.compare_cache["summary"]["fixedVehiclesServed"]
                a = self.compare_cache["summary"]["adaptiveVehiclesServed"]
                throughput_delta = round(((a - f) / f) * 100)
        else:
            pct = None
        congestion = min(95, round((sum(i["queueLength"] for i in intersections) / (len(intersections) * 28)) * 100))
        adaptive_online = sum(1 for i in intersections if i["controllerMode"] == "adaptive")
        co2_index = 100
        if baseline_fixed:
            co2_index = round(100 * (avg_wait / max(1.0, baseline_fixed)))
        co2_delta = None
        if baseline_fixed:
            co2_delta = round(((avg_wait - baseline_fixed) / baseline_fixed) * 100)
        return {
            "vehiclesInNetwork": vehicles,
            "vehiclesDeltaPct": 0,
            "cameraFeedCount": len(intersections),
            "networkCongestionPct": congestion,
            "clearCount": clear,
            "moderateCount": moderate,
            "heavyCount": heavy,
            "averageWaitSeconds": avg_wait,
            "adaptiveWaitDeltaPct": pct if pct is not None else 0,
            "fixedBaselineWaitSeconds": round(baseline_fixed, 1) if baseline_fixed else round(avg_wait, 1),
            "adaptiveSignalsOnline": adaptive_online,
            "totalSignals": len(intersections),
            "engineUptimePct": 100.0 if self.running or self.clock == 0 else 99.8,
            "throughputVehPerHour": throughput,
            "throughputDeltaPct": throughput_delta if throughput_delta is not None else 0,
            "co2EmissionsReductionPct": co2_delta if co2_delta is not None else 0,
            "co2Index": co2_index,
            "dataProvenance": "simulated",
        }

    def detection_proxy(self) -> dict:
        primary = self.engines["int-04"].to_frontend_intersection()
        qn = primary["approaches"]["north"]["vehiclesInQueue"]
        qs = primary["approaches"]["south"]["vehiclesInQueue"]
        qe = primary["approaches"]["east"]["vehiclesInQueue"]
        qw = primary["approaches"]["west"]["vehiclesInQueue"]
        return {
            "cars": qn + qs,
            "bikes": max(0, qe // 2),
            "buses": max(0, qw // 3),
            "trucks": max(0, qe // 4),
            "pedestrians": 0,
            "confidence": 0,
            "cameraId": primary["cameraId"],
            "intersectionName": primary["name"],
            "fps": 0,
            "latencyMs": 0,
            "dataProvenance": "simulated-queue-proxy",
            "note": (
                "These counts are derived from simulated queues for dashboard continuity. "
                "They are not YOLO detections. Use POST /api/detection/analyze for actual inference."
            ),
        }

    def state(self) -> dict:
        with self.lock:
            intersections = [e.to_frontend_intersection() for e in self._ordered()]
            kpis = self._kpis_unlocked()
            primary = self.engines["int-04"]
            scenario = get_scenario(self.scenario_id)
            return {
                "status": "running" if self.running else "paused",
                "application": self.config.APP_NAME,
                "controllerMode": primary.mode,
                "simulatedClockSeconds": self.clock,
                "simulationSpeed": self.speed,
                "scenario": scenario_to_frontend(scenario),
                "scenarios": frontend_scenario_catalog(),
                "intersections": intersections,
                "kpis": kpis,
                "detection": self.detection_proxy(),
                "performanceData": [
                    {
                        "time": row["time"],
                        "fixedWait": row["fixedWait"],
                        "aiWait": row["aiWait"],
                        "throughput": row["throughput"],
                        "co2Index": row["co2Index"],
                    }
                    for row in self.history
                ],
                "metrics": engine_metrics(primary),
                "settings": {
                    "minGreenSeconds": self.min_green,
                    "maxGreenSeconds": self.max_green,
                    "clearanceSeconds": self.yellow,
                    "aiSensitivity": self.sensitivity,
                },
                "dataProvenance": "simulated",
            }

    def metrics(self) -> dict:
        with self.lock:
            primary = self.engines["int-04"]
            payload = engine_metrics(primary)
            payload["network"] = self._kpis_unlocked()
            payload["historyPoints"] = len(self.history)
            return payload

    def metrics_history(self) -> dict:
        with self.lock:
            return {
                "dataProvenance": "simulated",
                "timestampFormat": "simTimeSeconds is the simulated clock; time is a display label (HH:MM from 17:00).",
                "points": copy.deepcopy(self.history),
            }

    def export_csv(self) -> str:
        with self.lock:
            rows = list(self.history)
            if not rows:
                primary = engine_metrics(self.engines["int-04"])
                rows = [primary]
            return metrics_csv(rows)

    def compare(self, duration: int | None = None, seed: int | None = None) -> dict:
        duration = duration or self.config.COMPARE_DURATION_SECONDS
        seed = self.config.ARRIVAL_SEED if seed is None else seed
        with self.lock:
            template = self.engines["int-04"]
            scenario = get_scenario(self.scenario_id)
            arrivals = generate_arrivals(duration, template.base_rates, scenario, seed)
            bounds = self._bounds()
            fixed_engine = clone_engine_with_arrivals(template, "fixed", arrivals, bounds)
            adaptive_engine = clone_engine_with_arrivals(template, "adaptive", arrivals, bounds)
            series = []
            for t in range(duration):
                fixed_engine.step(1)
                adaptive_engine.step(1)
                if (t + 1) % self.config.HISTORY_INTERVAL_SECONDS == 0:
                    fm = engine_metrics(fixed_engine)
                    am = engine_metrics(adaptive_engine)
                    series.append(
                        {
                            "time": self._clock_label(t + 1),
                            "simTimeSeconds": t + 1,
                            "fixedWait": fm["averageWaitingTimeSeconds"],
                            "aiWait": am["averageWaitingTimeSeconds"],
                            "throughput": round(am["throughputPerSimulatedMinute"] * 60),
                            "co2Index": (
                                round(100 * am["averageWaitingTimeSeconds"] / fm["averageWaitingTimeSeconds"])
                                if fm["averageWaitingTimeSeconds"]
                                else 100
                            ),
                        }
                    )
            result = compare_metrics(engine_metrics(fixed_engine), engine_metrics(adaptive_engine))
            result["performanceData"] = series
            result["arrivalEventCount"] = len(arrivals)
            result["seed"] = seed
            self.compare_cache = result
            self.history = [
                {
                    "simTimeSeconds": p["simTimeSeconds"],
                    "time": p["time"],
                    "averageWaitingTimeSeconds": p["aiWait"],
                    "maxWaitingTimeSeconds": result["adaptive"]["maxWaitingTimeSeconds"],
                    "averageQueueSize": result["adaptive"]["averageQueueSize"],
                    "maxQueueLength": result["adaptive"]["maxQueueLength"],
                    "vehiclesServed": result["adaptive"]["vehiclesServed"],
                    "throughputPerSimulatedMinute": result["adaptive"]["throughputPerSimulatedMinute"],
                    "controllerMode": "adaptive",
                    "networkCongestionPct": self._kpis_unlocked()["networkCongestionPct"],
                    "fixedWait": p["fixedWait"],
                    "aiWait": p["aiWait"],
                    "throughput": p["throughput"],
                    "co2Index": p["co2Index"],
                }
                for p in series
            ]
            return result
