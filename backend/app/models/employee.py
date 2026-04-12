from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Employee(Base):
    __tablename__ = "employees"
    __table_args__ = (
        UniqueConstraint("account_id", "id", name="uq_employees_account_id_id"),
        CheckConstraint(
            "char_length(btrim(first_name)) > 0",
            name="ck_employees_first_name_not_blank",
        ),
        ForeignKeyConstraint(
            ["account_id", "user_id"],
            [
                "user_account_memberships.account_id",
                "user_account_memberships.user_id",
            ],
            name="fk_employees_user_account_membership",
        ),
        Index(
            "ix_employees_account_id_first_name_last_name",
            "account_id",
            "first_name",
            "last_name",
        ),
    )

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    account = relationship("Account", back_populates="employees")
    linked_user = relationship("User", foreign_keys=[user_id])
    schedule_entries = relationship(
        "ScheduleEntry",
        back_populates="employee",
        foreign_keys="ScheduleEntry.employee_id",
    )
