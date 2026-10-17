"""YOLO + OpenCV vehicle detection. Inference is optional.

The backend starts even when weights are missing. Health and status endpoints
must not download a model.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from config import Config
from models.schemas import COCO_VEHICLE_IDS, VEHICLE_CLASSES


class VehicleDetector:
    def __init__(self, config: type[Config] | Config = Config) -> None:
        self.config = config
        self._model = None
        self._load_error: str | None = None
        self._inference_status = "idle"
        self.enabled = True

    def model_path(self) -> Path:
        return Path(self.config.YOLO_MODEL_PATH)

    def weights_available(self) -> bool:
        path = self.model_path()
        return path.is_file() and path.stat().st_size > 0

    def yolo_importable(self) -> bool:
        try:
            import ultralytics  # noqa: F401
            import cv2  # noqa: F401
        except Exception:
            return False
        return True

    def model_loaded(self) -> bool:
        return self._model is not None

    def status(self) -> dict[str, Any]:
        available = self.weights_available()
        return {
            "enabled": self.enabled,
            "yoloAvailable": self.yolo_importable(),
            "weightsAvailable": available,
            "modelLoaded": self.model_loaded(),
            "inferenceStatus": self._inference_status,
            "device": self.config.YOLO_DEVICE,
            "modelPathConfigured": True,
            "loadError": self._load_error,
            "note": (
                "Weights are loaded lazily on analyze. Health and status never download models. "
                "Simulation does not depend on YOLO."
            ),
        }

    def _load_model(self) -> tuple[Any | None, str | None]:
        if self._model is not None:
            return self._model, None
        if not self.weights_available():
            self._load_error = (
                "YOLO weights were not found. Place a pretrained Ultralytics "
                ".pt file at the configured CITYFLOW_YOLO_MODEL_PATH. "
                "The server will not download weights automatically."
            )
            return None, self._load_error
        try:
            from ultralytics import YOLO
        except Exception as exc:  # pragma: no cover - environment dependent
            self._load_error = f"Ultralytics is not importable: {exc.__class__.__name__}"
            return None, self._load_error
        try:
            device = self.config.YOLO_DEVICE
            if device.startswith("cuda"):
                try:
                    import torch

                    if not torch.cuda.is_available():
                        device = "cpu"
                except Exception:
                    device = "cpu"
            model = YOLO(str(self.model_path()))
            self._model = model
            self._load_error = None
            self._device = device
            return model, None
        except Exception as exc:
            self._load_error = f"Failed to load YOLO weights: {exc.__class__.__name__}"
            return None, self._load_error

    def analyze_video(self, file_path: str, original_name: str) -> dict[str, Any]:
        started = time.perf_counter()
        self._inference_status = "running"
        try:
            import cv2
        except Exception as exc:
            self._inference_status = "error"
            return {
                "status": "unavailable",
                "error": f"OpenCV is not available ({exc.__class__.__name__}).",
                "modelLoaded": False,
                "inferenceStatus": "error",
            }

        capture = cv2.VideoCapture(file_path)
        if not capture.isOpened():
            self._inference_status = "error"
            return {
                "status": "invalid_video",
                "error": "The uploaded file could not be opened as a video.",
                "originalFilename": original_name,
                "modelLoaded": self.model_loaded(),
                "inferenceStatus": "error",
            }

        model, load_error = self._load_model()
        if model is None:
            capture.release()
            self._inference_status = "unavailable"
            return {
                "status": "unavailable",
                "error": load_error,
                "originalFilename": original_name,
                "weightsAvailable": self.weights_available(),
                "modelLoaded": False,
                "inferenceStatus": "unavailable",
                "vehicleDetections": [],
                "countsByClass": {k: 0 for k in VEHICLE_CLASSES},
                "processedFrames": 0,
            }

        stride = max(1, self.config.DETECTION_FRAME_STRIDE)
        max_frames = self.config.DETECTION_MAX_FRAMES
        conf_threshold = self.config.YOLO_CONFIDENCE
        device = getattr(self, "_device", self.config.YOLO_DEVICE)

        detections: list[dict] = []
        counts = {k: 0 for k in VEHICLE_CLASSES}
        confidences: list[float] = []
        processed = 0
        frame_index = 0
        fps = capture.get(cv2.CAP_PROP_FPS) or 0.0

        try:
            while processed < max_frames:
                ok, frame = capture.read()
                if not ok:
                    break
                if frame_index % stride != 0:
                    frame_index += 1
                    continue
                timestamp = frame_index / fps if fps else processed
                results = model.predict(
                    source=frame,
                    verbose=False,
                    device=device,
                    conf=conf_threshold,
                )
                if results:
                    boxes = results[0].boxes
                    if boxes is not None:
                        for box in boxes:
                            cls_id = int(box.cls[0])
                            if cls_id not in COCO_VEHICLE_IDS:
                                continue
                            label = COCO_VEHICLE_IDS[cls_id]
                            confidence = float(box.conf[0])
                            xyxy = [float(v) for v in box.xyxy[0].tolist()]
                            counts[label] += 1
                            confidences.append(confidence)
                            detections.append(
                                {
                                    "frameIndex": frame_index,
                                    "timestampSeconds": round(timestamp, 3),
                                    "class": label,
                                    "confidence": round(confidence, 4),
                                    "bboxXyxy": [round(v, 2) for v in xyxy],
                                }
                            )
                processed += 1
                frame_index += 1
        finally:
            capture.release()
            self._inference_status = "idle"

        duration = time.perf_counter() - started
        mean_conf = sum(confidences) / len(confidences) if confidences else 0.0
        return {
            "status": "completed",
            "originalFilename": original_name,
            "processedFrames": processed,
            "frameStride": stride,
            "vehicleDetections": detections,
            "countsByClass": counts,
            "detectionConfidences": [round(c, 4) for c in confidences],
            "meanConfidence": round(mean_conf, 4),
            "processingDurationSeconds": round(duration, 3),
            "model": {
                "weightsAvailable": True,
                "modelLoaded": True,
                "device": device,
                "inferenceStatus": "idle",
            },
            "dataProvenance": "yolo-inference",
            "note": "Counts are actual model detections on sampled frames, not simulated values.",
        }
