"""add_user_setup_fields

Revision ID: 4f2b9c7d1a6e
Revises: b9c1f7d4a2e3
Create Date: 2026-04-07 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4f2b9c7d1a6e"
down_revision: Union[str, Sequence[str], None] = "b9c1f7d4a2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("users", sa.Column("full_name", sa.String(length=255), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "must_complete_setup",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "must_complete_setup")
    op.drop_column("users", "full_name")
