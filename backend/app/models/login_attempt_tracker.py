from sqlalchemy import CheckConstraint, Column, DateTime, Index, Integer, String, UniqueConstraint, func

from app.database import Base


class LoginAttemptTracker(Base):
    __tablename__ = "login_attempt_trackers"
    __table_args__ = (
        UniqueConstraint(
            "scope",
            "scope_value",
            name="uq_login_attempt_trackers_scope_scope_value",
        ),
        CheckConstraint(
            "scope IN ('email', 'ip')",
            name="ck_login_attempt_trackers_scope",
        ),
        CheckConstraint(
            "failure_count >= 0",
            name="ck_login_attempt_trackers_failure_count_non_negative",
        ),
        Index(
            "ix_login_attempt_trackers_blocked_until",
            "blocked_until",
        ),
        Index(
            "ix_login_attempt_trackers_updated_at",
            "updated_at",
        ),
    )

    id = Column(Integer, primary_key=True)
    scope = Column(String(16), nullable=False)
    scope_value = Column(String(320), nullable=False)
    failure_count = Column(Integer, nullable=False, default=0)
    window_started_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_failed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    blocked_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
