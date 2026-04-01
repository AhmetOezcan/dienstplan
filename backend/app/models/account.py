from sqlalchemy import Boolean, Column, DateTime, Integer, String, func
from sqlalchemy.orm import relationship

from app.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    memberships = relationship("UserAccountMembership", back_populates="account")
    employees = relationship("Employee", back_populates="account")
    customers = relationship("Customer", back_populates="account")
    schedule_entries = relationship("ScheduleEntry", back_populates="account")
    invite_codes = relationship("InviteCode", back_populates="account")
