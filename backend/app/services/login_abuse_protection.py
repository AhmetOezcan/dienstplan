import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.login_attempt_tracker import LoginAttemptTracker


EMAIL_SCOPE = "email"
IP_SCOPE = "ip"
IDENTIFIER_MAX_LENGTH = 320
TRACKER_RETENTION = timedelta(hours=24)


@dataclass(frozen=True)
class _LimitRule:
    scope: str
    failure_limit: int
    window: timedelta
    lockout: timedelta


_LIMIT_RULES = (
    _LimitRule(
        scope=EMAIL_SCOPE,
        failure_limit=5,
        window=timedelta(minutes=15),
        lockout=timedelta(minutes=15),
    ),
    _LimitRule(
        scope=IP_SCOPE,
        failure_limit=25,
        window=timedelta(minutes=15),
        lockout=timedelta(minutes=15),
    ),
)


def get_login_client_ip(request: Request) -> str:
    # Reverse proxies must strip and overwrite forwarded client IP headers.
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        forwarded_ip = forwarded_for.split(",", maxsplit=1)[0].strip()
        if forwarded_ip:
            return forwarded_ip[:IDENTIFIER_MAX_LENGTH]

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        normalized_real_ip = real_ip.strip()
        if normalized_real_ip:
            return normalized_real_ip[:IDENTIFIER_MAX_LENGTH]

    if request.client is not None and request.client.host:
        return request.client.host[:IDENTIFIER_MAX_LENGTH]

    return "unknown"


def enforce_login_rate_limit(email: str, client_ip: str, db: Session) -> None:
    now = _utcnow()
    blocked_until = _get_active_blocked_until(email, client_ip, db, now)

    if blocked_until is not None:
        _raise_too_many_attempts(blocked_until, now)


def register_failed_login(email: str, client_ip: str, db: Session) -> None:
    now = _utcnow()
    _prune_stale_trackers(db, now)

    try:
        blocked_until = _record_failed_login_attempt(email, client_ip, db, now)
        db.commit()
    except IntegrityError:
        db.rollback()
        blocked_until = _record_failed_login_attempt(email, client_ip, db, now)
        db.commit()

    if blocked_until is not None:
        _raise_too_many_attempts(blocked_until, now)


def clear_email_login_rate_limit(email: str, db: Session) -> None:
    db.execute(
        delete(LoginAttemptTracker).where(
            LoginAttemptTracker.scope == EMAIL_SCOPE,
            LoginAttemptTracker.scope_value == email,
        )
    )
    db.commit()


def _get_active_blocked_until(
    email: str,
    client_ip: str,
    db: Session,
    now: datetime,
) -> datetime | None:
    blocked_until = None

    for rule in _LIMIT_RULES:
        tracker = db.scalar(
            select(LoginAttemptTracker).where(
                LoginAttemptTracker.scope == rule.scope,
                LoginAttemptTracker.scope_value == _get_scope_value(rule.scope, email, client_ip),
            )
        )
        tracker_blocked_until = None if tracker is None else _ensure_utc(tracker.blocked_until)

        if tracker is None or tracker_blocked_until is None or tracker_blocked_until <= now:
            continue

        if blocked_until is None or tracker_blocked_until > blocked_until:
            blocked_until = tracker_blocked_until

    return blocked_until


def _record_failed_login_attempt(
    email: str,
    client_ip: str,
    db: Session,
    now: datetime,
) -> datetime | None:
    blocked_until = None

    for rule in _LIMIT_RULES:
        scope_value = _get_scope_value(rule.scope, email, client_ip)
        tracker = db.scalar(
            select(LoginAttemptTracker)
            .where(
                LoginAttemptTracker.scope == rule.scope,
                LoginAttemptTracker.scope_value == scope_value,
            )
            .with_for_update()
        )

        if tracker is None:
            tracker = LoginAttemptTracker(
                scope=rule.scope,
                scope_value=scope_value,
                failure_count=1,
                window_started_at=now,
                last_failed_at=now,
                updated_at=now,
            )
            db.add(tracker)
            db.flush()
        else:
            tracker_window_started_at = _ensure_utc(tracker.window_started_at)

            if tracker_window_started_at <= now - rule.window:
                tracker.failure_count = 1
                tracker.window_started_at = now
                tracker.blocked_until = None
            else:
                tracker.failure_count += 1

            tracker.last_failed_at = now
            tracker.updated_at = now

        if tracker.failure_count >= rule.failure_limit:
            tracker.blocked_until = now + rule.lockout

        tracker_blocked_until = _ensure_utc(tracker.blocked_until)
        if tracker_blocked_until is not None and (
            blocked_until is None or tracker_blocked_until > blocked_until
        ):
            blocked_until = tracker_blocked_until

    return blocked_until


def _prune_stale_trackers(db: Session, now: datetime) -> None:
    db.execute(
        delete(LoginAttemptTracker).where(
            LoginAttemptTracker.updated_at < now - TRACKER_RETENTION,
        )
    )


def _get_scope_value(scope: str, email: str, client_ip: str) -> str:
    if scope == EMAIL_SCOPE:
        return email[:IDENTIFIER_MAX_LENGTH]
    if scope == IP_SCOPE:
        return client_ip[:IDENTIFIER_MAX_LENGTH]
    raise ValueError(f"Unsupported login tracker scope: {scope}")


def _raise_too_many_attempts(blocked_until: datetime, now: datetime) -> None:
    retry_after_seconds = max(
        1,
        math.ceil((blocked_until - now).total_seconds()),
    )
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many failed login attempts. Try again later.",
        headers={"Retry-After": str(retry_after_seconds)},
    )


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
