"""add app_settings singleton

Revision ID: a8f3d91c4e20
Revises: 77cd0813f4b6
Create Date: 2026-04-23 00:00:00.000000

"""
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a8f3d91c4e20"
down_revision: Union[str, Sequence[str], None] = "77cd0813f4b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "app_settings",
        sa.Column("id", sa.String(length=16), nullable=False),
        sa.Column("openai_api_key", sa.Text(), nullable=True),
        sa.Column("openai_base_url", sa.String(length=512), nullable=False),
        sa.Column("openai_model", sa.String(length=64), nullable=False),
        sa.Column("default_export_format", sa.String(length=16), nullable=False),
        sa.Column("theme_mode", sa.String(length=16), nullable=False),
        sa.Column("theme_variant", sa.String(length=16), nullable=False),
        sa.Column("max_concurrent_jobs", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("id = 'singleton'", name="ck_app_settings_singleton"),
        sa.PrimaryKeyConstraint("id"),
    )

    app_settings = sa.table(
        "app_settings",
        sa.column("id", sa.String),
        sa.column("openai_api_key", sa.Text),
        sa.column("openai_base_url", sa.String),
        sa.column("openai_model", sa.String),
        sa.column("default_export_format", sa.String),
        sa.column("theme_mode", sa.String),
        sa.column("theme_variant", sa.String),
        sa.column("max_concurrent_jobs", sa.Integer),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    now = datetime.now(timezone.utc)
    op.bulk_insert(
        app_settings,
        [
            {
                "id": "singleton",
                "openai_api_key": None,
                "openai_base_url": "",
                "openai_model": "gpt-image-2",
                "default_export_format": "png",
                "theme_mode": "light",
                "theme_variant": "graphite",
                "max_concurrent_jobs": 2,
                "created_at": now,
                "updated_at": now,
            }
        ],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("app_settings")
