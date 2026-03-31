from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.database import Base


class InviteCode(Base):
    __tablename__ = "invite_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(64), unique=True, index=True, nullable=False)
    role = Column(String(50), nullable=False)
    is_used = Column(Boolean, nullable=False, default=False)
    used_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    used_by_user = relationship(
        "User",
        back_populates="used_invite_codes",
        foreign_keys=[used_by_user_id],
    )
