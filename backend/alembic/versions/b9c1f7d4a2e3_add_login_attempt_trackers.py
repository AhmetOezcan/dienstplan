"""add_login_attempt_trackers

Revision ID: b9c1f7d4a2e3
Revises: 8b80c5b50f7f
Create Date: 2026-04-02 18:20:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b9c1f7d4a2e3"
down_revision: Union[str, Sequence[str], None] = "8b80c5b50f7f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "login_attempt_trackers",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("scope", sa.String(length=16), nullable=False),
        sa.Column("scope_value", sa.String(length=320), nullable=False),
        sa.Column("failure_count", sa.Integer(), nullable=False),
        sa.Column(
            "window_started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "last_failed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("blocked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("scope IN ('email', 'ip')", name="ck_login_attempt_trackers_scope"),
        sa.CheckConstraint(
            "failure_count >= 0",
            name="ck_login_attempt_trackers_failure_count_non_negative",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "scope",
            "scope_value",
            name="uq_login_attempt_trackers_scope_scope_value",
        ),
    )
    op.create_index(
        "ix_login_attempt_trackers_blocked_until",
        "login_attempt_trackers",
        ["blocked_until"],
        unique=False,
    )
    op.create_index(
        "ix_login_attempt_trackers_updated_at",
        "login_attempt_trackers",
        ["updated_at"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_login_attempt_trackers_updated_at", table_name="login_attempt_trackers")
    op.drop_index("ix_login_attempt_trackers_blocked_until", table_name="login_attempt_trackers")
    op.drop_table("login_attempt_trackers")
