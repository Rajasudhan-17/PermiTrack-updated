from datetime import datetime
from flask import current_app
from ..extensions import db
from ..models import (
    AttendanceRecord,
    AttendanceStatus,
    ClassGroup,
    Leave,
    OD,
    RequestStatus,
    Role,
    User,
    utcnow,
)
from .audit import log_audit_event


def get_attendance_sheet(class_group_id, date_obj):
    """
    Fetches student roster for a class and target date, auto-filling attendance status
    and student reasons for any approved Leaves or ODs.
    """
    students = (
        User.query.filter_by(class_group_id=class_group_id, _role=Role.STUDENT.value)
        .order_by(User.register_number.asc(), User.full_name.asc(), User.username.asc())
        .all()
    )

    existing_records = {
        r.student_id: r
        for r in AttendanceRecord.query.filter_by(class_group_id=class_group_id, date=date_obj).all()
    }

    # Query all approved leaves overlapping date_obj
    approved_leaves = (
        Leave.query.filter(
            Leave.status == RequestStatus.APPROVED.value,
            Leave.start_date <= date_obj,
            Leave.end_date >= date_obj,
        ).all()
    )
    leave_map = {l.requested_by: l for l in approved_leaves}

    # Query all approved ODs matching date_obj
    approved_ods = (
        OD.query.filter(
            OD.status == RequestStatus.APPROVED.value,
            OD.event_date == date_obj,
        ).all()
    )
    od_map = {o.requested_by: o for o in approved_ods}

    sheet = []
    for student in students:
        record = existing_records.get(student.id)
        approved_leave = leave_map.get(student.id)
        approved_od = od_map.get(student.id)

        if record:
            status = record.status
            reason = record.reason or ""
            leave_id = record.leave_id
            od_id = record.od_id
            is_auto = bool(record.leave_id or record.od_id)
        elif approved_leave:
            status = AttendanceStatus.LEAVE.value
            reason = f"Approved Leave: {approved_leave.reason}"
            leave_id = approved_leave.id
            od_id = None
            is_auto = True
        elif approved_od:
            status = AttendanceStatus.OD.value
            reason = f"Approved OD: {approved_od.reason}"
            leave_id = None
            od_id = approved_od.id
            is_auto = True
        else:
            status = AttendanceStatus.PRESENT.value
            reason = ""
            leave_id = None
            od_id = None
            is_auto = False

        sheet.append(
            {
                "student": student,
                "status": status,
                "reason": reason,
                "leave_id": leave_id,
                "od_id": od_id,
                "is_auto": is_auto,
                "approved_leave": approved_leave,
                "approved_od": approved_od,
                "existing_record": record,
            }
        )

    return sheet


def save_attendance_sheet(class_group_id, date_obj, records_data, marker_user):
    """
    Bulk saves/updates attendance records for a class group on a given date.
    records_data: dict of {student_id: {"status": str, "reason": str, "leave_id": int|None, "od_id": int|None}}
    """
    students = User.query.filter_by(class_group_id=class_group_id, _role=Role.STUDENT.value).all()
    student_ids = {s.id for s in students}

    existing_records = {
        r.student_id: r
        for r in AttendanceRecord.query.filter_by(class_group_id=class_group_id, date=date_obj).all()
    }

    count = 0
    for student_id, data in records_data.items():
        if student_id not in student_ids:
            continue

        status = data.get("status", AttendanceStatus.PRESENT.value)
        if status not in [s.value for s in AttendanceStatus]:
            status = AttendanceStatus.PRESENT.value

        reason = (data.get("reason") or "").strip()
        leave_id = data.get("leave_id")
        od_id = data.get("od_id")

        record = existing_records.get(student_id)
        if record:
            record.status = status
            record.reason = reason
            record.leave_id = leave_id
            record.od_id = od_id
            record.marked_by = marker_user.id
            record.marked_on = utcnow()
        else:
            record = AttendanceRecord(
                student_id=student_id,
                class_group_id=class_group_id,
                date=date_obj,
                status=status,
                reason=reason,
                leave_id=leave_id,
                od_id=od_id,
                marked_by=marker_user.id,
                marked_on=utcnow(),
            )
            db.session.add(record)
        count += 1

    db.session.commit()
    log_audit_event(
        "ATTENDANCE_MARKED",
        details=f"ClassGroup ID: {class_group_id}, Date: {date_obj}, Marker: {marker_user.username}, Records: {count}",
    )
    return count


def sync_attendance_for_approved_leave(leave):
    """
    When a leave request is approved by HOD, automatically updates any existing
    attendance records for the student within the leave date range, or creates them if missing.
    """
    student = db.session.get(User, leave.requested_by)
    current_date = leave.start_date
    updated = False
    while current_date <= leave.end_date:
        record = AttendanceRecord.query.filter_by(
            student_id=leave.requested_by, date=current_date
        ).first()
        if record:
            record.status = AttendanceStatus.LEAVE.value
            record.reason = f"Approved Leave: {leave.reason}"
            record.leave_id = leave.id
            updated = True
        elif student and student.class_group_id:
            record = AttendanceRecord(
                student_id=student.id,
                class_group_id=student.class_group_id,
                date=current_date,
                status=AttendanceStatus.LEAVE.value,
                reason=f"Approved Leave: {leave.reason}",
                leave_id=leave.id,
                marked_by=leave.approved_by or leave.requested_by,
                marked_on=utcnow(),
            )
            db.session.add(record)
            updated = True
        current_date = current_date.fromordinal(current_date.toordinal() + 1)

    if updated:
        db.session.commit()


def sync_attendance_for_approved_od(od):
    """
    When an OD request is approved by HOD, automatically updates any existing
    attendance record for the student on the event date, or creates one if missing.
    """
    record = AttendanceRecord.query.filter_by(
        student_id=od.requested_by, date=od.event_date
    ).first()
    if record:
        record.status = AttendanceStatus.OD.value
        record.reason = f"Approved OD: {od.reason}"
        record.od_id = od.id
    else:
        student = db.session.get(User, od.requested_by)
        if student and student.class_group_id:
            record = AttendanceRecord(
                student_id=student.id,
                class_group_id=student.class_group_id,
                date=od.event_date,
                status=AttendanceStatus.OD.value,
                reason=f"Approved OD: {od.reason}",
                od_id=od.id,
                marked_by=od.approved_by or od.requested_by,
                marked_on=utcnow(),
            )
            db.session.add(record)
    db.session.commit()


def get_student_attendance_summary(student_id):
    """
    Calculates attendance statistics for a student.
    """
    records = AttendanceRecord.query.filter_by(student_id=student_id).all()
    total = len(records)
    if total == 0:
        return {
            "total": 0,
            "present": 0,
            "absent": 0,
            "leave": 0,
            "od": 0,
            "percentage": 100.0,
        }

    present = sum(1 for r in records if r.status == AttendanceStatus.PRESENT.value)
    absent = sum(1 for r in records if r.status == AttendanceStatus.ABSENT.value)
    leave = sum(1 for r in records if r.status == AttendanceStatus.LEAVE.value)
    od = sum(1 for r in records if r.status == AttendanceStatus.OD.value)

    # Present + OD counts towards effective attendance percentage
    effective_present = present + od
    percentage = round((effective_present / total) * 100.0, 1)

    return {
        "total": total,
        "present": present,
        "absent": absent,
        "leave": leave,
        "od": od,
        "percentage": percentage,
    }
