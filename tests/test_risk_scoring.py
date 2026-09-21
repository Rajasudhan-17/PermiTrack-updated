import pytest
from datetime import date, timedelta
from leave_app.extensions import db
from leave_app.models import Leave, OD, RequestStatus, Role, User
from leave_app.services.risk_scoring import calculate_leave_risk, calculate_od_risk


def test_leave_risk_scoring_emergency_frequency(app, seed_data):
    student = seed_data["student"]

    # 1. Test case: high frequency of emergency leaves (3 past emergency requests in past 30 days)
    for i in range(3):
        past_leave = Leave(
            requested_by=student.id,
            start_date=date.today() - timedelta(days=10 + i),
            end_date=date.today() - timedelta(days=10 + i),
            reason=f"Emergency illness {i}",
            is_emergency=True,
            status=RequestStatus.APPROVED.value
        )
        db.session.add(past_leave)
    db.session.commit()

    current_leave = Leave(
        requested_by=student.id,
        start_date=date.today(),
        end_date=date.today(),
        reason="Routine checkup",
        is_emergency=False,
        status=RequestStatus.PENDING.value
    )
    db.session.add(current_leave)
    db.session.commit()

    score, level, reasons = calculate_leave_risk(current_leave)
    assert score >= 35
    assert any("High frequency of emergency leaves" in r for r in reasons)


def test_leave_risk_scoring_cumulative_absences(app, seed_data):
    student = seed_data["student"]

    # 2. Test case: cumulative absences exceed 15 days in past 90 days
    # Let's add an approved 13-day leave request
    past_leave = Leave(
        requested_by=student.id,
        start_date=date.today() - timedelta(days=40),
        end_date=date.today() - timedelta(days=28),  # 13 days
        reason="Family emergency",
        status=RequestStatus.APPROVED.value
    )
    db.session.add(past_leave)
    db.session.commit()

    # Request a 3-day leave now (13 + 3 = 16 days cumulative)
    current_leave = Leave(
        requested_by=student.id,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=2),  # 3 days
        reason="Fever",
        status=RequestStatus.PENDING.value
    )
    db.session.add(current_leave)
    db.session.commit()

    score, level, reasons = calculate_leave_risk(current_leave)
    assert score >= 30
    assert any("Cumulative absences" in r for r in reasons)


def test_leave_risk_scoring_isolated_rules(app, seed_data):
    student = seed_data["student"]

    # Rule A: Long duration request only (> 5 days)
    long_leave = Leave(
        requested_by=student.id,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=6),  # 7 days
        reason="Vacation",
        is_emergency=False,
        status=RequestStatus.PENDING.value
    )
    db.session.add(long_leave)
    db.session.commit()

    score, level, reasons = calculate_leave_risk(long_leave)
    assert score == 15
    assert level == "Low"
    assert reasons == ["Long duration request (7 days)"]


def test_leave_risk_scoring_max_boundary_cap(app, seed_data):
    student = seed_data["student"]
    
    # 1. Emergency leaves in past 30 days >= 3 -> +35 points
    for i in range(3):
        past_leave = Leave(
            requested_by=student.id,
            start_date=date.today() - timedelta(days=10 + i),
            end_date=date.today() - timedelta(days=10 + i),
            reason=f"Emergency {i}",
            is_emergency=True,
            status=RequestStatus.APPROVED.value
        )
        db.session.add(past_leave)

    # 2. Cumulative absences > 15 days in 90 days -> +30 points
    past_leave_long = Leave(
        requested_by=student.id,
        start_date=date.today() - timedelta(days=40),
        end_date=date.today() - timedelta(days=30),  # 11 days
        reason="Family emergency",
        status=RequestStatus.APPROVED.value
    )
    db.session.add(past_leave_long)
    
    # 3. Long request length (> 5 days) -> +15 points
    # Current request: 6 days (11 + 6 = 17 days cumulative) -> matches absences rule + request length rule
    # Emergency request itself -> +25 points
    current_leave = Leave(
        requested_by=student.id,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=5),  # 6 days
        reason="Major medical request",
        is_emergency=True,
        status=RequestStatus.PENDING.value
    )
    db.session.add(current_leave)
    db.session.commit()

    # Total score calculation: 35 + 30 + 15 + 25 = 105 points -> capped at 100
    score, level, reasons = calculate_leave_risk(current_leave)
    assert score == 80
    assert level == "High"
    assert len(reasons) == 3


def test_od_risk_scoring_isolated_rules(app, seed_data):
    student = seed_data["student"]
    faculty = seed_data["faculty"]

    # Rule A: Frequency of OD requests this month (>= 3 requests -> +20 points)
    # We will seed 3 past OD requests in the past 30 days
    for i in range(3):
        past_od = OD(
            requested_by=student.id,
            faculty_id=faculty.id,
            event_date=date.today() - timedelta(days=5 + i),
            reason=f"Event {i}",
            status=RequestStatus.APPROVED.value
        )
        db.session.add(past_od)
    db.session.commit()

    current_od = OD(
        requested_by=student.id,
        faculty_id=faculty.id,
        event_date=date.today(),
        reason="hackathon",
        status=RequestStatus.PENDING.value
    )
    db.session.add(current_od)
    db.session.commit()

    score, level, reasons = calculate_od_risk(current_od)
    assert score == 20
    assert level == "Medium"
    assert any("High monthly OD requests" in r for r in reasons)


def test_od_risk_scoring_boundary_cap(app, seed_data):
    student = seed_data["student"]
    faculty = seed_data["faculty"]

    # 1. Cumulative absence > 15 days in past 90 days -> +30 points
    # Let's seed 15 days of approved leaves
    past_leave = Leave(
        requested_by=student.id,
        start_date=date.today() - timedelta(days=50),
        end_date=date.today() - timedelta(days=36),  # 15 days
        reason="Medical treatment",
        status=RequestStatus.APPROVED.value
    )
    db.session.add(past_leave)

    # 2. Monthly OD frequency >= 5 requests -> +40 points
    for i in range(5):
        past_od = OD(
            requested_by=student.id,
            faculty_id=faculty.id,
            event_date=date.today() - timedelta(days=5 + i),
            reason=f"Event {i}",
            status=RequestStatus.APPROVED.value
        )
        db.session.add(past_od)

    current_od = OD(
        requested_by=student.id,
        faculty_id=faculty.id,
        event_date=date.today(),
        reason="Final Contest",
        status=RequestStatus.PENDING.value
    )
    db.session.add(current_od)
    db.session.commit()

    # Total score expectation: 30 (absence) + 40 (frequency) = 70 points
    score, level, reasons = calculate_od_risk(current_od)
    assert score == 70
    assert level == "High"
    assert len(reasons) == 2


