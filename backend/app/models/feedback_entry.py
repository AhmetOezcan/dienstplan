from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.database import Base


class FeedbackEntry(Base):
    __tablename__ = "feedback_entries"
    __table_args__ = (
        CheckConstraint(
            "author_name IS NULL OR char_length(btrim(author_name)) > 0",
            name="ck_feedback_entries_author_name_not_blank",
        ),
        CheckConstraint(
            "char_length(btrim(message)) > 0",
            name="ck_feedback_entries_message_not_blank",
        ),
        Index("ix_feedback_entries_account_id_created_at", "account_id", "created_at"),
    )

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    author_name = Column(String(255), nullable=True)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    account = relationship("Account", back_populates="feedback_entries")
