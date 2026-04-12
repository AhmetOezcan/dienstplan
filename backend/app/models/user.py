from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Integer, String, func, text
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "char_length(btrim(email)) > 0",
            name="ck_users_email_not_blank",
        ),
        CheckConstraint(
            "email = lower(btrim(email))",
            name="ck_users_email_normalized",
        ),
        CheckConstraint(
            "full_name IS NULL OR char_length(btrim(full_name)) > 0",
            name="ck_users_full_name_not_blank",
        ),
    )

    id = Column(Integer, primary_key=True)
    email = Column(String(320), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=False)
    must_complete_setup = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    account_membership = relationship(
        "UserAccountMembership",
        back_populates="user",
        uselist=False,
    )
    used_invite_codes = relationship(
        "InviteCode",
        back_populates="used_by_user",
        foreign_keys="InviteCode.used_by_user_id",
    )
    created_schedule_entries = relationship(
        "ScheduleEntry",
        back_populates="created_by_user",
        foreign_keys="ScheduleEntry.created_by_user_id",
    )
