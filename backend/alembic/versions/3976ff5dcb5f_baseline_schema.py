"""baseline_schema

Revision ID: 3976ff5dcb5f
Revises: 
Create Date: 2026-04-02 01:41:18.794987

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3976ff5dcb5f'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "accounts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_accounts_id", "accounts", ["id"], unique=False)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_id", "users", ["id"], unique=False)

    op.create_table(
        "user_account_memberships",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("role IN ('admin')", name="ck_user_account_memberships_role"),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], name="user_account_memberships_account_id_fkey"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="user_account_memberships_user_id_fkey"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "account_id", name="uq_user_account_memberships_user_account"),
    )
    op.create_index("ix_user_account_memberships_account_id", "user_account_memberships", ["account_id"], unique=False)
    op.create_index("ix_user_account_memberships_id", "user_account_memberships", ["id"], unique=False)
    op.create_index("ix_user_account_memberships_user_id", "user_account_memberships", ["user_id"], unique=False)

    op.create_table(
        "employees",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], name="employees_account_id_fkey"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="employees_user_id_fkey"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_id", "id", name="uq_employees_account_id_id"),
    )
    op.create_index("ix_employees_account_id", "employees", ["account_id"], unique=False)
    op.create_index("ix_employees_id", "employees", ["id"], unique=False)
    op.create_index("ix_employees_user_id", "employees", ["user_id"], unique=False)

    op.create_table(
        "customers",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("color", sa.String(length=20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], name="customers_account_id_fkey"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_id", "id", name="uq_customers_account_id_id"),
    )
    op.create_index("ix_customers_account_id", "customers", ["account_id"], unique=False)
    op.create_index("ix_customers_id", "customers", ["id"], unique=False)
    op.create_index("ix_customers_name", "customers", ["name"], unique=False)

    op.create_table(
        "invite_codes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=True),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("is_used", sa.Boolean(), nullable=False),
        sa.Column("used_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("char_length(btrim(code)) > 0", name="ck_invite_codes_code_not_blank"),
        sa.CheckConstraint("role IN ('admin')", name="ck_invite_codes_role"),
        sa.CheckConstraint(
            "(NOT is_used AND used_by_user_id IS NULL) "
            "OR (is_used AND used_by_user_id IS NOT NULL AND account_id IS NOT NULL)",
            name="ck_invite_codes_usage_consistency",
        ),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], name="invite_codes_account_id_fkey"),
        sa.ForeignKeyConstraint(["used_by_user_id"], ["users.id"], name="invite_codes_used_by_user_id_fkey"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_invite_codes_account_id", "invite_codes", ["account_id"], unique=False)
    op.create_index("ix_invite_codes_code", "invite_codes", ["code"], unique=True)
    op.create_index("ix_invite_codes_id", "invite_codes", ["id"], unique=False)
    op.create_index("ix_invite_codes_used_by_user_id", "invite_codes", ["used_by_user_id"], unique=False)

    op.create_table(
        "schedule_entries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("start_time < end_time", name="ck_schedule_entries_time_order"),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], name="schedule_entries_account_id_fkey"),
        sa.ForeignKeyConstraint(
            ["account_id", "customer_id"],
            ["customers.account_id", "customers.id"],
            name="fk_schedule_entries_customer_account",
        ),
        sa.ForeignKeyConstraint(
            ["account_id", "employee_id"],
            ["employees.account_id", "employees.id"],
            name="fk_schedule_entries_employee_account",
        ),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], name="schedule_entries_created_by_user_id_fkey"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_schedule_entries_account_id", "schedule_entries", ["account_id"], unique=False)
    op.create_index("ix_schedule_entries_created_by_user_id", "schedule_entries", ["created_by_user_id"], unique=False)
    op.create_index("ix_schedule_entries_customer_id", "schedule_entries", ["customer_id"], unique=False)
    op.create_index("ix_schedule_entries_date", "schedule_entries", ["date"], unique=False)
    op.create_index("ix_schedule_entries_employee_id", "schedule_entries", ["employee_id"], unique=False)
    op.create_index("ix_schedule_entries_id", "schedule_entries", ["id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_schedule_entries_id", table_name="schedule_entries")
    op.drop_index("ix_schedule_entries_employee_id", table_name="schedule_entries")
    op.drop_index("ix_schedule_entries_date", table_name="schedule_entries")
    op.drop_index("ix_schedule_entries_customer_id", table_name="schedule_entries")
    op.drop_index("ix_schedule_entries_created_by_user_id", table_name="schedule_entries")
    op.drop_index("ix_schedule_entries_account_id", table_name="schedule_entries")
    op.drop_table("schedule_entries")

    op.drop_index("ix_invite_codes_used_by_user_id", table_name="invite_codes")
    op.drop_index("ix_invite_codes_id", table_name="invite_codes")
    op.drop_index("ix_invite_codes_code", table_name="invite_codes")
    op.drop_index("ix_invite_codes_account_id", table_name="invite_codes")
    op.drop_table("invite_codes")

    op.drop_index("ix_customers_name", table_name="customers")
    op.drop_index("ix_customers_id", table_name="customers")
    op.drop_index("ix_customers_account_id", table_name="customers")
    op.drop_table("customers")

    op.drop_index("ix_employees_user_id", table_name="employees")
    op.drop_index("ix_employees_id", table_name="employees")
    op.drop_index("ix_employees_account_id", table_name="employees")
    op.drop_table("employees")

    op.drop_index("ix_user_account_memberships_user_id", table_name="user_account_memberships")
    op.drop_index("ix_user_account_memberships_id", table_name="user_account_memberships")
    op.drop_index("ix_user_account_memberships_account_id", table_name="user_account_memberships")
    op.drop_table("user_account_memberships")

    op.drop_index("ix_users_id", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    op.drop_index("ix_accounts_id", table_name="accounts")
    op.drop_table("accounts")
