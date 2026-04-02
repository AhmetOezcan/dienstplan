"""enforce_single_account_memberships

Revision ID: 5c4c7e0b8b4d
Revises: 02c422e56e2c
Create Date: 2026-04-02 11:35:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5c4c7e0b8b4d"
down_revision: Union[str, Sequence[str], None] = "02c422e56e2c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    duplicate_user_ids = bind.execute(
        sa.text(
            """
            SELECT user_id
            FROM user_account_memberships
            GROUP BY user_id
            HAVING COUNT(*) > 1
            ORDER BY user_id
            LIMIT 10
            """
        )
    ).scalars().all()

    if duplicate_user_ids:
        duplicate_list = ", ".join(str(user_id) for user_id in duplicate_user_ids)
        raise RuntimeError(
            "Cannot enforce the single-account model while duplicate memberships exist. "
            f"Conflicting user_id values: {duplicate_list}"
        )

    op.drop_constraint(
        "uq_user_account_memberships_user_account",
        "user_account_memberships",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_user_account_memberships_user",
        "user_account_memberships",
        ["user_id"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "uq_user_account_memberships_user",
        "user_account_memberships",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_user_account_memberships_user_account",
        "user_account_memberships",
        ["user_id", "account_id"],
    )
