import os
from datetime import timedelta
from urllib.parse import urlparse
from urllib.parse import quote_plus


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
INSTANCE_DIR = "/tmp/instance" if os.environ.get("VERCEL") == "1" else os.path.join(BASE_DIR, "instance")
DEFAULT_SQLITE_PATH = os.path.join(INSTANCE_DIR, "app.db")

os.makedirs(INSTANCE_DIR, exist_ok=True)


def env_flag(name, default=False):
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name, default):
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    return int(raw_value)


def first_non_empty(*values, default=None):
    for value in values:
        if value not in (None, ""):
            return value
    return default


def normalize_database_uri(uri):
    if not uri:
        return uri

    if uri.startswith("postgres://"):
        return uri.replace("postgres://", "postgresql://", 1)

    if uri.startswith("mysql://"):
        return uri.replace("mysql://", "mysql+pymysql://", 1)

    return uri


def default_mail_backend():
    configured_backend = os.environ.get("MAIL_BACKEND")
    if configured_backend:
        return configured_backend.strip().lower()

    brevo_api_key = os.environ.get("BREVO_API_KEY")
    if brevo_api_key:
        return "brevo_api"

    return "smtp"


def build_mysql_uri_from_env():
    database = os.environ.get("MYSQL_DATABASE")
    if not database:
        return None

    username = os.environ.get("MYSQL_USER", "root")
    password = quote_plus(os.environ.get("MYSQL_PASSWORD", ""))
    host = os.environ.get("MYSQL_HOST", "127.0.0.1")
    port = os.environ.get("MYSQL_PORT", "3306")
    return f"mysql+pymysql://{username}:{password}@{host}:{port}/{database}?charset=utf8mb4"


def build_database_uri(environment_name):
    configured_uri = normalize_database_uri(os.environ.get("DATABASE_URL"))
    if configured_uri:
        return configured_uri

    mysql_uri = build_mysql_uri_from_env()
    if mysql_uri:
        return mysql_uri

    if environment_name == "production":
        return None

    return f"sqlite:///{DEFAULT_SQLITE_PATH}"


def build_engine_options(database_uri, environment_name):
    options = {"pool_pre_ping": True}
    if not database_uri or database_uri.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False}
        return options

    options.update(
        {
            "pool_recycle": env_int("DB_POOL_RECYCLE_SECONDS", 1800),
            "pool_size": env_int("DB_POOL_SIZE", 20 if environment_name == "production" else 10),
            "max_overflow": env_int("DB_MAX_OVERFLOW", 30 if environment_name == "production" else 10),
        }
    )
    return options


def refresh_runtime_config_values(app):
    database_uri = normalize_database_uri(app.config.get("SQLALCHEMY_DATABASE_URI"))
    app.config["SQLALCHEMY_DATABASE_URI"] = database_uri
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = build_engine_options(database_uri, app.config.get("ENV_NAME", "development"))
    configured_mail_delivery_mode = os.environ.get("MAIL_DELIVERY_MODE")
    if configured_mail_delivery_mode is not None:
        app.config["MAIL_DELIVERY_MODE"] = configured_mail_delivery_mode
    elif app.config.get("ENV_NAME") == "production":
        app.config["MAIL_DELIVERY_MODE"] = "sync"
    app.config["STORAGE_BACKEND"] = first_non_empty(app.config.get("STORAGE_BACKEND"), default="local")
    app.config["STORAGE_BUCKET"] = first_non_empty(
        app.config.get("STORAGE_BUCKET"),
        app.config.get("AWS_S3_BUCKET"),
        app.config.get("OCI_OBJECT_STORAGE_BUCKET"),
    )
    app.config["STORAGE_PREFIX"] = first_non_empty(
        app.config.get("STORAGE_PREFIX"),
        app.config.get("AWS_S3_PREFIX"),
        app.config.get("OCI_OBJECT_STORAGE_PREFIX"),
        default="permitrack",
    )
    app.config["STORAGE_REGION"] = first_non_empty(
        app.config.get("STORAGE_REGION"),
        app.config.get("AWS_REGION"),
        app.config.get("OCI_OBJECT_STORAGE_REGION"),
    )
    app.config["STORAGE_ENDPOINT_URL"] = first_non_empty(
        app.config.get("STORAGE_ENDPOINT_URL"),
        app.config.get("OCI_OBJECT_STORAGE_ENDPOINT"),
    )
    app.config["STORAGE_ACCESS_KEY_ID"] = first_non_empty(
        app.config.get("STORAGE_ACCESS_KEY_ID"),
        app.config.get("OCI_S3_ACCESS_KEY"),
    )
    app.config["STORAGE_SECRET_ACCESS_KEY"] = first_non_empty(
        app.config.get("STORAGE_SECRET_ACCESS_KEY"),
        app.config.get("OCI_S3_SECRET_KEY"),
    )
    app.config["STORAGE_ADDRESSING_STYLE"] = first_non_empty(
        app.config.get("STORAGE_ADDRESSING_STYLE"),
        app.config.get("OCI_STORAGE_ADDRESSING_STYLE"),
        default="path" if (app.config["STORAGE_BACKEND"] == "oci" or app.config.get("STORAGE_ENDPOINT_URL")) else "auto",
    )
    app.config["STORAGE_PRESIGNED_URL_EXPIRY"] = int(
        first_non_empty(
            app.config.get("STORAGE_PRESIGNED_URL_EXPIRY"),
            app.config.get("AWS_PRESIGNED_URL_EXPIRY"),
            app.config.get("OCI_PRESIGNED_URL_EXPIRY"),
            default=300,
        )
    )


class BaseConfig:
    ENV_NAME = os.environ.get("APP_ENV", os.environ.get("FLASK_ENV", "development")).strip().lower()

    SECRET_KEY = os.environ.get("LEAVE_SECRET") or os.environ.get("SECRET_KEY") or "local-dev-secret"
    SQLALCHEMY_DATABASE_URI = build_database_uri(ENV_NAME)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = build_engine_options(SQLALCHEMY_DATABASE_URI, ENV_NAME)
    MAX_CONTENT_LENGTH = env_int("MAX_CONTENT_LENGTH", 8 * 1024 * 1024)
    CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "*")
    REDIS_URL = os.environ.get("REDIS_URL")

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.environ.get("SESSION_COOKIE_SAMESITE", "Lax")
    SESSION_COOKIE_SECURE = env_flag("SESSION_COOKIE_SECURE", ENV_NAME == "production")
    SESSION_REFRESH_EACH_REQUEST = False
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SECURE = SESSION_COOKIE_SECURE
    PERMANENT_SESSION_LIFETIME = timedelta(hours=12)

    PREFERRED_URL_SCHEME = os.environ.get("PREFERRED_URL_SCHEME", "https" if ENV_NAME == "production" else "http")
    TRUST_PROXY = env_flag("TRUST_PROXY", ENV_NAME == "production")

    CSRF_ENABLED = env_flag("CSRF_ENABLED", True)
    SECURITY_HEADERS_ENABLED = env_flag("SECURITY_HEADERS_ENABLED", True)

    LOGIN_RATE_LIMIT_ENABLED = env_flag("LOGIN_RATE_LIMIT_ENABLED", True)
    LOGIN_RATE_LIMIT_WINDOW_SECONDS = env_int("LOGIN_RATE_LIMIT_WINDOW_SECONDS", 900)
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS = env_int("LOGIN_RATE_LIMIT_MAX_ATTEMPTS", 5)

    MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", "587"))
    MAIL_USE_TL = env_flag("MAIL_USE_TLS", True)
    MAIL_USE_SSL = env_flag("MAIL_USE_SSL", False)
    MAIL_BACKEND = default_mail_backend()
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", MAIL_USERNAME)
    MAIL_DELIVERY_MODE = os.environ.get("MAIL_DELIVERY_MODE", "queue")
    EMAIL_BATCH_SIZE = env_int("EMAIL_BATCH_SIZE", 50)
    EMAIL_MAX_RETRIES = env_int("EMAIL_MAX_RETRIES", 5)
    BREVO_API_KEY = os.environ.get("BREVO_API_KEY")
    BREVO_API_URL = os.environ.get("BREVO_API_URL", "https://api.brevo.com/v3/smtp/email")
    BREVO_SENDER_NAME = os.environ.get("BREVO_SENDER_NAME")

    STORAGE_BACKEND = os.environ.get("STORAGE_BACKEND", "local")
    LOCAL_UPLOAD_ROOT = "/tmp/uploads" if os.environ.get("VERCEL") == "1" else os.path.join(BASE_DIR, "uploads")
    OD_UPLOAD_PREFIX = os.environ.get("OD_UPLOAD_PREFIX", "od_proofs")
    LEAVE_UPLOAD_PREFIX = os.environ.get("LEAVE_UPLOAD_PREFIX", "leave_proofs")
    AWS_REGION = os.environ.get("AWS_REGION")
    AWS_S3_BUCKET = os.environ.get("AWS_S3_BUCKET")
    AWS_S3_PREFIX = os.environ.get("AWS_S3_PREFIX", "permitrack")
    AWS_PRESIGNED_URL_EXPIRY = env_int("AWS_PRESIGNED_URL_EXPIRY", 300)
    STORAGE_BUCKET = os.environ.get("STORAGE_BUCKET")
    STORAGE_PREFIX = os.environ.get("STORAGE_PREFIX")
    STORAGE_REGION = os.environ.get("STORAGE_REGION")
    STORAGE_ENDPOINT_URL = os.environ.get("STORAGE_ENDPOINT_URL")
    STORAGE_ACCESS_KEY_ID = os.environ.get("STORAGE_ACCESS_KEY_ID")
    STORAGE_SECRET_ACCESS_KEY = os.environ.get("STORAGE_SECRET_ACCESS_KEY")
    STORAGE_ADDRESSING_STYLE = os.environ.get("STORAGE_ADDRESSING_STYLE")
    STORAGE_PRESIGNED_URL_EXPIRY = env_int("STORAGE_PRESIGNED_URL_EXPIRY", 300)
    OCI_OBJECT_STORAGE_BUCKET = os.environ.get("OCI_OBJECT_STORAGE_BUCKET")
    OCI_OBJECT_STORAGE_PREFIX = os.environ.get("OCI_OBJECT_STORAGE_PREFIX", "permitrack")
    OCI_OBJECT_STORAGE_REGION = os.environ.get("OCI_OBJECT_STORAGE_REGION")
    OCI_OBJECT_STORAGE_ENDPOINT = os.environ.get("OCI_OBJECT_STORAGE_ENDPOINT")
    OCI_S3_ACCESS_KEY = os.environ.get("OCI_S3_ACCESS_KEY")
    OCI_S3_SECRET_KEY = os.environ.get("OCI_S3_SECRET_KEY")
    OCI_STORAGE_ADDRESSING_STYLE = os.environ.get("OCI_STORAGE_ADDRESSING_STYLE", "path")
    OCI_PRESIGNED_URL_EXPIRY = env_int("OCI_PRESIGNED_URL_EXPIRY", 300)

    ENABLE_INITDB_ROUTE = env_flag("ENABLE_INITDB_ROUTE", False)
    INITDB_TOKEN = os.environ.get("INITDB_TOKEN")
    FACULTY_CONFLICT_THRESHOLD = env_int("FACULTY_CONFLICT_THRESHOLD", 3)

    @classmethod
    def validate_runtime(cls, app):
        errors = []
        environment_name = app.config["ENV_NAME"]

        if environment_name == "production":
            if app.config["SECRET_KEY"] == "local-dev-secret":
                errors.append("Set LEAVE_SECRET or SECRET_KEY to a strong production secret.")
            if not app.config["SQLALCHEMY_DATABASE_URI"]:
                errors.append("Set DATABASE_URL or the MYSQL_* environment variables for production.")
            elif app.config["SQLALCHEMY_DATABASE_URI"].startswith("sqlite"):
                errors.append("Production must use MySQL, not SQLite.")
            if not app.config["SESSION_COOKIE_SECURE"]:
                errors.append("SESSION_COOKIE_SECURE must be enabled in production.")
            if app.config["STORAGE_BACKEND"] not in {"s3", "oci", "supabase", "local"}:
                errors.append("Production must use STORAGE_BACKEND=s3, oci, supabase, or local for file storage.")
            if app.config["STORAGE_BACKEND"] in {"s3", "oci", "supabase"} and not app.config.get("STORAGE_BUCKET"):
                errors.append("Set STORAGE_BUCKET or the cloud-specific bucket variable for object storage.")
            if app.config["STORAGE_BACKEND"] == "oci":
                if not app.config.get("STORAGE_ENDPOINT_URL"):
                    errors.append("Set OCI_OBJECT_STORAGE_ENDPOINT or STORAGE_ENDPOINT_URL for OCI object storage.")
                if not app.config.get("STORAGE_ACCESS_KEY_ID") or not app.config.get("STORAGE_SECRET_ACCESS_KEY"):
                    errors.append("Set OCI_S3_ACCESS_KEY and OCI_S3_SECRET_KEY for OCI object storage access.")
            if app.config["MAIL_DELIVERY_MODE"] not in {"queue", "sync"}:
                errors.append("MAIL_DELIVERY_MODE must be either 'queue' or 'sync'.")
            if app.config["MAIL_BACKEND"] not in {"smtp", "brevo_api"}:
                errors.append("MAIL_BACKEND must be either 'smtp' or 'brevo_api'.")
            if app.config["MAIL_BACKEND"] == "smtp":
                if not app.config.get("MAIL_USERNAME") or not app.config.get("MAIL_PASSWORD"):
                    errors.append("Set MAIL_USERNAME and MAIL_PASSWORD when using SMTP mail delivery.")
            if app.config["MAIL_BACKEND"] == "brevo_api":
                if not app.config.get("BREVO_API_KEY"):
                    errors.append("Set BREVO_API_KEY when using the Brevo API mail backend.")
                sender = app.config.get("MAIL_DEFAULT_SENDER")
                if not sender or "@" not in sender:
                    errors.append("Set MAIL_DEFAULT_SENDER to a verified sender email when using the Brevo API.")
                api_url = app.config.get("BREVO_API_URL")
                parsed_url = urlparse(api_url) if api_url else None
                if not parsed_url or parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
                    errors.append("BREVO_API_URL must be a valid HTTP(S) URL.")

        if errors:
            raise RuntimeError("Production configuration error(s): " + " ".join(errors))


class DevelopmentConfig(BaseConfig):
    ENV_NAME = "development"
    SESSION_COOKIE_SECURE = env_flag("SESSION_COOKIE_SECURE", False)
    REMEMBER_COOKIE_SECURE = SESSION_COOKIE_SECURE
    STORAGE_BACKEND = os.environ.get("STORAGE_BACKEND", "local")


class TestConfig(BaseConfig):
    ENV_NAME = "testing"
    TESTING = True
    CSRF_ENABLED = False
    LOGIN_RATE_LIMIT_ENABLED = False
    SESSION_COOKIE_SECURE = False
    REMEMBER_COOKIE_SECURE = False
    MAIL_DELIVERY_MODE = "queue"
    STORAGE_BACKEND = "local"
    SQLALCHEMY_DATABASE_URI = os.environ.get("TEST_DATABASE_URL", "sqlite:///:memory:")
    SQLALCHEMY_ENGINE_OPTIONS = build_engine_options(SQLALCHEMY_DATABASE_URI, ENV_NAME)


class ProductionConfig(BaseConfig):
    ENV_NAME = "production"
    SESSION_COOKIE_SECURE = True
    REMEMBER_COOKIE_SECURE = True
    STORAGE_BACKEND = os.environ.get("STORAGE_BACKEND", "local")


CONFIG_BY_ENV = {
    "development": DevelopmentConfig,
    "testing": TestConfig,
    "production": ProductionConfig,
}


Config = CONFIG_BY_ENV.get(BaseConfig.ENV_NAME, DevelopmentConfig)
