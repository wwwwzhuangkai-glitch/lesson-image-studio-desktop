"""add provider settings

Revision ID: c1b2d3e4f5a6
Revises: a8f3d91c4e20
Create Date: 2026-04-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1b2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "a8f3d91c4e20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "app_settings",
        sa.Column(
            "default_provider",
            sa.String(length=32),
            nullable=False,
            server_default="openai_official",
        ),
    )
    op.add_column(
        "app_settings",
        sa.Column(
            "tal_service_base_url",
            sa.String(length=512),
            nullable=False,
            server_default="",
        ),
    )
    op.add_column(
        "app_settings",
        sa.Column("tal_service_api_key", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("app_settings", "tal_service_api_key")
    op.drop_column("app_settings", "tal_service_base_url")
    op.drop_column("app_settings", "default_provider")
