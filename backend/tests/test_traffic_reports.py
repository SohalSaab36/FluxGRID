from services.traffic_report_store import TrafficReportStore


def create_user(client, email="resident@example.test"):
    profile = {
        "email": email,
        "password": "test-user-password-123",
        "fullName": "Test Resident",
        "phone": "+91 98765 43210",
        "city": "Delhi",
    }
    sent = client.post(
        "/api/auth/signup/phone-verification",
        json={"phone": profile["phone"]},
    )
    assert sent.status_code == 200
    return client.post(
        "/api/auth/signup",
        json={**profile, "phoneVerificationCode": "123456"},
    )


def test_signup_requires_and_returns_contact_profile(client):
    missing = client.post(
        "/api/auth/signup",
        json={"email": "missing@example.test", "password": "test-user-password-123"},
    )
    assert missing.status_code == 400

    response = create_user(client, "profile@example.test")
    assert response.status_code == 201
    assert response.get_json()["user"] == {
        "id": 2,
        "email": "profile@example.test",
        "role": "user",
        "fullName": "Test Resident",
        "phone": "+919876543210",
        "city": "Delhi",
    }


def login_admin(client):
    return client.post(
        "/api/auth/login",
        json={"email": "admin@example.test", "password": "test-admin-password-123"},
    )


def test_report_is_saved_with_nearest_intersection_and_expiry(client):
    assert create_user(client).status_code == 201
    response = client.post(
        "/api/traffic/reports",
        json={
            "type": "accident",
            "latitude": 28.7041,
            "longitude": 77.1025,
            "description": "Two cars blocking the eastbound lane.",
        },
    )
    assert response.status_code == 201
    report = response.get_json()["report"]
    assert report["intersectionId"] == "int-04"
    assert report["intersectionName"] == "Central & 5th"
    assert report["distanceKm"] == 0
    assert report["verified"] is False
    assert report["approvalStatus"] == "pending"

    listed = client.get("/api/traffic/reports")
    assert listed.status_code == 200
    payload = listed.get_json()
    assert payload["reports"] == [report]
    assert payload["expiresAfterSeconds"] == 4 * 60 * 60
    assert payload["maxDistanceKm"] == 5


def test_report_validation_and_network_radius(client):
    assert create_user(client).status_code == 201
    invalid_payloads = [
        {"type": "unknown", "latitude": 28.7041, "longitude": 77.1025},
        {"type": "hazard", "latitude": 91, "longitude": 77.1025},
        {"type": "hazard", "latitude": 28.7041, "longitude": float("nan")},
        {
            "type": "hazard",
            "latitude": 28.7041,
            "longitude": 77.1025,
            "description": "x" * 301,
        },
        {"type": "hazard", "latitude": True, "longitude": 77.1025},
    ]
    for payload in invalid_payloads:
        response = client.post("/api/traffic/reports", json=payload)
        assert response.status_code == 400
        assert "error" in response.get_json()

    outside = client.post(
        "/api/traffic/reports",
        json={"type": "closure", "latitude": 0, "longitude": 0},
    )
    assert outside.status_code == 400
    assert "outside the supported traffic network" in outside.get_json()["error"]


def test_expired_reports_are_removed_from_active_list():
    store = TrafficReportStore(":memory:", ttl_seconds=4, max_distance_km=5)
    store.create(
        {
            "type": "congestion",
            "description": "",
            "latitude": 28.7041,
            "longitude": 77.1025,
        },
        now=100,
    )
    assert len(store.active(now=103)) == 1
    assert store.active(now=104) == []
    store.close()


def test_reports_survive_store_restart(tmp_path):
    database = str(tmp_path / "reports.sqlite3")
    store = TrafficReportStore(database)
    store.create(
        {
            "type": "roadwork",
            "description": "Lane closed.",
            "latitude": 28.7041,
            "longitude": 77.1025,
        },
        now=100,
    )
    store.close()
    reopened = TrafficReportStore(database)
    assert len(reopened.active(now=101)) == 1
    reopened.close()


def test_accident_reports_are_visible_pending_until_admin_approves(client):
    assert create_user(client).status_code == 201
    created = client.post(
        "/api/traffic/reports",
        json={
            "type": "accident",
            "latitude": 28.7041,
            "longitude": 77.1025,
            "description": "Collision blocking a lane.",
        },
    )
    report = created.get_json()["report"]
    assert report["approvalStatus"] == "pending"
    assert client.get("/api/traffic/reports").get_json()["reports"] == [report]
    assert client.get("/api/admin/traffic/reports/pending").status_code == 403

    assert login_admin(client).status_code == 200
    pending = client.get("/api/admin/traffic/reports/pending").get_json()["reports"]
    assert [item["id"] for item in pending] == [report["id"]]
    decision = client.post(
        f"/api/admin/traffic/reports/{report['id']}/decision",
        json={"decision": "approve"},
    )
    assert decision.status_code == 200
    assert decision.get_json()["report"]["approvalStatus"] == "approved"
    assert client.get("/api/admin/traffic/reports/pending").get_json()["reports"] == []


def test_only_admins_can_moderate_and_rejected_accidents_are_hidden(client):
    assert create_user(client).status_code == 201
    created = client.post(
        "/api/traffic/reports",
        json={
            "type": "accident",
            "latitude": 28.7041,
            "longitude": 77.1025,
        },
    )
    report = created.get_json()["report"]
    denied = client.post(
        f"/api/admin/traffic/reports/{report['id']}/decision",
        json={"decision": "reject"},
    )
    assert denied.status_code == 403

    assert login_admin(client).status_code == 200
    rejected = client.post(
        f"/api/admin/traffic/reports/{report['id']}/decision",
        json={"decision": "reject"},
    )
    assert rejected.status_code == 200
    assert rejected.get_json()["report"]["approvalStatus"] == "rejected"
    assert client.get("/api/traffic/reports").get_json()["reports"] == []


def test_accounts_require_valid_password_and_user_cannot_claim_admin(client):
    weak = client.post(
        "/api/auth/signup",
        json={
            "email": "weak@example.test",
            "password": "short",
            "fullName": "Test Resident",
            "phone": "+91 98765 43210",
            "city": "Delhi",
            "phoneVerificationCode": "123456",
        },
    )
    assert weak.status_code == 400

    created = create_user(client, "user@example.test")
    assert created.status_code == 201
    assert created.get_json()["user"]["role"] == "user"
    assert client.post(
        "/api/auth/signup",
        json={
            "email": "user@example.test",
            "password": "another-long-password",
            "fullName": "Another Resident",
            "phone": "+91 98765 43211",
            "city": "Delhi",
            "phoneVerificationCode": "123456",
        },
    ).status_code == 409


def test_account_is_not_created_without_valid_mobile_code(client):
    profile = {
        "email": "unverified@example.test",
        "password": "test-user-password-123",
        "fullName": "Unverified Resident",
        "phone": "+919876543210",
        "city": "Delhi",
    }
    missing_code = client.post("/api/auth/signup", json=profile)
    assert missing_code.status_code == 400

    incorrect_code = client.post(
        "/api/auth/signup",
        json={**profile, "phoneVerificationCode": "000000"},
    )
    assert incorrect_code.status_code == 400
    assert "incorrect or expired" in incorrect_code.get_json()["error"]
    assert client.post(
        "/api/auth/login",
        json={"email": profile["email"], "password": profile["password"]},
    ).status_code == 401


def test_mobile_number_can_only_be_linked_to_one_account(client):
    assert create_user(client, "first-mobile@example.test").status_code == 201
    duplicate = create_user(client, "second-mobile@example.test")
    assert duplicate.status_code == 409
    assert "mobile number is already linked" in duplicate.get_json()["error"]


def test_password_reset_otp_updates_password_and_invalidates_code(client, monkeypatch):
    assert create_user(client, "reset@example.test").status_code == 201
    sent_codes = []

    def capture_email(_config, recipient, code):
        sent_codes.append((recipient, code))

    monkeypatch.setattr("routes.auth.send_password_reset_otp", capture_email)
    requested = client.post(
        "/api/auth/password-reset/request",
        json={"email": "reset@example.test"},
    )
    assert requested.status_code == 200
    assert sent_codes[0][0] == "reset@example.test"
    code = sent_codes[0][1]
    assert len(code) == 6

    invalid = client.post(
        "/api/auth/password-reset/confirm",
        json={"email": "reset@example.test", "code": "000000", "newPassword": "new-test-password-123"},
    )
    if code != "000000":
        assert invalid.status_code == 400

    confirmed = client.post(
        "/api/auth/password-reset/confirm",
        json={"email": "reset@example.test", "code": code, "newPassword": "new-test-password-123"},
    )
    assert confirmed.status_code == 200
    assert client.post(
        "/api/auth/login",
        json={"email": "reset@example.test", "password": "new-test-password-123"},
    ).status_code == 200
    reused = client.post(
        "/api/auth/password-reset/confirm",
        json={"email": "reset@example.test", "code": code, "newPassword": "newer-test-password-123"},
    )
    assert reused.status_code == 400


def test_password_reset_requires_configured_smtp_and_does_not_keep_unsent_code(client):
    assert create_user(client, "smtp@example.test").status_code == 201
    response = client.post(
        "/api/auth/password-reset/request",
        json={"email": "smtp@example.test"},
    )
    assert response.status_code == 503
    reset_count = client.application.extensions["accounts"]._connection.execute(
        "SELECT COUNT(*) FROM password_reset_codes"
    ).fetchone()[0]
    assert reset_count == 0


def test_reset_code_has_a_five_attempt_limit(client, monkeypatch):
    assert create_user(client, "attempts@example.test").status_code == 201
    monkeypatch.setattr("routes.auth.send_password_reset_otp", lambda *_args: None)
    assert client.post(
        "/api/auth/password-reset/request",
        json={"email": "attempts@example.test"},
    ).status_code == 200
    for _ in range(4):
        assert client.post(
            "/api/auth/password-reset/confirm",
            json={
                "email": "attempts@example.test",
                "code": "000000",
                "newPassword": "new-test-password-123",
            },
        ).status_code == 400
    locked = client.post(
        "/api/auth/password-reset/confirm",
        json={
            "email": "attempts@example.test",
            "code": "000000",
            "newPassword": "new-test-password-123",
        },
    )
    assert locked.status_code == 400
    assert "incorrect" in locked.get_json()["error"]
    expired = client.post(
        "/api/auth/password-reset/confirm",
        json={
            "email": "attempts@example.test",
            "code": "000000",
            "newPassword": "new-test-password-123",
        },
    )
    assert expired.status_code == 400
    assert "invalid or expired" in expired.get_json()["error"]
