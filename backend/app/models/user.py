from sqlalchemy import Boolean, Column, DateTime, Integer, String, func
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    employee = relationship("Employee", back_populates="user", uselist=False)
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
