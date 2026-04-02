"""expand_users_email_to_320

Revision ID: 207f3eda11c5
Revises: 3976ff5dcb5f
Create Date: 2026-04-02 01:45:52.613844

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '207f3eda11c5'
down_revision: Union[str, Sequence[str], None] = '3976ff5dcb5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        "users",
        "email",
        existing_type=sa.String(length=255),
        type_=sa.String(length=320),
        existing_nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "users",
        "email",
        existing_type=sa.String(length=320),
        type_=sa.String(length=255),
        existing_nullable=False,
    )
