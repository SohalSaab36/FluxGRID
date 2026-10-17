"""Persistent community traffic reports for the demonstration network."""

from __future__ import annotations

import math
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from models.schemas import ValidationError
from services.demo_intersections import DEMO_INTERSECTIONS


class TrafficReportStore:
    def __init__(
        self,
        database_path: str,
        ttl_seconds: int = 4 * 60 * 60,
        max_distance_km: float = 5.0,
    ) -> None:
        self.ttl_seconds = ttl_seconds
        self.max_distance_km = max_distance_km
        self._lock = threading.RLock()
        if database_path != ":memory:":
            Path(database_path).parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(
            database_path,
            timeout=10,
            check_same_thread=False,
        )
        self._connection.row_factory = sqlite3.Row
        self._connection.execute("PRAGMA busy_timeout = 10000")
        if database_path != ":memory:":
            self._connection.execute("PRAGMA journal_mode = WAL")
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS traffic_reports (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                description TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                intersection_id TEXT NOT NULL,
                intersection_name TEXT NOT NULL,
                intersection_code TEXT NOT NULL,
                distance_km REAL NOT NULL,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                approval_status TEXT NOT NULL DEFAULT 'approved',
                submitted_by INTEGER
            )
            """
        )
        columns = {
            row["name"]
            for row in self._connection.execute("PRAGMA table_info(traffic_reports)").fetchall()
        }
        if "approval_status" not in columns:
            self._connection.execute(
                "ALTER TABLE traffic_reports ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'"
            )
            self._connection.execute(
                "UPDATE traffic_reports SET approval_status = 'pending' WHERE type = 'accident'"
            )
        if "submitted_by" not in columns:
            self._connection.execute("ALTER TABLE traffic_reports ADD COLUMN submitted_by INTEGER")
        self._connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_traffic_reports_expiry "
            "ON traffic_reports(expires_at)"
        )
        self._connection.commit()

    def create(
        self,
        report: dict[str, Any],
        submitted_by: int | None = None,
        now: int | None = None,
    ) -> dict[str, Any]:
        created_at = int(time.time()) if now is None else now
        nearest, distance_km = min(
            (
                (intersection, self._distance_km(
                    report["latitude"],
                    report["longitude"],
                    intersection["coordinates"][1],
                    intersection["coordinates"][0],
                ))
                for intersection in DEMO_INTERSECTIONS
            ),
            key=lambda item: item[1],
        )
        if distance_km > self.max_distance_km:
            raise ValidationError(
                "Your location is outside the supported traffic network "
                f"({self.max_distance_km:g} km radius)."
            )

        report_id = str(uuid.uuid4())
        expires_at = created_at + self.ttl_seconds
        approval_status = "pending" if report["type"] == "accident" else "approved"
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO traffic_reports (
                    id, type, description, latitude, longitude,
                    intersection_id, intersection_name, intersection_code,
                    distance_km, created_at, expires_at, approval_status, submitted_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    report_id,
                    report["type"],
                    report["description"],
                    report["latitude"],
                    report["longitude"],
                    nearest["id"],
                    nearest["name"],
                    nearest["code"],
                    distance_km,
                    created_at,
                    expires_at,
                    approval_status,
                    submitted_by,
                ),
            )
            self._connection.commit()
        return self._serialize(
            {
                **report,
                "id": report_id,
                "intersectionId": nearest["id"],
                "intersectionName": nearest["name"],
                "intersectionCode": nearest["code"],
                "distanceKm": round(distance_km, 3),
                "createdAt": created_at,
                "expiresAt": expires_at,
                "approval_status": approval_status,
                "submitted_by": submitted_by,
            }
        )

    def active(self, now: int | None = None) -> list[dict[str, Any]]:
        current_time = int(time.time()) if now is None else now
        with self._lock:
            self._connection.execute(
                "DELETE FROM traffic_reports WHERE expires_at <= ?",
                (current_time,),
            )
            rows = self._connection.execute(
                "SELECT * FROM traffic_reports WHERE expires_at > ? "
                "AND approval_status != 'rejected' "
                "ORDER BY created_at DESC, id",
                (current_time,),
            ).fetchall()
            self._connection.commit()
        return [self._serialize(dict(row)) for row in rows]

    def pending_accidents(self, now: int | None = None) -> list[dict[str, Any]]:
        current_time = int(time.time()) if now is None else now
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT * FROM traffic_reports
                WHERE type = 'accident' AND approval_status = 'pending' AND expires_at > ?
                ORDER BY created_at ASC, id
                """,
                (current_time,),
            ).fetchall()
        return [self._serialize(dict(row)) for row in rows]

    def decide_accident(
        self,
        report_id: str,
        approval_status: str,
        now: int | None = None,
    ) -> dict[str, Any]:
        current_time = int(time.time()) if now is None else now
        with self._lock:
            cursor = self._connection.execute(
                """
                UPDATE traffic_reports SET approval_status = ?
                WHERE id = ? AND type = 'accident' AND approval_status = 'pending'
                AND expires_at > ?
                """,
                (approval_status, report_id, current_time),
            )
            if cursor.rowcount != 1:
                self._connection.rollback()
                raise KeyError(report_id)
            row = self._connection.execute(
                "SELECT * FROM traffic_reports WHERE id = ?",
                (report_id,),
            ).fetchone()
            self._connection.commit()
        return self._serialize(dict(row))

    @staticmethod
    def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        earth_radius_km = 6371.0088
        lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        haversine = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1_rad)
            * math.cos(lat2_rad)
            * math.sin(delta_lon / 2) ** 2
        )
        return earth_radius_km * 2 * math.asin(math.sqrt(haversine))

    @staticmethod
    def _serialize(row: dict[str, Any]) -> dict[str, Any]:
        def as_utc(value: int) -> str:
            return datetime.fromtimestamp(value, timezone.utc).isoformat().replace("+00:00", "Z")

        approval_status = row.get("approval_status", "approved")
        return {
            "id": row["id"],
            "type": row["type"],
            "description": row["description"],
            "coordinates": [row["longitude"], row["latitude"]],
            "intersectionId": row["intersection_id"] if "intersection_id" in row else row["intersectionId"],
            "intersectionName": row["intersection_name"] if "intersection_name" in row else row["intersectionName"],
            "intersectionCode": row["intersection_code"] if "intersection_code" in row else row["intersectionCode"],
            "distanceKm": round(row["distance_km"], 3) if "distance_km" in row else row["distanceKm"],
            "createdAt": as_utc(row["created_at"] if "created_at" in row else row["createdAt"]),
            "expiresAt": as_utc(row["expires_at"] if "expires_at" in row else row["expiresAt"]),
            "approvalStatus": approval_status,
            "verified": False,
            "submittedBy": row.get("submitted_by"),
        }

    def close(self) -> None:
        with self._lock:
            self._connection.close()
