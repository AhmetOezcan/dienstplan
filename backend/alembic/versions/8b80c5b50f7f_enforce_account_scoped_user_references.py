"""enforce_account_scoped_user_references

Revision ID: 8b80c5b50f7f
Revises: 5c4c7e0b8b4d
Create Date: 2026-04-02 12:15:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8b80c5b50f7f"
down_revision: Union[str, Sequence[str], None] = "5c4c7e0b8b4d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()

    invalid_employee_ids = bind.execute(
        sa.text(
            """
            SELECT e.id
            FROM employees AS e
            LEFT JOIN user_account_memberships AS uam
                ON uam.account_id = e.account_id
               AND uam.user_id = e.user_id
            WHERE e.user_id IS NOT NULL
              AND uam.id IS NULL
            ORDER BY e.id
            LIMIT 10
            """
        )
    ).scalars().all()

    if invalid_employee_ids:
        employee_list = ", ".join(str(employee_id) for employee_id in invalid_employee_ids)
        raise RuntimeError(
            "Cannot enforce account-scoped employee user links while cross-account references exist. "
            f"Conflicting employee IDs: {employee_list}"
        )

    invalid_schedule_entry_ids = bind.execute(
        sa.text(
            """
            SELECT se.id
            FROM schedule_entries AS se
            LEFT JOIN user_account_memberships AS uam
                ON uam.account_id = se.account_id
               AND uam.user_id = se.created_by_user_id
            WHERE uam.id IS NULL
            ORDER BY se.id
            LIMIT 10
            """
        )
    ).scalars().all()

    if invalid_schedule_entry_ids:
        schedule_entry_list = ", ".join(
            str(schedule_entry_id) for schedule_entry_id in invalid_schedule_entry_ids
        )
        raise RuntimeError(
            "Cannot enforce account-scoped schedule entry creators while cross-account references exist. "
            f"Conflicting schedule_entry IDs: {schedule_entry_list}"
        )

    op.create_unique_constraint(
        "uq_user_account_memberships_account_user",
        "user_account_memberships",
        ["account_id", "user_id"],
    )
    op.create_foreign_key(
        "fk_employees_user_account_membership",
        "employees",
        "user_account_memberships",
        ["account_id", "user_id"],
        ["account_id", "user_id"],
    )
    op.create_foreign_key(
        "fk_schedule_entries_created_by_user_account_membership",
        "schedule_entries",
        "user_account_memberships",
        ["account_id", "created_by_user_id"],
        ["account_id", "user_id"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "fk_schedule_entries_created_by_user_account_membership",
        "schedule_entries",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_employees_user_account_membership",
        "employees",
        type_="foreignkey",
    )
    op.drop_constraint(
        "uq_user_account_memberships_account_user",
        "user_account_memberships",
        type_="unique",
    )
