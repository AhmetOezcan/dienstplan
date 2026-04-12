from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Integer, String, func, text
from sqlalchemy.orm import relationship

from app.database import Base


class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = (
        CheckConstraint(
            "char_length(btrim(name)) > 0",
            name="ck_accounts_name_not_blank",
        ),
    )

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    memberships = relationship("UserAccountMembership", back_populates="account")
    employees = relationship("Employee", back_populates="account")
    customers = relationship("Customer", back_populates="account")
    schedule_entries = relationship("ScheduleEntry", back_populates="account")
    invite_codes = relationship("InviteCode", back_populates="account")
