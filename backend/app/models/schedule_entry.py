from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, Time, func
from sqlalchemy.orm import relationship

from app.database import Base


class ScheduleEntry(Base):
    __tablename__ = "schedule_entries"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    calendar_week = Column(Integer, nullable=False, index=True)
    day_of_week = Column(String(20), nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    notes = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    account = relationship("Account", back_populates="schedule_entries")
    employee = relationship("Employee", back_populates="schedule_entries")
    customer = relationship("Customer", back_populates="schedule_entries")
    created_by_user = relationship(
        "User",
        back_populates="created_schedule_entries",
        foreign_keys=[created_by_user_id],
    )
