from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, ForeignKeyConstraint, Index, Integer, String, Text, Time, func
from sqlalchemy.orm import relationship

from app.database import Base


class ScheduleEntry(Base):
    __tablename__ = "schedule_entries"
    __table_args__ = (
        CheckConstraint("start_time <> end_time", name="ck_schedule_entries_times_distinct"),
        CheckConstraint("shift_type IN ('day', 'night')", name="ck_schedule_entries_shift_type"),
        Index(
            "ix_schedule_entries_account_id_date_start_time_id",
            "account_id",
            "date",
            "start_time",
            "id",
        ),
        Index(
            "ix_schedule_entries_account_id_employee_id",
            "account_id",
            "employee_id",
        ),
        Index(
            "ix_schedule_entries_account_id_customer_id",
            "account_id",
            "customer_id",
        ),
        Index(
            "ix_schedule_entries_account_id_shift_type",
            "account_id",
            "shift_type",
        ),
        ForeignKeyConstraint(
            ["account_id", "employee_id"],
            ["employees.account_id", "employees.id"],
            name="fk_schedule_entries_employee_account",
        ),
        ForeignKeyConstraint(
            ["account_id", "customer_id"],
            ["customers.account_id", "customers.id"],
            name="fk_schedule_entries_customer_account",
        ),
        ForeignKeyConstraint(
            ["account_id", "created_by_user_id"],
            [
                "user_account_memberships.account_id",
                "user_account_memberships.user_id",
            ],
            name="fk_schedule_entries_created_by_user_account_membership",
        ),
    )

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    employee_id = Column(Integer, nullable=False)
    customer_id = Column(Integer, nullable=False)
    date = Column(Date, nullable=False)
    shift_type = Column(String(16), nullable=False, default="day", server_default="day")
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
    employee = relationship(
        "Employee",
        back_populates="schedule_entries",
        foreign_keys=[employee_id],
    )
    customer = relationship(
        "Customer",
        back_populates="schedule_entries",
        foreign_keys=[customer_id],
    )
    created_by_user = relationship(
        "User",
        back_populates="created_schedule_entries",
        foreign_keys=[created_by_user_id],
    )
