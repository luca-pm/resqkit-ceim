"""add user_id to incident_records

Revision ID: f2c17a9b3d41
Revises: e6ade0af58d8
Create Date: 2026-08-26 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2c17a9b3d41'
down_revision: Union[str, Sequence[str], None] = 'e6ade0af58d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('incident_records', sa.Column('user_id', sa.String(length=255), nullable=True))
    op.create_index(op.f('ix_incident_records_user_id'), 'incident_records', ['user_id'], unique=False)
    op.create_foreign_key(
        'fk_incident_records_user_id_users',
        'incident_records', 'users',
        ['user_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_incident_records_user_id_users', 'incident_records', type_='foreignkey')
    op.drop_index(op.f('ix_incident_records_user_id'), table_name='incident_records')
    op.drop_column('incident_records', 'user_id')
