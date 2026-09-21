from datetime import date, timedelta
from leave_app.extensions import db
from leave_app.models import Leave, RequestStatus, User, Role
from leave_app.services.workflows import submit_leave_request, apply_leave_review


def test_leave_approval_workflow(app, seed_data):
    student = seed_data["student"]
    mentor = seed_data["mentor"]
    faculty = seed_data["faculty"]
    hod = seed_data["hod"]

    # 1. Student submits a leave request for 3 days
    start_date = date.today()
    end_date = start_date + timedelta(days=2)  # inclusive count is 3 days

    success, leave, error = submit_leave_request(
        student, start_date, end_date, "Medical issues", is_emergency=False
    )
    assert success is True
    assert leave is not None
    assert leave.status == RequestStatus.PENDING.value

    # 2. Mentor reviews and approves
    success, flash_res = apply_leave_review(
        leave.id, mentor.id, "APPROVE", "Recommended by mentor"
    )
    assert success is True
    assert leave.status == RequestStatus.MENTOR_APPROVED.value

    # 3. Faculty reviews and approves
    success, flash_res = apply_leave_review(
        leave.id, faculty.id, "APPROVE", "Forwarded by faculty advisor"
    )
    assert success is True
    assert leave.status == RequestStatus.FACULTY_APPROVED.value

    # 4. HOD reviews and approves
    success, flash_res = apply_leave_review(
        leave.id, hod.id, "APPROVE", "HOD Approved"
    )
    assert success is True
    assert leave.status == RequestStatus.APPROVED.value


def test_leave_rejection_workflow(app, seed_data):
    student = seed_data["student"]
    mentor = seed_data["mentor"]

    # 1. Student submits a leave request for 2 days
    start_date = date.today()
    end_date = start_date + timedelta(days=1)

    success, leave, error = submit_leave_request(
        student, start_date, end_date, "Family function", is_emergency=False
    )
    assert success is True
    assert leave.status == RequestStatus.PENDING.value

    # 2. Mentor reviews and rejects
    success, flash_res = apply_leave_review(
        leave.id, mentor.id, "REJECT", "Not recommended"
    )
    assert success is True
    assert leave.status == RequestStatus.REJECTED.value


def test_od_approval_workflow(app, seed_data):
    from leave_app.models import OD
    from leave_app.services.workflows import apply_od_review

    student = seed_data["student"]
    mentor = seed_data["mentor"]
    faculty = seed_data["faculty"]
    hod = seed_data["hod"]

    # In conftest.py, we created a class group which has faculty as advisor.
    # We will create an event coordinator user for this test.
    coordinator = User(
        username="event_coord",
        email="coord@example.com",
        role=Role.EVENT_COORDINATOR.value,
        full_name="Event Coordinator",
    )
    coordinator.set_password("password")
    db.session.add(coordinator)
    db.session.commit()

    # 1. Create OD request
    od = OD(
        requested_by=student.id,
        faculty_id=faculty.id,
        event_coordinator_id=coordinator.id,
        event_date=date.today(),
        reason= "Coding Contest",
        status=RequestStatus.PENDING.value,
    )
    db.session.add(od)
    db.session.commit()

    # 2. Event Coordinator reviews and approves
    success, flash_res = apply_od_review(od.id, coordinator.id, "APPROVE", "Valid participation")
    assert success is True
    assert od.status == RequestStatus.EVENT_COORDINATOR_APPROVED.value

    # 3. Mentor reviews and approves
    success, flash_res = apply_od_review(od.id, mentor.id, "APPROVE", "Mentor approved")
    assert success is True
    assert od.status == RequestStatus.MENTOR_APPROVED.value

    # 4. Faculty reviews and approves
    success, flash_res = apply_od_review(od.id, faculty.id, "APPROVE", "Faculty approved")
    assert success is True
    assert od.status == RequestStatus.FACULTY_APPROVED.value

    # 5. HOD reviews and approves (final stage)
    success, flash_res = apply_od_review(od.id, hod.id, "APPROVE", "HOD approved")
    assert success is True
    assert od.status == RequestStatus.APPROVED.value


def test_od_rejection_workflow(app, seed_data):
    from leave_app.models import OD
    from leave_app.services.workflows import apply_od_review

    student = seed_data["student"]
    faculty = seed_data["faculty"]

    coordinator = User(
        username="event_coord2",
        email="coord2@example.com",
        role=Role.EVENT_COORDINATOR.value,
        full_name="Event Coordinator 2",
    )
    coordinator.set_password("password")
    db.session.add(coordinator)
    db.session.commit()

    od = OD(
        requested_by=student.id,
        faculty_id=faculty.id,
        event_coordinator_id=coordinator.id,
        event_date=date.today(),
        reason="Workshop",
        status=RequestStatus.PENDING.value,
    )
    db.session.add(od)
    db.session.commit()

    # Event Coordinator reviews and rejects
    success, flash_res = apply_od_review(od.id, coordinator.id, "REJECT", "No proof found")
    assert success is True
    assert od.status == RequestStatus.REJECTED.value

