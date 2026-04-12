from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, func, text
from sqlalchemy.orm import relationship

from app.database import Base
from app.roles import ALLOWED_MEMBERSHIP_ROLE_SQL


class InviteCode(Base):
    __tablename__ = "invite_codes"
    __table_args__ = (
        CheckConstraint(
            f"role IN ({ALLOWED_MEMBERSHIP_ROLE_SQL})",
            name="ck_invite_codes_role",
        ),
        CheckConstraint(
            "char_length(btrim(code)) > 0",
            name="ck_invite_codes_code_not_blank",
        ),
        CheckConstraint(
            "(NOT is_used AND used_by_user_id IS NULL) "
            "OR (is_used AND used_by_user_id IS NOT NULL AND account_id IS NOT NULL)",
            name="ck_invite_codes_usage_consistency",
        ),
    )

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True, index=True)
    code = Column(String(64), unique=True, index=True, nullable=False)
    role = Column(String(50), nullable=False)
    is_used = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    used_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    account = relationship("Account", back_populates="invite_codes")
    used_by_user = relationship(
        "User",
        back_populates="used_invite_codes",
        foreign_keys=[used_by_user_id],
    )
