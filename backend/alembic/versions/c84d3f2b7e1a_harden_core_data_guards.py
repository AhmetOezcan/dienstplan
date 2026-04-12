"""harden_core_data_guards

Revision ID: c84d3f2b7e1a
Revises: b9c1f7d4a2e3
Create Date: 2026-04-12 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c84d3f2b7e1a"
down_revision: Union[str, Sequence[str], None] = "b9c1f7d4a2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("UPDATE accounts SET name = btrim(name) WHERE name IS NOT NULL")
    op.execute("UPDATE users SET email = lower(btrim(email)) WHERE email IS NOT NULL")
    op.execute("UPDATE users SET full_name = NULLIF(btrim(full_name), '') WHERE full_name IS NOT NULL")
    op.execute("UPDATE employees SET first_name = btrim(first_name), last_name = btrim(last_name)")
    op.execute(
        "UPDATE customers "
        "SET name = btrim(name), "
        "address = NULLIF(btrim(address), ''), "
        "color = COALESCE(NULLIF(btrim(color), ''), '#2563eb'), "
        "notes = NULLIF(btrim(notes), '')"
    )
    op.execute("UPDATE invite_codes SET code = btrim(code) WHERE code IS NOT NULL")

    op.alter_column(
        "accounts",
        "is_active",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=sa.text("true"),
    )
    op.create_check_constraint(
        "ck_accounts_name_not_blank",
        "accounts",
        "char_length(btrim(name)) > 0",
    )

    op.alter_column(
        "users",
        "must_complete_setup",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=sa.text("false"),
    )
    op.alter_column(
        "users",
        "is_active",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=sa.text("true"),
    )
    op.create_check_constraint(
        "ck_users_email_not_blank",
        "users",
        "char_length(btrim(email)) > 0",
    )
    op.create_check_constraint(
        "ck_users_email_normalized",
        "users",
        "email = lower(btrim(email))",
    )
    op.create_check_constraint(
        "ck_users_full_name_not_blank",
        "users",
        "full_name IS NULL OR char_length(btrim(full_name)) > 0",
    )

    op.alter_column(
        "user_account_memberships",
        "is_active",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=sa.text("true"),
    )

    op.alter_column(
        "employees",
        "is_active",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=sa.text("true"),
    )
    op.create_check_constraint(
        "ck_employees_first_name_not_blank",
        "employees",
        "char_length(btrim(first_name)) > 0",
    )

    op.alter_column(
        "customers",
        "color",
        existing_type=sa.String(length=20),
        existing_nullable=False,
        server_default=sa.text("'#2563eb'"),
    )
    op.alter_column(
        "customers",
        "is_active",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=sa.text("true"),
    )
    op.create_check_constraint(
        "ck_customers_name_not_blank",
        "customers",
        "char_length(btrim(name)) > 0",
    )
    op.create_check_constraint(
        "ck_customers_color_not_blank",
        "customers",
        "char_length(btrim(color)) > 0",
    )

    op.alter_column(
        "invite_codes",
        "is_used",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=sa.text("false"),
    )

    op.alter_column(
        "login_attempt_trackers",
        "failure_count",
        existing_type=sa.Integer(),
        existing_nullable=False,
        server_default=sa.text("0"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "login_attempt_trackers",
        "failure_count",
        existing_type=sa.Integer(),
        existing_nullable=False,
        server_default=None,
    )

    op.alter_column(
        "invite_codes",
        "is_used",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=None,
    )

    op.drop_constraint("ck_customers_color_not_blank", "customers", type_="check")
    op.drop_constraint("ck_customers_name_not_blank", "customers", type_="check")
    op.alter_column(
        "customers",
        "is_active",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=None,
    )
    op.alter_column(
        "customers",
        "color",
        existing_type=sa.String(length=20),
        existing_nullable=False,
        server_default=None,
    )

    op.drop_constraint("ck_employees_first_name_not_blank", "employees", type_="check")
    op.alter_column(
        "employees",
        "is_active",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=None,
    )

    op.alter_column(
        "user_account_memberships",
        "is_active",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=None,
    )

    op.drop_constraint("ck_users_full_name_not_blank", "users", type_="check")
    op.drop_constraint("ck_users_email_normalized", "users", type_="check")
    op.drop_constraint("ck_users_email_not_blank", "users", type_="check")
    op.alter_column(
        "users",
        "is_active",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=None,
    )
    op.alter_column(
        "users",
        "must_complete_setup",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=None,
    )

    op.drop_constraint("ck_accounts_name_not_blank", "accounts", type_="check")
    op.alter_column(
        "accounts",
        "is_active",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=None,
    )
