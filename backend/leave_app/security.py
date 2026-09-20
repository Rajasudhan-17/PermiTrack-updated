import secrets
from hmac import compare_digest

from flask import abort, current_app, request, session
from markupsafe import Markup
from werkzeug.middleware.proxy_fix import ProxyFix


CSRF_SESSION_KEY = "_csrf_token"


def ensure_csrf_token():
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_urlsafe(32)
        session[CSRF_SESSION_KEY] = token
    return token


def csrf_token():
    return ensure_csrf_token()


def csrf_input():
    token = ensure_csrf_token()
    return Markup(f'<input type="hidden" name="csrf_token" value="{token}">')


def validate_csrf():
    if not current_app.config.get("CSRF_ENABLED", True):
        return

    if request.path.startswith("/api/") or "/initdb" in request.path:
        return

    if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return

    expected = session.get(CSRF_SESSION_KEY)
    provided = request.form.get("csrf_token") or request.headers.get("X-CSRF-Token")
    if not expected or not provided or not compare_digest(expected, provided):
        abort(400, description="CSRF token missing or invalid.")


def set_security_headers(response):
    if not current_app.config.get("SECURITY_HEADERS_ENABLED", True):
        return response

    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if not request.path.startswith("/api/"):
        response.headers.setdefault(
            "Content-Security-Policy",
            (
                "default-src 'self'; "
                "img-src 'self' data: https:; "
                "script-src 'self' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "connect-src *; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'"
            ),
        )
    if current_app.config["ENV_NAME"] == "production":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


def register_security(app):
    if app.config.get("TRUST_PROXY"):
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

    app.jinja_env.globals["csrf_token"] = csrf_token
    app.jinja_env.globals["csrf_input"] = csrf_input

    @app.before_request
    def _validate_csrf():
        validate_csrf()

    @app.after_request
    def _set_security_headers(response):
        return set_security_headers(response)
