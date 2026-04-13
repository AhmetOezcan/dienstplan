"""allow_overnight_schedule_entries

Revision ID: 9ad4f1c6e2b7
Revises: 4f2b9c7d1a6e, c84d3f2b7e1a
Create Date: 2026-04-12 13:30:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "9ad4f1c6e2b7"
down_revision: Union[str, Sequence[str], None] = ("4f2b9c7d1a6e", "c84d3f2b7e1a")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint("ck_schedule_entries_time_order", "schedule_entries", type_="check")
    op.create_check_constraint(
        "ck_schedule_entries_times_distinct",
        "schedule_entries",
        "start_time <> end_time",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("ck_schedule_entries_times_distinct", "schedule_entries", type_="check")
    op.create_check_constraint(
        "ck_schedule_entries_time_order",
        "schedule_entries",
        "start_time < end_time",
    )
