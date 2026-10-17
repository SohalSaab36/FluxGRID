"""Metrics derived from simulation events. All values are simulated unless noted."""

from __future__ import annotations

from io import StringIO
import csv
from typing import Iterable

from services.traffic_engine import IntersectionEngine, Vehicle


def waiting_times(vehicles: Iterable[Vehicle]) -> list[int]:
    return [v.waiting_time for v in vehicles if v.waiting_time is not None]


def engine_metrics(engine: IntersectionEngine) -> dict:
    served = engine.served_vehicles()
    waits = waiting_times(served)
    queues = [ap.queue_length for ap in engine.approaches.values()]
    max_queue = max(ap.max_queue for ap in engine.approaches.values())
    duration = max(1, engine.time)
    avg_wait = sum(waits) / len(waits) if waits else 0.0
    max_wait = max(waits) if waits else 0
    # Time-average queue is approximated from current + historical max; the
    # live network service records a proper rolling sum.
    avg_queue = sum(queues) / 4.0
    throughput_per_minute = served and (len(served) / duration) * 60.0 or 0.0
    return {
        "dataProvenance": "simulated",
        "definitions": {
            "averageWaitingTimeSeconds": "Mean of (departure_time - arrival_time) for served vehicles.",
            "maxWaitingTimeSeconds": "Maximum individual served-vehicle waiting time.",
            "averageQueueSize": "Mean current queue length across the four approaches.",
            "maxQueueLength": "Maximum observed queue on any single approach.",
            "vehiclesServed": "Vehicles that departed the stop line.",
            "throughputPerSimulatedMinute": "vehiclesServed / simulated_seconds * 60.",
        },
        "simTimeSeconds": engine.time,
        "averageWaitingTimeSeconds": round(avg_wait, 3),
        "maxWaitingTimeSeconds": max_wait,
        "averageQueueSize": round(avg_queue, 3),
        "maxQueueLength": max_queue,
        "vehiclesServed": len(served),
        "vehiclesStillQueued": sum(queues),
        "throughputPerSimulatedMinute": round(throughput_per_minute, 3),
        "controllerMode": engine.mode,
        "phaseHistory": engine.phase_history[-40:],
        "approaches": {
            name: {
                "queueLength": ap.queue_length,
                "maxQueueLength": ap.max_queue,
                "vehiclesServed": len(ap.served),
                "waitingTimeAccumulatedSeconds": round(ap.waiting_time_accum, 3),
                "arrivalRateVehPerSecond": ap.base_arrival_rate,
            }
            for name, ap in engine.approaches.items()
        },
    }


def compare_metrics(fixed: dict, adaptive: dict) -> dict:
    fixed_wait = fixed["averageWaitingTimeSeconds"]
    adaptive_wait = adaptive["averageWaitingTimeSeconds"]
    pct = None
    if fixed_wait > 0:
        pct = round(((adaptive_wait - fixed_wait) / fixed_wait) * 100.0, 3)
    return {
        "dataProvenance": "simulated",
        "note": (
            "Both controllers used identical vehicle-arrival sequences and equivalent "
            "initial conditions. Percentage change is (adaptive - fixed) / fixed. "
            "Negative values mean lower average wait under adaptive control. "
            "Improvement is not guaranteed."
        ),
        "identicalArrivals": True,
        "totalSimulatedDurationSeconds": fixed["simTimeSeconds"],
        "fixed": fixed,
        "adaptive": adaptive,
        "averageWaitingTimePctChange": pct,
        "summary": {
            "fixedAverageWaitingTime": fixed_wait,
            "adaptiveAverageWaitingTime": adaptive_wait,
            "fixedMaxWaitingTime": fixed["maxWaitingTimeSeconds"],
            "adaptiveMaxWaitingTime": adaptive["maxWaitingTimeSeconds"],
            "fixedMaxQueueLength": fixed["maxQueueLength"],
            "adaptiveMaxQueueLength": adaptive["maxQueueLength"],
            "fixedAverageQueueSize": fixed["averageQueueSize"],
            "adaptiveAverageQueueSize": adaptive["averageQueueSize"],
            "fixedVehiclesServed": fixed["vehiclesServed"],
            "adaptiveVehiclesServed": adaptive["vehiclesServed"],
            "averageWaitingTimePctChange": pct,
        },
    }


def metrics_csv(rows: list[dict]) -> str:
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "# CityFlow AI simulated metrics export",
            "All values are from the in-memory simulation unless detection columns are present.",
        ]
    )
    writer.writerow(
        [
            "simTimeSeconds",
            "averageWaitingTimeSeconds",
            "maxWaitingTimeSeconds",
            "averageQueueSize",
            "maxQueueLength",
            "vehiclesServed",
            "throughputPerSimulatedMinute",
            "controllerMode",
            "networkCongestionPct",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                row.get("simTimeSeconds", ""),
                row.get("averageWaitingTimeSeconds", ""),
                row.get("maxWaitingTimeSeconds", ""),
                row.get("averageQueueSize", ""),
                row.get("maxQueueLength", ""),
                row.get("vehiclesServed", ""),
                row.get("throughputPerSimulatedMinute", ""),
                row.get("controllerMode", ""),
                row.get("networkCongestionPct", ""),
            ]
        )
    return buffer.getvalue()
