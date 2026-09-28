import secrets
from datetime import timedelta
from flask import Blueprint, flash, redirect, render_template, request, url_for, session, current_app
from flask_login import current_user, login_required, login_user, logout_user

from sqlalchemy import func, or_

from ..services.auth_security import (
    clear_failed_logins,
    login_allowed,
    register_failed_login,
    otp_allowed,
    register_failed_otp,
    clear_failed_otps,
)
from ..models import User, OTPToken, utcnow, Role
from ..services.emailing import send_email
from ..extensions import db
from ..services.audit import log_audit_event


bp = Blueprint("auth", __name__)


@bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        client_ip = request.remote_addr or "unknown"

        if not username or not password:
            flash("Username, email or register number and password are required.", "danger")
            return redirect(url_for("auth.login"))

        allowed, locked_until = login_allowed(username, client_ip)
        if not allowed:
            locked_until_display = locked_until.strftime("%Y-%m-%d %H:%M:%S") if locked_until else "later"
            flash(f"Too many failed sign-in attempts. Try again after {locked_until_display}.", "danger")
            return redirect(url_for("auth.login"))

        user = User.query.filter(
            or_(
                User.username == username,
                func.lower(User.username) == username.lower(),
                func.lower(User.email) == username.lower(),
                func.lower(User.register_number) == username.lower(),
            )
        ).first()
        if user and user.check_password(password):
            clear_failed_logins(username, client_ip)
            session.pop("active_role", None)
            login_user(user)
            log_audit_event("LOGIN_SUCCESS", user)
            flash(f"Welcome back, {user.full_name or user.username}.", "success")
            return redirect(url_for("main.index"))

        register_failed_login(username, client_ip)
        log_audit_event("LOGIN_FAILED", details=f"Username attempted: {username}")
        flash("Invalid credentials.", "danger")
        return redirect(url_for("auth.login"))

    if current_app.config.get("TESTING"):
        if current_user.is_authenticated:
            return redirect(url_for("main.index"))
        return render_template("index.html")

    from .main import serve_spa
    return serve_spa()


@bp.route("/logout", methods=["GET", "POST"])
def logout():
    if current_user.is_authenticated:
        log_audit_event("LOGOUT", current_user)
        session.pop("active_role", None)
        session.clear()
        logout_user()
    if request.is_json or request.path.startswith("/api/"):
        return jsonify({"success": True, "message": "Logged out successfully"})
    flash("You have been logged out.", "info")
    return redirect(url_for("main.index"))


@bp.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if current_user.is_authenticated:
        return redirect(url_for("main.index"))

    if request.method == "POST":
        email = request.form.get("email", "").strip()
        if not email:
            flash("Email address is required.", "danger")
            return redirect(url_for("auth.forgot_password"))

        user = User.query.filter_by(email=email).first()
        if not user:
            flash("No account associated with that email address.", "danger")
            return redirect(url_for("auth.forgot_password"))

        # Generate a cryptographically secure 6-digit OTP
        otp_code = "".join(secrets.choice("0123456789") for _ in range(6))

        # Invalidate existing unused OTP tokens for this user
        OTPToken.query.filter_by(user_id=user.id, is_used=False).update({"is_used": True})

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

        # Send the email with the OTP
        subject = "Permitrack Password Reset OTP"
        body = (
            f"Hello {user.full_name or user.username},\n\n"
            f"You requested to reset your password. Use the OTP below to complete the reset process:\n\n"
            f"OTP: {otp_code}\n\n"
            f"This OTP is valid for 10 minutes. If you did not request this, you can safely ignore this email."
        )
        try:
            send_email(subject, [user.email], body)
            log_audit_event("PASSWORD_RESET_REQUESTED", user)
            session["reset_email"] = user.email
            flash("An OTP has been sent to your email. Please verify it to reset your password.", "success")
            return redirect(url_for("auth.verify_otp"))
        except Exception as exc:
            current_app.logger.error("Failed to send OTP email: %s", exc)
            flash("Failed to send OTP email. Please try again later.", "danger")
            return redirect(url_for("auth.forgot_password"))

    return render_template("forgot_password.html")


@bp.route("/verify-otp", methods=["GET", "POST"])
def verify_otp():
    if current_user.is_authenticated:
        return redirect(url_for("main.index"))

    email = session.get("reset_email")
    if not email:
        flash("Please request a password reset first.", "warning")
        return redirect(url_for("auth.forgot_password"))

    client_ip = request.remote_addr or "unknown"

    if request.method == "POST":
        otp_input = request.form.get("otp", "").strip()
        new_password = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")

        allowed, locked_until = otp_allowed(email, client_ip)
        if not allowed:
            locked_until_display = locked_until.strftime("%Y-%m-%d %H:%M:%S") if locked_until else "later"
            flash(f"Too many failed OTP attempts. Try again after {locked_until_display}.", "danger")
            return render_template("verify_otp.html")

        if not otp_input or not new_password or not confirm_password:
            flash("All fields are required.", "danger")
            return render_template("verify_otp.html")

        if new_password != confirm_password:
            flash("Passwords do not match.", "danger")
            return render_template("verify_otp.html")

        user = User.query.filter_by(email=email).first()
        if not user:
            register_failed_otp(email, client_ip)
            log_audit_event("PASSWORD_RESET_FAILED", details=f"User not found for email: {email}")
            flash("User not found.", "danger")
            return redirect(url_for("auth.forgot_password"))

        # Check for valid, unused, non-expired OTP
        now = utcnow()
        otp_token = OTPToken.query.filter(
            OTPToken.user_id == user.id,
            OTPToken.otp == otp_input,
            OTPToken.is_used == False,
            OTPToken.expires_at > now
        ).first()

        if not otp_token:
            register_failed_otp(email, client_ip)
            log_audit_event("PASSWORD_RESET_FAILED", user, details="Invalid or expired OTP")
            flash("Invalid or expired OTP.", "danger")
            return render_template("verify_otp.html")

        # OTP is valid, mark it as used and reset password
        otp_token.is_used = True
        user.set_password(new_password)
        clear_failed_otps(email, client_ip)
        log_audit_event("PASSWORD_RESET_SUCCESS", user)
        db.session.commit()

        # Clear reset session info
        session.pop("reset_email", None)

        flash("Your password has been reset successfully. You can now login.", "success")
        return redirect(url_for("auth.login"))

    return render_template("verify_otp.html")


@bp.route("/switch-role", methods=["POST"])
@login_required
def switch_role():
    target_role = request.form.get("role", "").strip()
    if current_user.db_role in (Role.FACULTY.value, Role.MENTOR.value) and target_role in (Role.FACULTY.value, Role.MENTOR.value):
        session["active_role"] = target_role
        flash(f"Switched role to {target_role.upper()}.", "success")
    else:
        flash("Invalid role switch request.", "danger")
    return redirect(request.referrer or url_for("main.index"))

