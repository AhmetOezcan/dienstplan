from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.database import Base


class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("account_id", "id", name="uq_customers_account_id_id"),
        Index("ix_customers_account_id_name", "account_id", "name"),
    )

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    name = Column(String(255), nullable=False)
    address = Column(Text, nullable=True)
    color = Column(String(20), nullable=False, default="#2563eb")
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    account = relationship("Account", back_populates="customers")
    schedule_entries = relationship(
        "ScheduleEntry",
        back_populates="customer",
        foreign_keys="ScheduleEntry.customer_id",
    )
