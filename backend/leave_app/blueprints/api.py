import hashlib
import secrets
from datetime import timedelta
from functools import wraps

from flask import Blueprint, jsonify, request
from flask_login import current_user, logout_user

from ..extensions import db
from ..models import APIToken, AttendanceRecord, AttendanceStatus, Leave, OD, OTPToken, RequestStatus, Role, User, utcnow
from ..services.auth_security import clear_failed_logins, login_allowed, register_failed_login
from ..services.workflows import pending_counts_for_user
from ..services.risk_scoring import calculate_leave_risk, calculate_od_risk

bp = Blueprint("api", __name__, url_prefix="/api/v1")


def hash_token(token_str):
    if not token_str:
        return ""
    return hashlib.sha256(token_str.encode("utf-8")).hexdigest()


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        raw_token = request.headers.get("X-API-Token") or request.args.get("token")
        token = raw_token.strip() if raw_token and raw_token not in ("null", "undefined") else None
        user = None

        if token:
            hashed = hash_token(token)
            api_token = APIToken.query.filter_by(hashed_token=hashed).first()
            if api_token:
                if not api_token.is_revoked and api_token.expires_at and api_token.expires_at >= utcnow():
                    user = api_token.user
            else:
                u = User.query.filter((User.api_token == hashed) | (User.api_token == token)).first()
                if u and (not u.token_expires_at or u.token_expires_at >= utcnow()):
                    user = u

        if not user and getattr(current_user, "is_authenticated", False):
            user = current_user

        if not user:
            return jsonify({"message": "Token is missing or expired"}), 401

        return f(user, *args, **kwargs)

    return decorated


@bp.route("/auth/login", methods=["POST"])
def api_login():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400

    client_ip = request.remote_addr or "unknown"
    allowed, locked_until = login_allowed(username, client_ip)
    if not allowed:
        locked_until_display = locked_until.strftime("%Y-%m-%d %H:%M:%S") if locked_until else "later"
        return jsonify({"message": f"Too many failed sign-in attempts. Try again after {locked_until_display}."}), 429

    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        # Clear rate limiting attempts on successful login
        clear_failed_logins(username, client_ip)

        # Generate secure API token
        raw_token = secrets.token_hex(32)
        hashed_token = hash_token(raw_token)
        expires_at = utcnow() + timedelta(hours=24)

        # Record new multi-device APIToken entry
        new_token = APIToken(
            user_id=user.id,
            hashed_token=hashed_token,
            expires_at=expires_at,
            is_revoked=False,
        )
        db.session.add(new_token)
        
        # Also update user legacy columns for backwards compatibility
        user.api_token = hashed_token
        user.token_expires_at = expires_at
        db.session.commit()

        return jsonify(
            {
                "message": "Login successful",
                "token": raw_token,  # only return raw token to client once
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "full_name": user.full_name,
                    "role": user.role,
                },
            }
        )

    # Register failed attempt on failure
    register_failed_login(username, client_ip)
    return jsonify({"message": "Invalid username or password. Please verify your credentials and try again."}), 401


@bp.route("/auth/logout", methods=["POST"])
def api_logout():
    token = request.headers.get("X-API-Token")
    if token:
        hashed = hash_token(token)
        api_token = APIToken.query.filter_by(hashed_token=hashed).first()
        if api_token:
            api_token.is_revoked = True
        u = User.query.filter((User.api_token == hashed) | (User.api_token == token)).first()
        if u:
            u.api_token = None
            u.token_expires_at = None
        db.session.commit()

    if current_user.is_authenticated:
        from flask_login import logout_user
        from flask import session
        session.pop("active_role", None)
        session.clear()
        logout_user()

    return jsonify({"message": "Logout successful"}), 200


@bp.route("/auth/forgot-password", methods=["POST"])
def api_forgot_password():
    data = request.get_json() or {}
    identifier = (data.get("identifier") or data.get("email_or_username") or data.get("email") or data.get("username") or "").strip()

    if not identifier:
        return jsonify({"message": "Please enter your username, email, or roll number."}), 400

    user = User.query.filter(
        (User.email == identifier.lower()) |
        (User.username == identifier) |
        (User.register_number == identifier)
    ).first()

    if not user:
        return jsonify({"message": "No account associated with that username or email address."}), 404

    if not user.email:
        return jsonify({"message": "This account does not have a registered email address. Please contact your admin."}), 400

    # Generate a cryptographically secure 6-digit OTP
    otp_code = "".join(secrets.choice("0123456789") for _ in range(6))

    # Invalidate existing unused OTP tokens for this user
    for t in OTPToken.query.filter_by(user_id=user.id, is_used=False).all():
        t.is_used = True

    # Save the new OTP
    expires_at = utcnow() + timedelta(minutes=10)
    otp_token = OTPToken(
        user_id=user.id,
        otp=otp_code,
        expires_at=expires_at,
        is_used=False
    )
    db.session.add(otp_token)
    db.session.commit()

    # Send OTP email
    from ..services.emailing import send_email
    from ..services.audit import log_audit_event
    subject = "Permitrack Password Reset OTP"
    body = (
        f"Hello {user.full_name or user.username},\n\n"
        f"You requested to reset your password for Permitrack. Use the OTP code below to complete the reset:\n\n"
        f"OTP Code: {otp_code}\n\n"
        f"This OTP is valid for 10 minutes. If you did not request a password reset, you can safely ignore this message."
    )
    try:
        send_email(subject, [user.email], body)
        log_audit_event("PASSWORD_RESET_REQUESTED", user)
    except Exception as exc:
        from flask import current_app
        current_app.logger.error("Failed to send OTP email: %s", exc)

    email_parts = user.email.split("@")
    masked_email = f"{email_parts[0][:2]}***@{email_parts[1]}" if len(email_parts) == 2 else user.email

    return jsonify({
        "message": f"Verification OTP sent to {masked_email}. Please check your email inbox.",
        "email": user.email,
        "masked_email": masked_email,
    }), 200


@bp.route("/auth/verify-otp", methods=["POST"])
def api_verify_otp():
    data = request.get_json() or {}
    identifier = (data.get("identifier") or data.get("email_or_username") or data.get("email") or data.get("username") or "").strip()
    otp_input = data.get("otp", "").strip()
    new_password = data.get("new_password", "")

    if not identifier or not otp_input or not new_password:
        return jsonify({"message": "Email/username, OTP code, and new password are required."}), 400

    if len(new_password) < 6:
        return jsonify({"message": "New password must be at least 6 characters long."}), 400

    user = User.query.filter(
        (User.email == identifier.lower()) |
        (User.username == identifier) |
        (User.register_number == identifier)
    ).first()

    if not user:
        return jsonify({"message": "User account not found."}), 404

    now = utcnow()
    otp_token = OTPToken.query.filter(
        OTPToken.user_id == user.id,
        OTPToken.otp == otp_input,
        OTPToken.is_used == False,
        OTPToken.expires_at > now
    ).first()

    if not otp_token:
        from ..services.audit import log_audit_event
        log_audit_event("PASSWORD_RESET_FAILED", user, details="Invalid or expired OTP")
        return jsonify({"message": "Invalid or expired OTP code. Please request a new OTP."}), 400

    # OTP is valid, update password and mark OTP as used
    otp_token.is_used = True
    user.set_password(new_password)
    from ..services.audit import log_audit_event
    log_audit_event("PASSWORD_RESET_SUCCESS", user)
    db.session.commit()

    return jsonify({"message": "Password reset successfully! You can now log in with your new password."}), 200


@bp.route("/auth/switch-role", methods=["POST"])
@token_required
def api_switch_role(current_user):
    from flask import session
    data = request.get_json() or {}
    target_role = data.get("role", "").strip().lower()

    if current_user.db_role not in (Role.FACULTY.value, Role.MENTOR.value):
        return jsonify({"message": "Role switching is only permitted for Faculty and Mentor accounts"}), 403

    if target_role not in (Role.FACULTY.value, Role.MENTOR.value):
        return jsonify({"message": "Invalid target role for switching"}), 400

    session["active_role"] = target_role
    return jsonify(
        {
            "message": f"Switched role to {target_role.upper()}",
            "active_role": target_role,
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "full_name": current_user.full_name,
                "role": target_role,
                "db_role": current_user.db_role,
            },
        }
    )



@bp.route("/dashboard", methods=["GET"])
@token_required
def api_dashboard(current_user):
    if current_user.role == Role.ADMIN.value:
        metrics = {
            "role": current_user.role,
            "admin_user_count": User.query.count(),
            "admin_leave_count": Leave.query.count(),
            "admin_od_count": OD.query.count(),
        }
    else:
        pending_leave, pending_od = pending_counts_for_user(current_user)
        att_ods_count = AttendanceRecord.query.filter(
            AttendanceRecord.student_id == current_user.id,
            AttendanceRecord.status == AttendanceStatus.OD.value,
            AttendanceRecord.od_id.is_(None),
        ).count() if current_user.role == Role.STUDENT.value else 0

        metrics = {
            "role": current_user.role,
            "pending_leave_reviews": pending_leave,
            "pending_od_reviews": pending_od,
            "applied_leaves_count": Leave.query.filter_by(requested_by=current_user.id).count(),
            "applied_ods_count": OD.query.filter_by(requested_by=current_user.id).count() + att_ods_count,
        }
        if current_user.role == Role.STUDENT.value:
            from ..services.attendance import get_student_attendance_summary

            att_summary = get_student_attendance_summary(current_user.id)
            metrics["attendance"] = {
                "present_days": att_summary["present"],
                "absent_days": att_summary["absent"],
                "leave_days": att_summary["leave"],
                "od_days": att_summary["od"],
                "total_working_days": att_summary["total"],
                "percentage": att_summary["percentage"],
                "min_required_percentage": 80,
            }
    res = jsonify(metrics)
    res.headers["Cache-Control"] = "private, max-age=10"
    return res


@bp.route("/leaves", methods=["GET"])
@token_required
def api_leaves(current_user):
    leaves = Leave.query.filter_by(requested_by=current_user.id).order_by(Leave.applied_on.desc()).all()
    result = []
    for l in leaves:
        result.append(
            {
                "id": l.id,
                "start_date": l.start_date.strftime("%Y-%m-%d"),
                "end_date": l.end_date.strftime("%Y-%m-%d"),
                "is_emergency": l.is_emergency,
                "status": l.status,
                "reason": l.reason,
                "applied_on": l.applied_on.strftime("%Y-%m-%d %H:%M"),
                "review_comment": l.review_comment,
                "has_proof": bool(l.proof_filename),
                "proof_url": f"/api/v1/leaves/{l.id}/proof" if l.proof_filename else None,
            }
        )
    res = jsonify(result)
    res.headers["Cache-Control"] = "private, max-age=10"
    return res


@bp.route("/ods", methods=["GET"])
@token_required
def api_ods(current_user):
    ods = OD.query.filter_by(requested_by=current_user.id).order_by(OD.applied_on.desc()).all()
    result = []
    seen_dates = set()
    for o in ods:
        seen_dates.add(o.event_date)
        result.append(
            {
                "id": o.id,
                "event_date": o.event_date.strftime("%Y-%m-%d"),
                "status": o.status,
                "reason": o.reason,
                "applied_on": o.applied_on.strftime("%Y-%m-%d %H:%M"),
                "review_comment": o.review_comment,
                "has_proof": bool(o.proof_filename),
                "proof_url": f"/api/v1/ods/{o.id}/proof" if o.proof_filename else None,
            }
        )

    # Also surface direct attendance OD records marked by faculty
    att_ods = AttendanceRecord.query.filter(
        AttendanceRecord.student_id == current_user.id,
        AttendanceRecord.status == AttendanceStatus.OD.value,
        AttendanceRecord.od_id.is_(None),
    ).all()

    for att in att_ods:
        if att.date not in seen_dates:
            result.append(
                {
                    "id": f"ATT-{att.id}",
                    "event_date": att.date.strftime("%Y-%m-%d"),
                    "status": RequestStatus.APPROVED.value,
                    "reason": att.reason or "Faculty Marked On Duty Attendance",
                    "applied_on": att.marked_on.strftime("%Y-%m-%d %H:%M") if att.marked_on else att.date.strftime("%Y-%m-%d 00:00"),
                    "review_comment": "Recorded directly via Class Attendance",
                    "has_proof": False,
                    "proof_url": None,
                }
            )

    res = jsonify(result)
    res.headers["Cache-Control"] = "private, max-age=10"
    return res


@bp.route("/students", methods=["GET"])
@token_required
def api_students(current_user):
    if current_user.role not in (Role.FACULTY.value, Role.MENTOR.value, Role.HOD.value, Role.ADMIN.value):
        return jsonify({"message": "You are not authorized to view the students list."}), 403

    from ..services.attendance import get_student_attendance_summary

    if current_user.role == Role.HOD.value:
        students = (
            User.query.filter_by(_role=Role.STUDENT.value, department_id=current_user.department_id)
            .order_by(User.register_number.asc(), User.full_name.asc(), User.username.asc())
            .all()
        )
    elif current_user.role in (Role.FACULTY.value, Role.MENTOR.value):
        from ..models import ClassGroup
        classes = ClassGroup.query.filter_by(faculty_id=current_user.id).all()
        class_ids = [cg.id for cg in classes]
        students = (
            User.query.filter(
                User._role == Role.STUDENT.value,
                (
                    (User.faculty_id == current_user.id)
                    | (User.mentor_id == current_user.id)
                    | (User.class_group_id.in_(class_ids) if class_ids else False)
                )
            )
            .order_by(User.register_number.asc(), User.full_name.asc(), User.username.asc())
            .all()
        )
        if not students and current_user.department_id:
            students = (
                User.query.filter_by(_role=Role.STUDENT.value, department_id=current_user.department_id)
                .order_by(User.register_number.asc(), User.full_name.asc(), User.username.asc())
                .all()
            )
        if not students:
            students = (
                User.query.filter_by(_role=Role.STUDENT.value)
                .order_by(User.register_number.asc(), User.full_name.asc(), User.username.asc())
                .all()
            )
    else:  # ADMIN
        students = (
            User.query.filter_by(_role=Role.STUDENT.value)
            .order_by(User.register_number.asc(), User.full_name.asc(), User.username.asc())
            .all()
        )

    result = []
    for s in students:
        att_summary = get_student_attendance_summary(s.id)
        leaves_count = Leave.query.filter_by(requested_by=s.id).count()
        ods_count = (
            OD.query.filter_by(requested_by=s.id).count()
            + AttendanceRecord.query.filter(
                AttendanceRecord.student_id == s.id,
                AttendanceRecord.status == AttendanceStatus.OD.value,
                AttendanceRecord.od_id.is_(None),
            ).count()
        )

        class_label = (
            f"Year {s.class_group.year} {s.class_group.section}"
            if s.class_group
            else "-"
        )
        dept_name = s.department.name if s.department else "-"

        result.append(
            {
                "id": s.id,
                "username": s.username,
                "full_name": s.full_name or s.username,
                "register_number": s.register_number or s.username,
                "email": s.email,
                "department": dept_name,
                "class_group": class_label,
                "attendance": {
                    "total_working_days": att_summary["total"],
                    "present_days": att_summary["present"],
                    "absent_days": att_summary["absent"],
                    "leave_days": att_summary["leave"],
                    "od_days": att_summary["od"],
                    "percentage": att_summary["percentage"],
                },
                "leaves_count": leaves_count,
                "ods_count": ods_count,
            }
        )

    res = jsonify(result)
    res.headers["Cache-Control"] = "private, max-age=10"
    return res


@bp.route("/students/<int:student_id>/detail", methods=["GET"])
@token_required
def api_student_detail(current_user, student_id):
    if current_user.role not in (Role.FACULTY.value, Role.MENTOR.value, Role.HOD.value, Role.ADMIN.value):
        return jsonify({"message": "You are not authorized to view student details."}), 403

    student = db.session.get(User, student_id)
    if not student or student.db_role != Role.STUDENT.value:
        return jsonify({"message": "Student not found."}), 404

    from ..services.attendance import get_student_attendance_summary

    att_summary = get_student_attendance_summary(student.id)

    # Leaves history
    leaves = Leave.query.filter_by(requested_by=student.id).order_by(Leave.applied_on.desc()).all()
    leaves_list = []
    for l in leaves:
        leaves_list.append(
            {
                "id": l.id,
                "start_date": l.start_date.strftime("%Y-%m-%d"),
                "end_date": l.end_date.strftime("%Y-%m-%d"),
                "is_emergency": l.is_emergency,
                "status": l.status,
                "reason": l.reason,
                "applied_on": l.applied_on.strftime("%Y-%m-%d %H:%M"),
                "review_comment": l.review_comment,
            }
        )

    # ODs history
    ods = OD.query.filter_by(requested_by=student.id).order_by(OD.applied_on.desc()).all()
    ods_list = []
    seen_dates = set()
    for o in ods:
        seen_dates.add(o.event_date)
        ods_list.append(
            {
                "id": o.id,
                "event_date": o.event_date.strftime("%Y-%m-%d"),
                "status": o.status,
                "reason": o.reason,
                "applied_on": o.applied_on.strftime("%Y-%m-%d %H:%M"),
                "review_comment": o.review_comment,
            }
        )

    att_ods = AttendanceRecord.query.filter(
        AttendanceRecord.student_id == student.id,
        AttendanceRecord.status == AttendanceStatus.OD.value,
        AttendanceRecord.od_id.is_(None),
    ).all()
    for att in att_ods:
        if att.date not in seen_dates:
            ods_list.append(
                {
                    "id": f"ATT-{att.id}",
                    "event_date": att.date.strftime("%Y-%m-%d"),
                    "status": RequestStatus.APPROVED.value,
                    "reason": att.reason or "Faculty Marked On Duty Attendance",
                    "applied_on": att.marked_on.strftime("%Y-%m-%d %H:%M") if att.marked_on else att.date.strftime("%Y-%m-%d 00:00"),
                    "review_comment": "Recorded directly via Class Attendance",
                }
            )

    mentor_name = student.mentor.full_name or student.mentor.username if student.mentor else "Not Assigned"
    faculty_name = student.faculty.full_name or student.faculty.username if student.faculty else "Not Assigned"

    class_label = (
        f"Year {student.class_group.year} {student.class_group.section}"
        if student.class_group
        else "-"
    )
    dept_name = student.department.name if student.department else "-"

    payload = {
        "student": {
            "id": student.id,
            "full_name": student.full_name or student.username,
            "username": student.username,
            "register_number": student.register_number or student.username,
            "email": student.email,
            "department": dept_name,
            "class_group": class_label,
            "mentor_name": mentor_name,
            "faculty_name": faculty_name,
            "father_name": student.father_name,
        },
        "attendance": {
            "total_working_days": att_summary["total"],
            "present_days": att_summary["present"],
            "absent_days": att_summary["absent"],
            "leave_days": att_summary["leave"],
            "od_days": att_summary["od"],
            "percentage": att_summary["percentage"],
        },
        "leaves": leaves_list,
        "ods": ods_list,
    }

    res = jsonify(payload)
    res.headers["Cache-Control"] = "private, max-age=10"
    return res


@bp.route("/pending", methods=["GET"])
@token_required
def api_pending(current_user):
    leaves = []
    ods = []

    if current_user.role == Role.EVENT_COORDINATOR.value:
        leaves = []
        ods = OD.query.filter(
            (OD.event_coordinator_id == current_user.id) | (OD.event_coordinator_id.is_(None)),
            OD.status == RequestStatus.PENDING.value
        ).all()
    elif current_user.role == Role.MENTOR.value:
        leaves = (
            Leave.query.join(User, User.id == Leave.requested_by)
            .filter(User.mentor_id == current_user.id, Leave.status == RequestStatus.PENDING.value)
            .all()
        )
        ods = (
            OD.query.join(User, User.id == OD.requested_by)
            .filter(
                User.mentor_id == current_user.id,
                OD.status.in_([RequestStatus.PENDING.value, RequestStatus.EVENT_COORDINATOR_APPROVED.value])
            )
            .all()
        )
    elif current_user.role == Role.FACULTY.value:
        from ..models import ClassGroup
        class_groups = ClassGroup.query.filter_by(faculty_id=current_user.id).all()
        class_group_ids = [cg.id for cg in class_groups]
        leaves = (
            Leave.query.join(User, User.id == Leave.requested_by)
            .filter(
                (User.faculty_id == current_user.id) | (User.class_group_id.in_(class_group_ids)),
                Leave.status == RequestStatus.MENTOR_APPROVED.value
            )
            .all()
        )
        ods = (
            OD.query.join(User, User.id == OD.requested_by)
            .filter(
                (OD.faculty_id == current_user.id) | (User.faculty_id == current_user.id) | (User.class_group_id.in_(class_group_ids)),
                OD.status == RequestStatus.MENTOR_APPROVED.value
            )
            .all()
        )
    elif current_user.role == Role.HOD.value:
        from ..models import Department
        depts = Department.query.filter_by(hod_id=current_user.id).all()
        dept_ids = [d.id for d in depts]
        if current_user.department_id and current_user.department_id not in dept_ids:
            dept_ids.append(current_user.department_id)
        leaves = (
            Leave.query.join(User, User.id == Leave.requested_by)
            .filter(User.department_id.in_(dept_ids), Leave.status == RequestStatus.FACULTY_APPROVED.value)
            .all()
        )
        ods = (
            OD.query.join(User, User.id == OD.requested_by)
            .filter(User.department_id.in_(dept_ids), OD.status == RequestStatus.FACULTY_APPROVED.value)
            .all()
        )

    leave_data = []
    for l in leaves:
        score, level, reasons = calculate_leave_risk(l)
        leave_data.append({
            "id": l.id,
            "applicant_id": l.requested_by,
            "student_id": l.requested_by,
            "requested_by": l.requested_by,
            "applicant": l.applicant.username,
            "applicant_name": l.applicant.full_name or l.applicant.username,
            "start_date": l.start_date.strftime("%Y-%m-%d"),
            "end_date": l.end_date.strftime("%Y-%m-%d"),
            "reason": l.reason,
            "is_emergency": l.is_emergency,
            "has_proof": bool(l.proof_filename),
            "proof_url": f"/api/v1/leaves/{l.id}/proof" if l.proof_filename else None,
            "risk": {
                "score": score,
                "level": level,
                "reasons": reasons
            }
        })

    od_data = []
    for o in ods:
        score, level, reasons = calculate_od_risk(o)
        od_data.append({
            "id": o.id,
            "applicant_id": o.requested_by,
            "student_id": o.requested_by,
            "requested_by": o.requested_by,
            "applicant": o.applicant.username,
            "applicant_name": o.applicant.full_name or o.applicant.username,
            "event_date": o.event_date.strftime("%Y-%m-%d"),
            "reason": o.reason,
            "has_proof": bool(o.proof_filename),
            "proof_url": f"/api/v1/ods/{o.id}/proof" if o.proof_filename else None,
            "risk": {
                "score": score,
                "level": level,
                "reasons": reasons
            }
        })

    return jsonify({"pending_leaves": leave_data, "pending_ods": od_data})


@bp.route("/leaves", methods=["POST"])
@token_required
def api_create_leave(current_user):
    from datetime import datetime
    from flask import current_app
    from ..services.workflows import submit_leave_request
    from ..services.uploads import save_uploaded_file, validate_uploaded_proof

    if request.files:
        data = request.form
        start_str = data.get("start_date", "")
        end_str = data.get("end_date", "")
        reason = data.get("reason", "").strip()
        is_emergency = data.get("is_emergency", "false").lower() in ("true", "1")
        proof = request.files.get("proof")
    else:
        data = request.get_json() or {}
        start_str = data.get("start_date", "")
        end_str = data.get("end_date", "")
        reason = data.get("reason", "").strip()
        is_emergency = bool(data.get("is_emergency", False))
        proof = None

    if not start_str or not end_str or not reason:
        return jsonify({"message": "start_date, end_date, and reason are required"}), 400

    try:
        start_date = datetime.strptime(start_str, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"message": "Invalid date format, use YYYY-MM-DD"}), 400

    if end_date < start_date:
        return jsonify({"message": "end_date cannot be earlier than start_date"}), 400

    success, leave, response = submit_leave_request(current_user, start_date, end_date, reason, is_emergency)
    if not success:
        return jsonify({"message": response[0] if response else "Failed to submit leave"}), 400

    if proof and proof.filename:
        proof_filename, proof_mimetype, proof_err = validate_uploaded_proof(proof)
        if not proof_err:
            prefix = current_app.config.get("LEAVE_UPLOAD_PREFIX", "leave_proofs")
            save_uploaded_file(proof, prefix, proof_filename, proof_mimetype)
            leave.proof_filename = proof_filename
            leave.proof_mimetype = proof_mimetype
            leave.proof_uploaded_on = utcnow()
            db.session.commit()

    return jsonify({"message": "Leave request submitted successfully", "leave_id": leave.id}), 201


@bp.route("/ods", methods=["POST"])
@token_required
def api_create_od(current_user):
    from datetime import datetime
    from flask import current_app
    from ..models import OD, RequestStatus
    from ..services.uploads import save_uploaded_file, validate_uploaded_proof

    if request.files:
        data = request.form
        event_str = data.get("event_date", "")
        reason = data.get("reason", "").strip()
        proof = request.files.get("proof")
    else:
        data = request.get_json() or {}
        event_str = data.get("event_date", "")
        reason = data.get("reason", "").strip()
        proof = None

    if not event_str or not reason:
        return jsonify({"message": "event_date and reason are required"}), 400

    try:
        event_date = datetime.strptime(event_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"message": "Invalid date format, use YYYY-MM-DD"}), 400

    fac_id = current_user.class_group.faculty_id if (current_user.class_group and current_user.class_group.faculty_id) else current_user.faculty_id

    od = OD(
        requested_by=current_user.id,
        faculty_id=fac_id,
        event_date=event_date,
        reason=reason,
        status=RequestStatus.PENDING.value,
    )

    if proof and proof.filename:
        proof_filename, proof_mimetype, proof_err = validate_uploaded_proof(proof)
        if not proof_err:
            prefix = current_app.config.get("OD_UPLOAD_PREFIX", "od_proofs")
            save_uploaded_file(proof, prefix, proof_filename, proof_mimetype)
            od.proof_filename = proof_filename
            od.proof_mimetype = proof_mimetype

    db.session.add(od)
    db.session.commit()

    return jsonify({"message": "OD request submitted successfully", "od_id": od.id}), 201


@bp.route("/leaves/<int:leave_id>/proof", methods=["GET"])
@token_required
def api_leave_proof(current_user, leave_id):
    from flask import current_app
    from ..models import Leave
    from ..services.uploads import build_file_response, uploaded_file_exists
    from ..services.workflows import leave_proof_access_allowed

    leave = db.session.get(Leave, leave_id)
    if not leave or not leave.proof_filename:
        return jsonify({"message": "Proof document not found for this leave"}), 404

    if not leave_proof_access_allowed(current_user, leave):
        return jsonify({"message": "Forbidden: You are not authorized to view this proof document"}), 403

    prefix = current_app.config.get("LEAVE_UPLOAD_PREFIX", "leave_proofs")
    if not uploaded_file_exists(prefix, leave.proof_filename):
        return jsonify({"message": "Proof file missing on server"}), 404

    return build_file_response(prefix, leave.proof_filename, leave.proof_mimetype)


@bp.route("/leaves/<int:leave_id>/proof", methods=["POST"])
@token_required
def api_upload_leave_proof(current_user, leave_id):
    from flask import current_app
    from ..models import Leave
    from ..services.uploads import save_uploaded_file, validate_uploaded_proof

    leave = db.session.get(Leave, leave_id)
    if not leave:
        return jsonify({"message": "Leave request not found"}), 404

    if leave.requested_by != current_user.id and current_user.role != Role.ADMIN.value:
        return jsonify({"message": "Forbidden: You are not authorized to upload proof for this leave"}), 403

    proof = request.files.get("proof")
    if not proof or not proof.filename:
        return jsonify({"message": "Proof document file is required"}), 400

    proof_filename, proof_mimetype, proof_err = validate_uploaded_proof(proof)
    if proof_err:
        return jsonify({"message": proof_err}), 400

    prefix = current_app.config.get("LEAVE_UPLOAD_PREFIX", "leave_proofs")
    save_uploaded_file(proof, prefix, proof_filename, proof_mimetype)

    leave.proof_filename = proof_filename
    leave.proof_mimetype = proof_mimetype
    leave.proof_uploaded_on = utcnow()
    db.session.commit()

    return jsonify({"message": "Proof document uploaded successfully", "proof_url": f"/api/v1/leaves/{leave.id}/proof"})


@bp.route("/ods/<int:od_id>/proof", methods=["GET"])
@token_required
def api_od_proof(current_user, od_id):
    from flask import current_app
    from ..models import OD
    from ..services.uploads import build_file_response, uploaded_file_exists

    od = db.session.get(OD, od_id)
    if not od or not od.proof_filename:
        return jsonify({"message": "Proof document not found for this OD"}), 404

    prefix = current_app.config.get("OD_UPLOAD_PREFIX", "od_proofs")
    if not uploaded_file_exists(prefix, od.proof_filename):
        return jsonify({"message": "Proof file missing on server"}), 404

    return build_file_response(prefix, od.proof_filename, od.proof_mimetype)


@bp.route("/ods/<int:od_id>/proof", methods=["POST"])
@token_required
def api_upload_od_proof(current_user, od_id):
    from flask import current_app
    from ..models import OD
    from ..services.uploads import save_uploaded_file, validate_uploaded_proof

    od = db.session.get(OD, od_id)
    if not od:
        return jsonify({"message": "OD request not found"}), 404

    if od.requested_by != current_user.id and current_user.role != Role.ADMIN.value:
        return jsonify({"message": "Forbidden: You are not authorized to upload proof for this OD request"}), 403

    proof = request.files.get("proof")
    if not proof or not proof.filename:
        return jsonify({"message": "Proof document file is required"}), 400

    proof_filename, proof_mimetype, proof_err = validate_uploaded_proof(proof)
    if proof_err:
        return jsonify({"message": proof_err}), 400

    prefix = current_app.config.get("OD_UPLOAD_PREFIX", "od_proofs")
    save_uploaded_file(proof, prefix, proof_filename, proof_mimetype)

    od.proof_filename = proof_filename
    od.proof_mimetype = proof_mimetype
    od.proof_uploaded_on = utcnow()
    db.session.commit()

    return jsonify({"message": "Proof document uploaded successfully", "proof_url": f"/api/v1/ods/{od.id}/proof"})


@bp.route("/leaves/<int:leave_id>/review", methods=["POST"])
@token_required
def api_review_leave(current_user, leave_id):
    from ..services.workflows import apply_leave_review

    data = request.get_json() or {}
    action = data.get("action", "").upper()
    comment = data.get("comment", "").strip()

    if action not in ("APPROVE", "REJECT"):
        return jsonify({"message": "Action must be APPROVE or REJECT"}), 400

    success, message = apply_leave_review(leave_id, current_user.id, action, comment)
    if not success:
        return jsonify({"message": message[0] if isinstance(message, tuple) else str(message)}), 400

    return jsonify({"message": "Review submitted successfully"})


@bp.route("/profile", methods=["GET"])
@token_required
def api_profile(current_user):
    mentor_name = None
    try:
        if getattr(current_user, "mentor", None):
            mentor_name = current_user.mentor.full_name or current_user.mentor.username
    except Exception:
        mentor_name = None

    faculty_adv = None
    try:
        if getattr(current_user, "faculty", None):
            faculty_adv = current_user.faculty.full_name or current_user.faculty.username
        elif getattr(current_user, "class_group", None) and getattr(current_user.class_group, "faculty", None):
            faculty_adv = current_user.class_group.faculty.full_name or current_user.class_group.faculty.username
    except Exception:
        faculty_adv = None

    dept_name = None
    try:
        if getattr(current_user, "department", None):
            dept_name = current_user.department.name
    except Exception:
        dept_name = None

    dob_str = None
    try:
        dob = getattr(current_user, "date_of_birth", None)
        if dob:
            if hasattr(dob, "strftime"):
                dob_str = dob.strftime("%Y-%m-%d")
            else:
                dob_str = str(dob)
    except Exception:
        dob_str = None

    class_group_name = None
    try:
        if getattr(current_user, "class_group", None):
            cg = current_user.class_group
            class_group_name = f"Year {cg.year} - Sec {cg.section}"
        elif getattr(current_user, "assigned_classes", None):
            ac = current_user.assigned_classes
            class_group_name = f"Year {ac.year} - Sec {ac.section}"
    except Exception:
        class_group_name = None

    assigned_students_count = 0
    try:
        role_normalized = (getattr(current_user, "role", "student") or "student").lower()
        if role_normalized == "mentor":
            assigned_students_count = User.query.filter_by(mentor_id=current_user.id, _role=Role.STUDENT.value).count()
        elif role_normalized == "faculty":
            if getattr(current_user, "assigned_classes", None):
                assigned_students_count = User.query.filter_by(class_group_id=current_user.assigned_classes.id, _role=Role.STUDENT.value).count()
            else:
                assigned_students_count = User.query.filter_by(faculty_id=current_user.id, _role=Role.STUDENT.value).count()
        elif role_normalized == "hod":
            if current_user.department_id:
                assigned_students_count = User.query.filter_by(department_id=current_user.department_id, _role=Role.STUDENT.value).count()
    except Exception:
        assigned_students_count = 0

    return jsonify({
        "id": current_user.id,
        "username": current_user.username or "",
        "full_name": current_user.full_name or current_user.username or "User Account",
        "email": current_user.email or "",
        "role": getattr(current_user, "role", "student"),
        "db_role": getattr(current_user, "db_role", "student"),
        "department": dept_name or "General Department",
        "mentor_name": mentor_name or "Not assigned",
        "faculty_advisor": faculty_adv or "Not assigned",
        "roll_number": getattr(current_user, "register_number", None) or current_user.username or "N/A",
        "father_name": getattr(current_user, "father_name", None) or "Not specified",
        "date_of_birth": dob_str or "Not specified",
        "class_group_name": class_group_name or "N/A",
        "assigned_students_count": assigned_students_count,
    })


@bp.route("/auth/change-password", methods=["POST"])
@token_required
def api_change_password(current_user):
    data = request.get_json() or {}
    old_password = data.get("old_password", "")
    new_password = data.get("new_password", "")
    confirm_password = data.get("confirm_password", "")

    if not old_password or not new_password:
        return jsonify({"message": "Current password and new password are required"}), 400

    if not current_user.check_password(old_password):
        return jsonify({"message": "Incorrect current password"}), 400

    if len(new_password) < 6:
        return jsonify({"message": "New password must be at least 6 characters long"}), 400

    if confirm_password and new_password != confirm_password:
        return jsonify({"message": "New password and confirmation password do not match"}), 400

    current_user.set_password(new_password)
    db.session.commit()

    from ..services.audit import log_audit_event
    log_audit_event("PASSWORD_CHANGED", current_user)

    return jsonify({"message": "Password changed successfully"})


@bp.route("/attendance", methods=["GET"])
@token_required
def api_attendance(current_user):
    if current_user.role not in (Role.FACULTY.value, Role.HOD.value):
        return jsonify({"message": "Forbidden: Attendance functionality is restricted to Class Faculty and HODs"}), 403

    from ..models import ClassGroup
    if current_user.role == Role.HOD.value:
        class_groups = ClassGroup.query.filter_by(department_id=current_user.department_id).order_by(ClassGroup.year.asc(), ClassGroup.section.asc()).all()
    else:
        class_groups = ClassGroup.query.filter_by(faculty_id=current_user.id).order_by(ClassGroup.year.asc(), ClassGroup.section.asc()).all()
        if not class_groups and current_user.class_group_id:
            cg = db.session.get(ClassGroup, current_user.class_group_id)
            if cg:
                class_groups = [cg]

    cg_data = [{"id": cg.id, "year": cg.year, "section": cg.section, "department": cg.department.name if cg.department else ""} for cg in class_groups]

    return jsonify({"class_groups": cg_data})


@bp.route("/attendance/sheet", methods=["GET"])
@token_required
def api_attendance_sheet(current_user):
    if current_user.role not in (Role.FACULTY.value, Role.HOD.value):
        return jsonify({"message": "Forbidden: Attendance functionality is restricted to Class Faculty and HODs"}), 403

    from datetime import datetime
    from ..models import ClassGroup
    from ..services.attendance import get_attendance_sheet

    class_id = request.args.get("class_id", type=int)
    date_str = request.args.get("date", "").strip()

    if not class_id:
        return jsonify({"message": "class_id query parameter is required"}), 400

    cg = db.session.get(ClassGroup, class_id)
    if not cg:
        return jsonify({"message": "Class group not found"}), 404

    # Strict Class Faculty Check for Faculty role
    if current_user.role == Role.FACULTY.value:
        if cg.faculty_id != current_user.id and current_user.class_group_id != cg.id:
            return jsonify({"message": "Forbidden: You are only authorized to access attendance for your assigned class cohort"}), 403
    elif current_user.role == Role.HOD.value:
        if cg.department_id != current_user.department_id:
            return jsonify({"message": "Forbidden: Class group does not belong to your department"}), 403

    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date() if date_str else utcnow().date()
    except ValueError:
        target_date = utcnow().date()

    raw_sheet = get_attendance_sheet(class_id, target_date)
    sheet_data = []
    for item in raw_sheet:
        st = item["student"]
        sheet_data.append({
            "student_id": st.id,
            "name": st.full_name or st.username,
            "roll_number": st.register_number or st.username,
            "status": item["status"],
            "reason": item["reason"],
            "leave_id": item["leave_id"],
            "od_id": item["od_id"],
            "is_auto": item["is_auto"],
        })

    return jsonify({
        "class_id": class_id,
        "date": target_date.strftime("%Y-%m-%d"),
        "sheet": sheet_data
    })


@bp.route("/attendance/mark", methods=["POST"])
@token_required
def api_attendance_mark(current_user):
    if current_user.role not in (Role.FACULTY.value, Role.HOD.value):
        return jsonify({"message": "Forbidden: Attendance marking is restricted to Class Faculty"}), 403

    from datetime import datetime
    from ..models import ClassGroup
    from ..services.attendance import save_attendance_sheet

    data = request.get_json() or {}
    class_id = data.get("class_id")
    date_str = data.get("date", "").strip()
    records = data.get("records", [])

    if not class_id or not date_str:
        return jsonify({"message": "class_id and date are required"}), 400

    cg = db.session.get(ClassGroup, class_id)
    if not cg:
        return jsonify({"message": "Class group not found"}), 404

    # Strict Class Faculty Check for Faculty role
    if current_user.role == Role.FACULTY.value:
        if cg.faculty_id != current_user.id and current_user.class_group_id != cg.id:
            return jsonify({"message": "Forbidden: You are only authorized to mark attendance for your assigned class cohort"}), 403
    elif current_user.role == Role.HOD.value:
        if cg.department_id != current_user.department_id:
            return jsonify({"message": "Forbidden: Class group does not belong to your department"}), 403

    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"message": "Invalid date format, use YYYY-MM-DD"}), 400

    records_data = {}
    for r in records:
        sid = r.get("student_id")
        if sid:
            records_data[sid] = {
                "status": r.get("status", "PRESENT"),
                "reason": r.get("reason", ""),
                "leave_id": r.get("leave_id"),
                "od_id": r.get("od_id"),
            }

    count = save_attendance_sheet(class_id, target_date, records_data, current_user)
    return jsonify({"message": f"Successfully saved attendance for {count} student(s) on {target_date.strftime('%Y-%m-%d')}"})


# ============================================================
# ADMIN REST APIs
# ============================================================

def admin_token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("X-API-Token")
        if not token:
            return jsonify({"message": "Token is missing"}), 401
        hashed = hash_token(token)
        api_token = APIToken.query.filter_by(hashed_token=hashed, is_revoked=False).first()
        if not api_token or not api_token.expires_at or api_token.expires_at < utcnow():
            return jsonify({"message": "Token is invalid or expired"}), 401
        if api_token.user.role != Role.ADMIN.value:
            return jsonify({"message": "Forbidden: Admin privileges required"}), 403
        return f(api_token.user, *args, **kwargs)
    return decorated


@bp.route("/admin/stats", methods=["GET"])
@admin_token_required
def api_admin_stats(current_user):
    from ..models import ClassGroup, Department, Leave, OD, Role, User
    return jsonify({
        "total_users": User.query.count(),
        "total_students": User.query.filter_by(role=Role.STUDENT.value).count(),
        "total_faculty": User.query.filter_by(role=Role.FACULTY.value).count(),
        "total_departments": Department.query.count(),
        "total_classes": ClassGroup.query.count(),
        "total_leaves": Leave.query.count(),
        "total_ods": OD.query.count(),
    })


@bp.route("/admin/users", methods=["GET"])
@admin_token_required
def api_admin_get_users(current_user):
    from ..models import ClassGroup, Department, User
    role_filter = request.args.get("role", "").strip()
    dept_id = request.args.get("department_id", type=int)

    query = User.query
    if role_filter:
        query = query.filter(User.role == role_filter)
    if dept_id:
        query = query.filter(User.department_id == dept_id)

    users = query.order_by(User.role.asc(), User.full_name.asc(), User.username.asc()).all()
    user_list = []
    for u in users:
        dept_name = u.department.name if u.department else "N/A"
        class_name = f"{u.class_group.department.name if u.class_group and u.class_group.department else ''} Y{u.class_group.year}{u.class_group.section}" if u.class_group else "N/A"
        mentor_name = u.mentor.full_name or u.mentor.username if u.mentor else "N/A"

        user_list.append({
            "id": u.id,
            "full_name": u.full_name or u.username,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "department_id": u.department_id,
            "department_name": dept_name,
            "class_group_id": u.class_group_id,
            "class_name": class_name,
            "mentor_id": u.mentor_id,
            "mentor_name": mentor_name,
            "register_number": u.register_number,
            "is_blocked": u.is_blocked,
        })
    return jsonify(user_list)


@bp.route("/admin/users", methods=["POST"])
@admin_token_required
def api_admin_create_user(current_user):
    from datetime import datetime
    from ..models import ClassGroup, Department, Role, User

    data = request.get_json() or {}
    full_name = data.get("full_name", "").strip()
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", Role.STUDENT.value)

    if not full_name or not username or not email or not password:
        return jsonify({"message": "Full name, username, email, and password are required"}), 400

    valid_roles = {r.value for r in Role}
    if role not in valid_roles:
        return jsonify({"message": "Invalid role specified"}), 400

    if User.query.filter((User.username == username) | (User.email == email)).first():
        return jsonify({"message": "A user with that username or email already exists"}), 400

    register_number = None
    dob = None
    father_name = None

    if role == Role.STUDENT.value:
        register_number = data.get("register_number", "").strip()
        dob_raw = data.get("date_of_birth", "").strip()
        father_name = data.get("father_name", "").strip()

        if register_number and User.query.filter_by(register_number=register_number).first():
            return jsonify({"message": "A student with that register number already exists"}), 400

        if dob_raw:
            try:
                dob = datetime.strptime(dob_raw, "%Y-%m-%d").date()
            except ValueError:
                return jsonify({"message": "Invalid date of birth format, use YYYY-MM-DD"}), 400

    dept_id = data.get("department_id") if isinstance(data.get("department_id"), int) else None
    class_id = data.get("class_group_id") if isinstance(data.get("class_group_id"), int) else None

    new_user = User(
        full_name=full_name,
        username=username,
        email=email,
        role=role,
        register_number=register_number,
        date_of_birth=dob,
        father_name=father_name,
        department_id=dept_id,
        class_group_id=class_id,
    )
    new_user.set_password(password)

    db.session.add(new_user)
    db.session.flush()

    if role == Role.HOD.value and dept_id:
        dept = db.session.get(Department, dept_id)
        if dept:
            dept.hod_id = new_user.id

    if role == Role.FACULTY.value and class_id:
        cg = db.session.get(ClassGroup, class_id)
        if cg:
            cg.faculty_id = new_user.id

    db.session.commit()
    return jsonify({"message": f"{role.capitalize()} user created successfully", "user_id": new_user.id}), 201


@bp.route("/admin/users/<int:user_id>", methods=["DELETE"])
@admin_token_required
def api_admin_delete_user(current_user, user_id):
    from ..models import ClassGroup, Department, Role, User
    from .admin import _delete_user_related_records

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404

    if user.id == current_user.id:
        return jsonify({"message": "Cannot delete the active admin account"}), 400

    if user.role == Role.ADMIN.value:
        if User.query.filter_by(role=Role.ADMIN.value).count() <= 1:
            return jsonify({"message": "At least one admin account must remain"}), 400

    leave_count, od_count = _delete_user_related_records(user)
    Department.query.filter_by(hod_id=user.id).update({"hod_id": None}, synchronize_session=False)
    ClassGroup.query.filter_by(faculty_id=user.id).update({"faculty_id": None}, synchronize_session=False)

    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": f"Deleted user '{user.full_name or user.username}' ({leave_count} leaves, {od_count} ODs removed)"})


@bp.route("/admin/departments", methods=["GET", "POST"])
@admin_token_required
def api_admin_departments(current_user):
    from ..models import Department, Role, User

    if request.method == "POST":
        data = request.get_json() or {}
        name = data.get("name", "").strip()
        if not name:
            return jsonify({"message": "Department name is required"}), 400

        if Department.query.filter(db.func.lower(Department.name) == name.lower()).first():
            return jsonify({"message": "Department already exists"}), 400

        dept = Department(name=name)
        db.session.add(dept)
        db.session.commit()
        return jsonify({"message": "Department created successfully", "department_id": dept.id}), 201

    departments = Department.query.order_by(Department.name.asc()).all()
    result = []
    for d in departments:
        hod_name = d.hod.full_name or d.hod.username if d.hod else "Unassigned"
        result.append({
            "id": d.id,
            "name": d.name,
            "hod_id": d.hod_id,
            "hod_name": hod_name,
            "class_count": len(d.classes),
            "student_count": User.query.filter_by(department_id=d.id, role=Role.STUDENT.value).count(),
        })
    return jsonify(result)


@bp.route("/admin/classes", methods=["GET", "POST"])
@admin_token_required
def api_admin_classes(current_user):
    from ..models import ClassGroup, Department, Role, User

    if request.method == "POST":
        data = request.get_json() or {}
        dept_id = data.get("department_id")
        year = data.get("year")
        section = data.get("section", "").strip().upper()

        if not dept_id or not year or not section:
            return jsonify({"message": "department_id, year, and section are required"}), 400

        if ClassGroup.query.filter_by(department_id=dept_id, year=year, section=section).first():
            return jsonify({"message": "Class group already exists"}), 400

        cg = ClassGroup(department_id=dept_id, year=year, section=section)
        db.session.add(cg)
        db.session.commit()
        return jsonify({"message": "Class group created successfully", "class_id": cg.id}), 201

    classes = ClassGroup.query.order_by(ClassGroup.department_id, ClassGroup.year, ClassGroup.section).all()
    result = []
    for c in classes:
        dept_name = c.department.name if c.department else "N/A"
        faculty_name = c.faculty.full_name or c.faculty.username if c.faculty else "Unassigned"
        result.append({
            "id": c.id,
            "department_id": c.department_id,
            "department_name": dept_name,
            "year": c.year,
            "section": c.section,
            "faculty_id": c.faculty_id,
            "faculty_name": faculty_name,
            "student_count": User.query.filter_by(class_group_id=c.id, role=Role.STUDENT.value).count(),
        })
    return jsonify(result)


@bp.route("/admin/assign-hod", methods=["POST"])
@admin_token_required
def api_admin_assign_hod(current_user):
    from ..models import Department, Role, User

    data = request.get_json() or {}
    dept_id = data.get("department_id")
    hod_id = data.get("hod_user_id")

    dept = db.session.get(Department, dept_id)
    hod_user = db.session.get(User, hod_id)

    if not dept or not hod_user or hod_user.db_role not in (Role.HOD.value, Role.FACULTY.value):
        return jsonify({"message": "Invalid department or HOD user"}), 400

    dept.hod_id = hod_user.id
    hod_user.department_id = dept.id
    db.session.commit()
    return jsonify({"message": f"Assigned HOD {hod_user.full_name or hod_user.username} to {dept.name}"})


@bp.route("/admin/assign-faculty", methods=["POST"])
@admin_token_required
def api_admin_assign_faculty(current_user):
    from ..models import ClassGroup, Role, User

    data = request.get_json() or {}
    class_id = data.get("class_group_id")
    faculty_id = data.get("faculty_id")

    cg = db.session.get(ClassGroup, class_id)
    fac_user = db.session.get(User, faculty_id)

    if not cg or not fac_user or fac_user.db_role not in (Role.FACULTY.value, Role.MENTOR.value, Role.HOD.value):
        return jsonify({"message": "Invalid class group or faculty user"}), 400

    cg.faculty_id = fac_user.id
    fac_user.department_id = cg.department_id
    db.session.commit()
    return jsonify({"message": f"Assigned Faculty {fac_user.full_name or fac_user.username} to Y{cg.year}{cg.section}"})


@bp.route("/admin/assign-mentor", methods=["POST"])
@admin_token_required
def api_admin_assign_mentor(current_user):
    from ..models import Role, User

    data = request.get_json() or {}
    student_ids = data.get("student_ids", [])
    mentor_id = data.get("mentor_id")

    if not student_ids or not mentor_id:
        return jsonify({"message": "student_ids and mentor_id are required"}), 400

    mentor = db.session.get(User, mentor_id)
    if not mentor or mentor.db_role not in (Role.MENTOR.value, Role.FACULTY.value):
        return jsonify({"message": "Invalid Mentor selected"}), 400

    updated = 0
    for sid in student_ids:
        st = db.session.get(User, sid)
        if st and st.role == Role.STUDENT.value:
            st.mentor_id = mentor.id
            updated += 1

    db.session.commit()
    return jsonify({"message": f"Assigned Mentor {mentor.full_name or mentor.username} to {updated} student(s)"})


@bp.route("/admin/all-leaves", methods=["GET"])
@admin_token_required
def api_admin_all_leaves(current_user):
    from ..models import Leave
    leaves = Leave.query.order_by(Leave.applied_on.desc()).all()
    result = []
    for l in leaves:
        result.append({
            "id": l.id,
            "applicant": l.requester.full_name or l.requester.username if l.requester else "Unknown",
            "start_date": l.start_date.strftime("%Y-%m-%d"),
            "end_date": l.end_date.strftime("%Y-%m-%d"),
            "reason": l.reason,
            "is_emergency": l.is_emergency,
            "status": l.status,
            "applied_on": l.applied_on.strftime("%Y-%m-%d %H:%M"),
        })
    return jsonify(result)


@bp.route("/admin/clear-all-leaves", methods=["POST"])
@admin_token_required
def api_admin_clear_all_leaves(current_user):
    from ..models import Leave
    from .admin import _delete_leave_records
    leaves = Leave.query.all()
    deleted_count = _delete_leave_records(leaves, restore_balance=True)
    db.session.commit()
    return jsonify({"message": f"Cleared {deleted_count} leave record(s) and restored leave balances."})


@bp.route("/admin/all-ods", methods=["GET"])
@admin_token_required
def api_admin_all_ods(current_user):
    from ..models import OD
    ods = OD.query.order_by(OD.applied_on.desc()).all()
    result = []
    for o in ods:
        result.append({
            "id": o.id,
            "applicant": o.requester.full_name or o.requester.username if o.requester else "Unknown",
            "event_date": o.event_date.strftime("%Y-%m-%d"),
            "reason": o.reason,
            "status": o.status,
            "applied_on": o.applied_on.strftime("%Y-%m-%d %H:%M"),
        })
    return jsonify(result)



@bp.route("/admin/clear-all-ods", methods=["POST"])
@admin_token_required
def api_admin_clear_all_ods(current_user):
    from ..models import OD
    from .admin import _delete_od_records
    ods = OD.query.all()
    deleted_count = _delete_od_records(ods)
    db.session.commit()
    return jsonify({"message": f"Cleared {deleted_count} OD record(s)."})


@bp.route("/admin/users/<int:user_id>/toggle-block", methods=["POST"])
@admin_token_required
def api_admin_toggle_block_user(current_user, user_id):
    from ..models import User
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404
    if user.id == current_user.id:
        return jsonify({"message": "You cannot block your own admin account"}), 400

    user.is_blocked = not user.is_blocked
    db.session.commit()
    status_str = "blocked" if user.is_blocked else "unblocked"
    return jsonify({"message": f"User '{user.full_name or user.username}' has been {status_str}."})


@bp.route("/admin/leaves/<int:leave_id>/review", methods=["POST"])
@admin_token_required
def api_admin_review_leave(current_user, leave_id):
    from ..models import Leave, RequestStatus
    leave = db.session.get(Leave, leave_id)
    if not leave:
        return jsonify({"message": "Leave request not found"}), 404

    data = request.get_json() or {}
    action = data.get("action", "").upper()
    comment = data.get("comment", "").strip() or "Admin action override"

    if action not in ("APPROVE", "REJECT"):
        return jsonify({"message": "Action must be APPROVE or REJECT"}), 400

    if action == "APPROVE":
        leave.status = RequestStatus.APPROVED.value
    else:
        leave.status = RequestStatus.REJECTED.value

    leave.approved_by = current_user.id
    leave.review_comment = f"[ADMIN OVERRIDE] {comment}"
    leave.reviewed_on = utcnow()
    db.session.commit()
    return jsonify({"message": f"Leave #{leave_id} set to {leave.status} by Admin."})


@bp.route("/admin/ods/<int:od_id>/review", methods=["POST"])
@admin_token_required
def api_admin_review_od(current_user, od_id):
    from ..models import OD, RequestStatus
    od = db.session.get(OD, od_id)
    if not od:
        return jsonify({"message": "OD request not found"}), 404

    data = request.get_json() or {}
    action = data.get("action", "").upper()
    comment = data.get("comment", "").strip() or "Admin action override"

    if action not in ("APPROVE", "REJECT"):
        return jsonify({"message": "Action must be APPROVE or REJECT"}), 400

    if action == "APPROVE":
        od.status = RequestStatus.APPROVED.value
    else:
        od.status = RequestStatus.REJECTED.value

    od.approved_by = current_user.id
    od.review_comment = f"[ADMIN OVERRIDE] {comment}"
    od.reviewed_on = utcnow()
    db.session.commit()
    return jsonify({"message": f"OD #{od_id} set to {od.status} by Admin."})


@bp.route("/admin/audit-logs", methods=["GET"])
@admin_token_required
def api_admin_audit_logs(current_user):
    from ..models import AuditLog
    logs = AuditLog.query.order_by(AuditLog.timestamp.desc()).limit(100).all()
    result = []
    for log in logs:
        actor_name = log.actor.full_name or log.actor.username if log.actor else "System"
        result.append({
            "id": log.id,
            "timestamp": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "actor": actor_name,
            "action": log.action,
            "target_type": log.target_type or "N/A",
            "target_id": log.target_id,
            "ip_address": log.ip_address or "unknown",
            "details": log.details or "",
        })
    return jsonify(result)



@bp.route("/notifications", methods=["GET"])
@token_required
def api_notifications(current_user):
    from ..models import AuditLog, Leave, OD, RequestStatus
    notifications = []
    read_at = current_user.notifications_read_at

    def is_unread(dt):
        if not dt:
            return False
        if not read_at:
            return True
        return dt > read_at

    # 1. FOR ALL USERS (especially Students): Leaves applied by user
    user_leaves = Leave.query.filter_by(requested_by=current_user.id).order_by(Leave.applied_on.desc()).limit(15).all()
    for l in user_leaves:
        status_text = "approved" if l.status == RequestStatus.APPROVED.value else "rejected" if l.status == RequestStatus.REJECTED.value else f"status updated to {l.status}"
        
        notifications.append({
            "id": f"leave-{l.id}",
            "title": f"Leave Request #{l.id} ({l.status})",
            "message": f"Your leave request for {l.start_date.strftime('%Y-%m-%d')} to {l.end_date.strftime('%Y-%m-%d')} has been {status_text}.",
            "time": l.applied_on.strftime("%Y-%m-%d %H:%M"),
            "type": "leave",
            "unread": is_unread(l.applied_on),
            "link": "/my-leaves"
        })

    # 2. FOR ALL USERS (especially Students): ODs applied by user
    user_ods = OD.query.filter_by(requested_by=current_user.id).order_by(OD.applied_on.desc()).limit(15).all()
    for o in user_ods:
        status_text = "approved" if o.status == RequestStatus.APPROVED.value else "rejected" if o.status == RequestStatus.REJECTED.value else f"status updated to {o.status}"

        notifications.append({
            "id": f"od-{o.id}",
            "title": f"OD Request #{o.id} ({o.status})",
            "message": f"Your OD request for {o.event_date.strftime('%Y-%m-%d')} has been {status_text}.",
            "time": o.applied_on.strftime("%Y-%m-%d %H:%M"),
            "type": "od",
            "unread": is_unread(o.applied_on),
            "link": "/my-ods"
        })

    # 3. FOR APPROVERS (Faculty / Mentor / HOD / Event Coordinator / Admin): Pending Queue Notifications
    if current_user.role in (Role.FACULTY.value, Role.MENTOR.value, Role.HOD.value, Role.EVENT_COORDINATOR.value, Role.ADMIN.value):
        pending_leaves = []
        pending_ods = []

        if current_user.role == Role.EVENT_COORDINATOR.value:
            pending_ods = OD.query.filter(
                (OD.event_coordinator_id == current_user.id) | (OD.event_coordinator_id.is_(None)),
                OD.status == RequestStatus.PENDING.value
            ).order_by(OD.applied_on.desc()).limit(10).all()
        elif current_user.role == Role.MENTOR.value:
            pending_leaves = Leave.query.join(User, User.id == Leave.requested_by).filter(
                User.mentor_id == current_user.id, Leave.status == RequestStatus.PENDING.value
            ).order_by(Leave.applied_on.desc()).limit(10).all()

            pending_ods = OD.query.join(User, User.id == OD.requested_by).filter(
                User.mentor_id == current_user.id,
                OD.status.in_([RequestStatus.PENDING.value, RequestStatus.EVENT_COORDINATOR_APPROVED.value])
            ).order_by(OD.applied_on.desc()).limit(10).all()
        elif current_user.role == Role.FACULTY.value:
            from ..models import ClassGroup
            classes = ClassGroup.query.filter_by(faculty_id=current_user.id).all()
            class_ids = [cg.id for cg in classes]
            pending_leaves = Leave.query.join(User, User.id == Leave.requested_by).filter(
                (User.faculty_id == current_user.id) | (User.class_group_id.in_(class_ids) if class_ids else False),
                Leave.status == RequestStatus.MENTOR_APPROVED.value
            ).order_by(Leave.applied_on.desc()).limit(10).all()

            pending_ods = OD.query.join(User, User.id == OD.requested_by).filter(
                (OD.faculty_id == current_user.id) | (User.faculty_id == current_user.id) | (User.class_group_id.in_(class_ids) if class_ids else False),
                OD.status == RequestStatus.MENTOR_APPROVED.value
            ).order_by(OD.applied_on.desc()).limit(10).all()
        elif current_user.role == Role.HOD.value:
            from ..models import Department
            depts = Department.query.filter_by(hod_id=current_user.id).all()
            dept_ids = [d.id for d in depts]
            if current_user.department_id and current_user.department_id not in dept_ids:
                dept_ids.append(current_user.department_id)

            pending_leaves = Leave.query.join(User, User.id == Leave.requested_by).filter(
                User.department_id.in_(dept_ids), Leave.status == RequestStatus.FACULTY_APPROVED.value
            ).order_by(Leave.applied_on.desc()).limit(10).all()

            pending_ods = OD.query.join(User, User.id == OD.requested_by).filter(
                User.department_id.in_(dept_ids), OD.status == RequestStatus.FACULTY_APPROVED.value
            ).order_by(OD.applied_on.desc()).limit(10).all()
        elif current_user.role == Role.ADMIN.value:
            pending_leaves = Leave.query.filter(Leave.status != RequestStatus.APPROVED.value, Leave.status != RequestStatus.REJECTED.value).order_by(Leave.applied_on.desc()).limit(10).all()
            pending_ods = OD.query.filter(OD.status != RequestStatus.APPROVED.value, OD.status != RequestStatus.REJECTED.value).order_by(OD.applied_on.desc()).limit(10).all()

        for l in pending_leaves:
            applicant_name = l.applicant.full_name or l.applicant.username
            notifications.append({
                "id": f"pending-leave-{l.id}",
                "title": f"Action Required: Leave Request from {applicant_name}",
                "message": f"Student {applicant_name} submitted a leave request for {l.start_date.strftime('%Y-%m-%d')} awaiting your review.",
                "time": l.applied_on.strftime("%Y-%m-%d %H:%M"),
                "type": "leave",
                "unread": is_unread(l.applied_on),
                "link": "/pending-leaves"
            })

        for o in pending_ods:
            applicant_name = o.applicant.full_name or o.applicant.username
            notifications.append({
                "id": f"pending-od-{o.id}",
                "title": f"Action Required: On Duty Request from {applicant_name}",
                "message": f"Student {applicant_name} submitted an OD request for {o.event_date.strftime('%Y-%m-%d')} awaiting your review.",
                "time": o.applied_on.strftime("%Y-%m-%d %H:%M"),
                "type": "od",
                "unread": is_unread(o.applied_on),
                "link": "/pending-ods"
            })

    # 4. Audit Log Notifications for User
    audit_logs = AuditLog.query.filter(
        (AuditLog.actor_id == current_user.id) |
        ((AuditLog.target_type == "User") & (AuditLog.target_id == current_user.id))
    ).order_by(AuditLog.timestamp.desc()).limit(5).all()
    for log in audit_logs:
        notifications.append({
            "id": f"audit-{log.id}",
            "title": log.action.replace("_", " ").title(),
            "message": log.details or log.action,
            "time": log.timestamp.strftime("%Y-%m-%d %H:%M"),
            "type": "system",
            "unread": is_unread(log.timestamp),
            "link": "/profile"
        })

    notifications.sort(key=lambda x: x["time"], reverse=True)
    return jsonify(notifications)


@bp.route("/notifications/mark_read", methods=["POST"])
@token_required
def api_notifications_mark_read(current_user):
    current_user.notifications_read_at = utcnow()
    db.session.commit()
    return jsonify({"message": "Notifications marked as read"})




