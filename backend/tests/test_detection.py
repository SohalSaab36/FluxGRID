from io import BytesIO
from pathlib import Path


def test_detection_status_when_weights_missing(client, tmp_path, monkeypatch):
    detector = client.application.extensions["detector"]
    missing = tmp_path / "missing.pt"
    monkeypatch.setattr(detector.config, "YOLO_MODEL_PATH", str(missing))
    response = client.get("/api/detection/status")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["weightsAvailable"] is False
    assert payload["modelLoaded"] is False


def test_analyze_unavailable_without_weights(client, tmp_path, monkeypatch):
    detector = client.application.extensions["detector"]
    monkeypatch.setattr(detector.config, "YOLO_MODEL_PATH", str(tmp_path / "nope.pt"))
    data = {
        "file": (BytesIO(b"not-a-real-video"), "clip.mp4"),
    }
    response = client.post("/api/detection/analyze", data=data, content_type="multipart/form-data")
    assert response.status_code in {400, 503}
    payload = response.get_json()
    assert payload["status"] in {"unavailable", "invalid_video"}
    if payload["status"] == "unavailable":
        assert payload["modelLoaded"] is False
        assert payload["error"]


def test_invalid_extension_rejected(client):
    data = {"file": (BytesIO(b"hello"), "notes.exe")}
    response = client.post("/api/detection/analyze", data=data, content_type="multipart/form-data")
    assert response.status_code == 400
    assert "Unsupported" in response.get_json()["error"]


def test_missing_file_rejected(client):
    response = client.post("/api/detection/analyze")
    assert response.status_code == 400
