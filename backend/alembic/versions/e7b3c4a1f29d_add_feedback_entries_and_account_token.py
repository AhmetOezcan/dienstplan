"""add_feedback_entries_and_account_token

Revision ID: e7b3c4a1f29d
Revises: b2f7c1d9e4a6
Create Date: 2026-04-19 12:00:00.000000

"""

from typing import Sequence, Union
import secrets

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e7b3c4a1f29d"
down_revision: Union[str, Sequence[str], None] = "b2f7c1d9e4a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _generate_feedback_public_token(existing_tokens: set[str]) -> str:
    while True:
        token = secrets.token_urlsafe(24)
        if token not in existing_tokens:
            existing_tokens.add(token)
            return token


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("accounts", sa.Column("feedback_public_token", sa.String(length=255), nullable=True))

    connection = op.get_bind()
    accounts_table = sa.table(
        "accounts",
        sa.column("id", sa.Integer),
        sa.column("feedback_public_token", sa.String(length=255)),
    )
    account_rows = connection.execute(sa.select(accounts_table.c.id)).all()
    existing_tokens: set[str] = set()

    for account_row in account_rows:
        connection.execute(
            accounts_table.update()
            .where(accounts_table.c.id == account_row.id)
            .values(feedback_public_token=_generate_feedback_public_token(existing_tokens))
        )

    op.alter_column("accounts", "feedback_public_token", existing_type=sa.String(length=255), nullable=False)
    op.create_unique_constraint(
        "uq_accounts_feedback_public_token",
        "accounts",
        ["feedback_public_token"],
    )

    op.create_table(
        "feedback_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("author_name", sa.String(length=255), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "author_name IS NULL OR char_length(btrim(author_name)) > 0",
            name="ck_feedback_entries_author_name_not_blank",
        ),
        sa.CheckConstraint(
            "char_length(btrim(message)) > 0",
            name="ck_feedback_entries_message_not_blank",
        ),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_feedback_entries_account_id_created_at",
        "feedback_entries",
        ["account_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_feedback_entries_account_id_created_at", table_name="feedback_entries")
    op.drop_table("feedback_entries")
    op.drop_constraint("uq_accounts_feedback_public_token", "accounts", type_="unique")
    op.drop_column("accounts", "feedback_public_token")
