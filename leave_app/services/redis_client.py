import os
import json
import logging
from typing import Optional, Tuple, Any
from flask import current_app

logger = logging.getLogger(__name__)

_redis_client = None
_redis_initialized = False


def normalize_redis_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    url = url.strip()
    # Upstash and TLS endpoints need rediss:// scheme in redis-py
    if url.startswith("redis://") and "upstash.io" in url:
        url = url.replace("redis://", "rediss://", 1)
    return url


def get_redis_client():
    global _redis_client, _redis_initialized
    if _redis_initialized and _redis_client is not None:
        return _redis_client

    redis_url = None
    try:
        if current_app:
            redis_url = current_app.config.get("REDIS_URL")
    except RuntimeError:
        pass

    if not redis_url:
        redis_url = os.environ.get("REDIS_URL")

    redis_url = normalize_redis_url(redis_url)

    if not redis_url:
        _redis_initialized = True
        _redis_client = None
        return None

    try:
        import redis
        client = redis.from_url(
            redis_url,
            decode_responses=True,
            socket_timeout=3,
            socket_connect_timeout=3,
            retry_on_timeout=True,
            health_check_interval=30,
        )
        client.ping()
        logger.info("Successfully connected to Redis at %s", redis_url.split("@")[-1] if "@" in redis_url else "configured host")
        _redis_client = client
    except Exception as exc:
        logger.warning("Could not initialize Redis client (%s); operating in database fallback mode.", exc)
        _redis_client = None

    _redis_initialized = True
    return _redis_client


# ============================================================================
# Token Caching Helpers
# ============================================================================

def cache_token_user_id(hashed_token: str, user_id: int, ttl_seconds: int = 900) -> bool:
    """Cache active user ID against hashed token with TTL (default 15 minutes)."""
    client = get_redis_client()
    if not client or not hashed_token:
        return False
    try:
        client.set(f"token:{hashed_token}", str(user_id), ex=max(int(ttl_seconds), 60))
        return True
    except Exception as exc:
        logger.debug("Redis cache_token_user_id failed: %s", exc)
        return False


def get_cached_token_user_id(hashed_token: str) -> Optional[int]:
    """Retrieve user ID from Redis cache by hashed token."""
    client = get_redis_client()
    if not client or not hashed_token:
        return None
    try:
        val = client.get(f"token:{hashed_token}")
        if val is not None:
            return int(val)
        return None
    except Exception as exc:
        logger.debug("Redis get_cached_token_user_id failed: %s", exc)
        return None


def invalidate_token_cache(hashed_token: str) -> bool:
    """Invalidate token from Redis cache on logout or revocation."""
    client = get_redis_client()
    if not client or not hashed_token:
        return False
    try:
        client.delete(f"token:{hashed_token}")
        return True
    except Exception as exc:
        logger.debug("Redis invalidate_token_cache failed: %s", exc)
        return False


# ============================================================================
# Pending Approval Counts Caching Helpers
# ============================================================================

def get_cached_pending_counts(user_id: int, role: str) -> Optional[Tuple[int, int]]:
    """Retrieve (leave_count, od_count) from cache."""
    client = get_redis_client()
    if not client:
        return None
    try:
        val = client.get(f"pending_counts:{user_id}:{role}")
        if val:
            data = json.loads(val)
            return data.get("leave_count", 0), data.get("od_count", 0)
        return None
    except Exception as exc:
        logger.debug("Redis get_cached_pending_counts failed: %s", exc)
        return None


def cache_pending_counts(user_id: int, role: str, leave_count: int, od_count: int, ttl_seconds: int = 45) -> bool:
    """Cache pending counts for 45 seconds."""
    client = get_redis_client()
    if not client:
        return False
    try:
        client.set(
            f"pending_counts:{user_id}:{role}",
            json.dumps({"leave_count": leave_count, "od_count": od_count}),
            ex=ttl_seconds,
        )
        return True
    except Exception as exc:
        logger.debug("Redis cache_pending_counts failed: %s", exc)
        return False


# ============================================================================
# Generic JSON & Pattern Caching Helpers
# ============================================================================

def cache_json(key: str, data: Any, ttl_seconds: int = 60) -> bool:
    """Store arbitrary JSON-serializable data in Redis with TTL."""
    client = get_redis_client()
    if not client or not key or data is None:
        return False
    try:
        client.set(key, json.dumps(data), ex=ttl_seconds)
        return True
    except Exception as exc:
        logger.debug("Redis cache_json failed for key %s: %s", key, exc)
        return False


def get_cached_json(key: str) -> Optional[Any]:
    """Retrieve JSON-deserialized data from Redis."""
    client = get_redis_client()
    if not client or not key:
        return None
    try:
        val = client.get(key)
        if val is not None:
            return json.loads(val)
        return None
    except Exception as exc:
        logger.debug("Redis get_cached_json failed for key %s: %s", key, exc)
        return None


def invalidate_cache_pattern(*patterns: str) -> bool:
    """Delete keys matching given wildcard patterns."""
    client = get_redis_client()
    if not client:
        return False
    try:
        all_keys = []
        for pat in patterns:
            keys = client.keys(pat)
            if keys:
                all_keys.extend(keys)
        if all_keys:
            client.delete(*all_keys)
        return True
    except Exception as exc:
        logger.debug("Redis invalidate_cache_pattern failed: %s", exc)
        return False


def invalidate_workflow_caches(user_id: Optional[int] = None) -> bool:
    """Clear all pending counts, dashboard metrics, and student list caches."""
    patterns = ["pending_counts:*", "students_list:*", "dashboard:admin:*"]
    if user_id:
        patterns.append(f"dashboard:{user_id}:*")
    else:
        patterns.append("dashboard:*")
    return invalidate_cache_pattern(*patterns)


def invalidate_all_pending_counts() -> bool:
    """Clear all pending approval count caches when a leave or OD is created/updated."""
    return invalidate_workflow_caches()
