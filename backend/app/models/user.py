from sqlalchemy import Boolean, Column, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("email", name="uq_users_email"),)

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(320), index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    employees = relationship("Employee", back_populates="user")
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
