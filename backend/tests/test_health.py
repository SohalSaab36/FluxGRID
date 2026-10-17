def test_health_ok_without_loading_model(client, app):
    detector = app.extensions["detector"]
    assert detector.model_loaded() is False
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "ok"
    assert payload["application"]
    assert payload["simulation"]["status"] in {"running", "paused"}
    assert "yoloAvailable" in payload
    assert payload["modelLoaded"] is False
    assert detector.model_loaded() is False
