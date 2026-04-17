"""add_shift_type_to_schedule_entries

Revision ID: b2f7c1d9e4a6
Revises: 9ad4f1c6e2b7
Create Date: 2026-04-16 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b2f7c1d9e4a6"
down_revision: Union[str, Sequence[str], None] = "9ad4f1c6e2b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "schedule_entries",
        sa.Column(
            "shift_type",
            sa.String(length=16),
            nullable=False,
            server_default="day",
        ),
    )
    op.create_check_constraint(
        "ck_schedule_entries_shift_type",
        "schedule_entries",
        "shift_type IN ('day', 'night')",
    )
    op.create_index(
        "ix_schedule_entries_account_id_shift_type",
        "schedule_entries",
        ["account_id", "shift_type"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_schedule_entries_account_id_shift_type", table_name="schedule_entries")
    op.drop_constraint("ck_schedule_entries_shift_type", "schedule_entries", type_="check")
    op.drop_column("schedule_entries", "shift_type")
