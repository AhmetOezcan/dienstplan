from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.database import Base
from app.roles import ALLOWED_MEMBERSHIP_ROLE_SQL


class UserAccountMembership(Base):
    __tablename__ = "user_account_memberships"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            name="uq_user_account_memberships_user",
        ),
        CheckConstraint(
            f"role IN ({ALLOWED_MEMBERSHIP_ROLE_SQL})",
            name="ck_user_account_memberships_role",
        ),
        Index(
            "ix_user_account_memberships_user_id_is_active_created_at_id",
            "user_id",
            "is_active",
            "created_at",
            "id",
        ),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)
    role = Column(String(50), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user = relationship("User", back_populates="account_membership")
    account = relationship("Account", back_populates="memberships")
