def test_intersection_list(client):
    response = client.get("/api/intersections")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["dataProvenance"] == "simulated"
    assert len(payload["intersections"]) == 12
    first = payload["intersections"][0]
    assert first["id"]
    assert first["name"]
    assert len(first["coordinates"]) == 2
    assert "north" in first["approaches"]
    assert "congestion" in first
    assert "currentPhase" in first
    assert "phaseRemainingSeconds" in first


def test_intersection_detail(client):
    response = client.get("/api/intersections/int-04")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["id"] == "int-04"
    assert payload["demonstrationNote"]


def test_unknown_intersection(client):
    response = client.get("/api/intersections/not-a-real-id")
    assert response.status_code == 404
    assert "error" in response.get_json()
