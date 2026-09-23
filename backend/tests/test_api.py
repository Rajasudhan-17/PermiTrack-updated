import hashlib
import json
from datetime import date, timedelta
from leave_app.extensions import db
from leave_app.models import Leave, OD, RequestStatus, Role, User, AuditLog, OTPToken, utcnow
from leave_app.services.auth_security import clear_failed_logins


def test_api_login_token_hashing_and_lifecycle(client, seed_data):
    student = seed_data["student"]

    # 1. Login should return raw token
    res = client.post(
        "/api/v1/auth/login",
        json={"username": student.username, "password": "password"}
    )
    assert res.status_code == 200
    data = res.get_json()
    raw_token = data["token"]
    assert len(raw_token) == 64

    # 2. Check DB stores secure hash of token, not plaintext
    db.session.refresh(student)
    stored_hash = student.api_token
    assert stored_hash != raw_token
    assert stored_hash == hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    assert student.token_expires_at is not None

    # 3. Test token access works
    res_dash = client.get("/api/v1/dashboard", headers={"X-API-Token": raw_token})
    assert res_dash.status_code == 200
    assert res_dash.get_json()["role"] == "student"

    # 4. Invalidate token and check access is denied
    res_logout = client.post("/api/v1/auth/logout", headers={"X-API-Token": raw_token})
    assert res_logout.status_code == 200

    res_dash_after = client.get("/api/v1/dashboard", headers={"X-API-Token": raw_token})
    assert res_dash_after.status_code == 401


def test_api_login_rate_limiting(client, seed_data):
    # Configure rate limits for testing
    from flask import current_app
    current_app.config["LOGIN_RATE_LIMIT_ENABLED"] = True
    current_app.config["LOGIN_RATE_LIMIT_MAX_ATTEMPTS"] = 5
    current_app.config["LOGIN_RATE_LIMIT_WINDOW_SECONDS"] = 60

    student = seed_data["student"]
    clear_failed_logins(student.username, "127.0.0.1")

    # 1. Run 5 failed attempts
    for _ in range(5):
        res = client.post(
            "/api/v1/auth/login",
            json={"username": student.username, "password": "wrong_password"}
        )
        assert res.status_code == 401

    # 2. 6th attempt must lock out with 429
    res_lock = client.post(
        "/api/v1/auth/login",
        json={"username": student.username, "password": "password"}
    )
    assert res_lock.status_code == 429
    assert "Too many failed sign-in attempts" in res_lock.get_json()["message"]


def test_role_based_pending_queues(client, seed_data):
    student = seed_data["student"]
    mentor = seed_data["mentor"]
    faculty = seed_data["faculty"]
    hod = seed_data["hod"]

    # Clear leaves and ODs first
    db.session.query(Leave).delete()
    db.session.query(OD).delete()
    db.session.commit()

    # 1. Create a Leave request in PENDING state (belongs to Mentor's queue)
    leave_pending = Leave(
        requested_by=student.id,
        approved_by=mentor.id,
        start_date=date.today(),
        end_date=date.today(),
        reason="Dentist appointment",
        status=RequestStatus.PENDING.value
    )
    db.session.add(leave_pending)

    # 2. Create a Leave request in MENTOR_APPROVED state (belongs to Faculty's queue)
    leave_mentor_approved = Leave(
        requested_by=student.id,
        approved_by=faculty.id,
        start_date=date.today(),
        end_date=date.today(),
        reason="Conference",
        status=RequestStatus.MENTOR_APPROVED.value
    )
    db.session.add(leave_mentor_approved)

    # 3. Create a Leave request in FACULTY_APPROVED state (belongs to HOD's queue)
    leave_faculty_approved = Leave(
        requested_by=student.id,
        approved_by=hod.id,
        start_date=date.today(),
        end_date=date.today(),
        reason="Fever",
        status=RequestStatus.FACULTY_APPROVED.value
    )
    db.session.add(leave_faculty_approved)

    db.session.commit()

    # Log in and check queues
    # A. Mentor Queue
    res_mentor_login = client.post("/api/v1/auth/login", json={"username": mentor.username, "password": "password"})
    mentor_token = res_mentor_login.get_json()["token"]
    
    res_mentor_pending = client.get("/api/v1/pending", headers={"X-API-Token": mentor_token})
    assert res_mentor_pending.status_code == 200
    pending_leaves = res_mentor_pending.get_json()["pending_leaves"]
    assert len(pending_leaves) == 1
    assert pending_leaves[0]["id"] == leave_pending.id

    # B. Faculty Queue
    res_faculty_login = client.post("/api/v1/auth/login", json={"username": faculty.username, "password": "password"})
    faculty_token = res_faculty_login.get_json()["token"]

    res_faculty_pending = client.get("/api/v1/pending", headers={"X-API-Token": faculty_token})
    assert res_faculty_pending.status_code == 200
    pending_leaves_f = res_faculty_pending.get_json()["pending_leaves"]
    assert len(pending_leaves_f) == 1
    assert pending_leaves_f[0]["id"] == leave_mentor_approved.id

    # C. HOD Queue
    res_hod_login = client.post("/api/v1/auth/login", json={"username": hod.username, "password": "password"})
    hod_token = res_hod_login.get_json()["token"]

    res_hod_pending = client.get("/api/v1/pending", headers={"X-API-Token": hod_token})
    assert res_hod_pending.status_code == 200
    pending_leaves_h = res_hod_pending.get_json()["pending_leaves"]
    assert len(pending_leaves_h) == 1
    assert pending_leaves_h[0]["id"] == leave_faculty_approved.id


def test_audit_log_actor_capture(client, seed_data):
    student = seed_data["student"]

    # Wipe audit log
    db.session.query(AuditLog).delete()
    db.session.commit()

    # Perform a login request via client
    res = client.post(
        "/api/v1/auth/login",
        json={"username": student.username, "password": "password"}
    )
    assert res.status_code == 200
    token = res.get_json()["token"]

    # Since the request runs through Flask testing client, let's verify if an audit log was created
    # Wait, in api_login, we did not call log_audit_event. Let's trigger a flow that writes logs.
    # E.g., student creates a leave request (which calls submit_leave_request)
    # But wait! We want to test authenticated requests writing audit log actor ID!
    # Let's perform a web logout or password reset or another action that triggers log_audit_event.
    # In auth.py, we have `log_audit_event("LOGIN_SUCCESS", user)`!
    # Let's test that by doing a POST to /login (the HTML form login):
    
    # We first retrieve CSRF token
    res_get = client.get("/")
    assert res_get.status_code == 200
    # The session now has CSRF token. Since CSRF is disabled in conftest.py, we can POST to /login without CSRF token.
    res_login = client.post(
        "/login",
        data={"username": student.username, "password": "password"}
    )
    assert res_login.status_code == 302 # Redirect to index

    # Check AuditLog
    logs = AuditLog.query.all()
    assert len(logs) > 0
    login_log = next(log for log in logs if log.action == "LOGIN_SUCCESS")
    assert login_log.actor_id == student.id
    assert login_log.target_id == student.id
    assert login_log.target_type == "User"


def test_api_pending_risk_shape(client, seed_data):
    student = seed_data["student"]
    mentor = seed_data["mentor"]

    # Clear table records
    db.session.query(Leave).delete()
    db.session.query(OD).delete()
    db.session.commit()

    # Seed one leave and one OD
    leave = Leave(
        requested_by=student.id,
        approved_by=mentor.id,
        start_date=date.today(),
        end_date=date.today(),
        reason="Checkup",
        status=RequestStatus.PENDING.value
    )
    db.session.add(leave)

    coordinator = User(
        username="event_coordinator_risk_shape",
        email="coord_risk_shape@example.com",
        role=Role.EVENT_COORDINATOR.value,
        full_name="Event Coordinator Risk Shape",
    )
    coordinator.set_password("password")
    db.session.add(coordinator)
    db.session.commit()

    od = OD(
        requested_by=student.id,
        faculty_id=seed_data["faculty"].id,
        event_coordinator_id=coordinator.id,
        event_date=date.today(),
        reason="Hackathon",
        status=RequestStatus.PENDING.value
    )
    db.session.add(od)
    db.session.commit()

    # Login as Mentor to view pending leave
    res_login = client.post("/api/v1/auth/login", json={"username": mentor.username, "password": "password"})
    token = res_login.get_json()["token"]

    res_pending = client.get("/api/v1/pending", headers={"X-API-Token": token})
    assert res_pending.status_code == 200
    data = res_pending.get_json()
    
    # Assert leave risk shape
    assert "pending_leaves" in data
    pending_leaves = data["pending_leaves"]
    assert len(pending_leaves) == 1
    leave_item = pending_leaves[0]
    assert "risk" in leave_item
    risk = leave_item["risk"]
    assert isinstance(risk["score"], int)
    assert isinstance(risk["level"], str)
    assert isinstance(risk["reasons"], list)

    # Login as Event Coordinator to view pending OD
    res_login_coord = client.post("/api/v1/auth/login", json={"username": coordinator.username, "password": "password"})
    coord_token = res_login_coord.get_json()["token"]

    res_pending_coord = client.get("/api/v1/pending", headers={"X-API-Token": coord_token})
    assert res_pending_coord.status_code == 200
    data_coord = res_pending_coord.get_json()

    assert "pending_ods" in data_coord
    pending_ods = data_coord["pending_ods"]
    assert len(pending_ods) == 1
    od_item = pending_ods[0]
    assert "risk" in od_item
    risk_od = od_item["risk"]
    assert isinstance(risk_od["score"], int)
    assert isinstance(risk_od["level"], str)
    assert isinstance(risk_od["reasons"], list)


def test_delete_user_with_dependencies(client, seed_data):
    # Create admin user and a target student user specifically for deletion test
    admin = User(
        username="admin_deleter",
        email="admin_del@example.com",
        role=Role.ADMIN.value,
        full_name="Admin Deleter",
    )
    admin.set_password("password")

    target_student = User(
        username="student_to_delete",
        email="student_del@example.com",
        role=Role.STUDENT.value,
        full_name="Student To Delete",
    )
    target_student.set_password("password")

    db.session.add_all([admin, target_student])
    db.session.commit()

    # 1. Login as Admin
    res_admin_login = client.post("/api/v1/auth/login", json={"username": admin.username, "password": "password"})
    admin_token = res_admin_login.get_json()["token"]

    # 2. Login as Target Student to generate API token & Audit Log
    res_student_login = client.post("/api/v1/auth/login", json={"username": target_student.username, "password": "password"})
    assert res_student_login.status_code == 200

    # 3. Create Audit Log for student
    log = AuditLog(actor_id=target_student.id, action="TEST_ACTION", details="Test audit entry")
    db.session.add(log)
    db.session.commit()

    # 4. Admin deletes target student user via DELETE /api/v1/admin/users/<id>
    res_delete = client.delete(
        f"/api/v1/admin/users/{target_student.id}",
        headers={"X-API-Token": admin_token}
    )
    assert res_delete.status_code == 200
    assert "Deleted user" in res_delete.get_json()["message"]

    # Verify user is gone from DB
    deleted_user = db.session.get(User, target_student.id)
    assert deleted_user is None


def test_api_forgot_password_and_verify_otp(client, seed_data):
    student = seed_data["student"]
    student.email = "student@example.com"
    db.session.commit()

    # 1. Request OTP for non-existing username/email
    res_fake = client.post("/api/v1/auth/forgot-password", json={"identifier": "nonexistent"})
    assert res_fake.status_code == 404

    # 2. Request OTP for valid student username
    res = client.post("/api/v1/auth/forgot-password", json={"identifier": student.username})
    assert res.status_code == 200
    assert "sent" in res.get_json()["message"]

    # Retrieve generated OTP from DB
    otp_record = OTPToken.query.filter_by(user_id=student.id, is_used=False).first()
    assert otp_record is not None
    otp_code = otp_record.otp

    # 3. Verify OTP with wrong code
    res_invalid = client.post("/api/v1/auth/verify-otp", json={
        "identifier": student.username,
        "otp": "000000",
        "new_password": "newpassword123"
    })
    assert res_invalid.status_code == 400

    # 4. Verify OTP with valid code & reset password
    res_valid = client.post("/api/v1/auth/verify-otp", json={
        "identifier": student.username,
        "otp": otp_code,
        "new_password": "password"
    })
    assert res_valid.status_code == 200
    assert "Password reset successfully" in res_valid.get_json()["message"]


def test_get_students_list_roster(client, seed_data):
    student = seed_data["student"]
    mentor = seed_data["mentor"]

    # 1. Student role cannot access students roster
    res_student_login = client.post("/api/v1/auth/login", json={"username": student.username, "password": "password"})
    assert res_student_login.status_code == 200
    student_token = res_student_login.get_json()["token"]

    res_denied = client.get("/api/v1/students", headers={"X-API-Token": student_token})
    assert res_denied.status_code == 403

    # 2. Mentor role can view assigned students list
    res_mentor_login = client.post("/api/v1/auth/login", json={"username": mentor.username, "password": "password"})
    mentor_token = res_mentor_login.get_json()["token"]

    res_students = client.get("/api/v1/students", headers={"X-API-Token": mentor_token})
    assert res_students.status_code == 200
    students = res_students.get_json()
    assert isinstance(students, list)
    if len(students) > 0:
        st = students[0]
        assert "id" in st
        assert "full_name" in st
        assert "leaves_count" in st
        assert "ods_count" in st


def test_get_student_detail(client, seed_data):
    student = seed_data["student"]
    mentor = seed_data["mentor"]

    # Login as Mentor
    res_mentor_login = client.post("/api/v1/auth/login", json={"username": mentor.username, "password": "password"})
    mentor_token = res_mentor_login.get_json()["token"]

    # Get student detail
    res_detail = client.get(f"/api/v1/students/{student.id}/detail", headers={"X-API-Token": mentor_token})
    assert res_detail.status_code == 200
    data = res_detail.get_json()
    assert "student" in data
    assert data["student"]["id"] == student.id
    assert "attendance" in data
    assert "leaves" in data
    assert "ods" in data
    assert "present_days" in data["attendance"]
    assert "total_working_days" in data["attendance"]






