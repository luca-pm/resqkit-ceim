import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Tuple

from core.auth import create_access_token, hash_password, verify_password
from core.config import settings
from core.database import db_manager
from models.auth import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class EmailAlreadyRegisteredError(Exception):
    """Raised when attempting to register an email that is already in use."""


class InvalidCredentialsError(Exception):
    """Raised when login email/password do not match a user."""


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register_user(self, email: str, password: str, name: str = None) -> User:
        """Create a new local user with a hashed password."""
        result = await self.db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none() is not None:
            raise EmailAlreadyRegisteredError(f"Email already registered: {email}")

        user = User(
            email=email,
            hashed_password=hash_password(password),
            name=name,
            last_login=datetime.now(timezone.utc),
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        logger.info("Registered new local user: %s", user.id)
        return user

    async def authenticate_user(self, email: str, password: str) -> User:
        """Verify email/password and return the matching user."""
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user or not verify_password(password, user.hashed_password):
            raise InvalidCredentialsError("Invalid email or password")

        user.last_login = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def issue_app_token(
        self,
        user: User,
    ) -> Tuple[str, datetime, Dict[str, Any]]:
        """Generate application JWT token for the authenticated user."""
        try:
            expires_minutes = int(getattr(settings, "jwt_expire_minutes", 60))
        except (TypeError, ValueError):
            logger.warning("Invalid JWT_EXPIRE_MINUTES value; fallback to 60 minutes")
            expires_minutes = 60
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)

        claims: Dict[str, Any] = {
            "sub": user.id,
            "email": user.email,
            "role": user.role,
        }

        if user.name:
            claims["name"] = user.name
        if user.last_login:
            claims["last_login"] = user.last_login.isoformat()
        token = create_access_token(claims, expires_minutes=expires_minutes)

        return token, expires_at, claims


async def initialize_admin_user():
    """Create/promote the admin user from ADMIN_EMAIL/ADMIN_PASSWORD if configured."""
    from services.database import initialize_database

    # Ensure the database is initialized, but skip the work if a caller already did
    # it. Both startup paths (FastAPI lifespan and the Lambda bootstrap) call
    # initialize_database() before this, so re-running it here would only re-walk the
    # init/create-table lock dance on every cold start. The guard keeps this function
    # safe to call standalone while removing that redundant cold-start cost.
    if db_manager.async_session_maker is None:
        await initialize_database()

    admin_email = getattr(settings, "admin_email", "")
    admin_password = getattr(settings, "admin_password", "")

    if not admin_email or not admin_password:
        logger.warning("ADMIN_EMAIL or ADMIN_PASSWORD not configured, skipping admin initialization")
        return

    async with db_manager.async_session_maker() as db:
        result = await db.execute(select(User).where(User.email == admin_email))
        user = result.scalar_one_or_none()

        if user:
            if user.role != "admin":
                user.role = "admin"
                await db.commit()
                logger.debug("Promoted existing user %s to admin role", admin_email)
            else:
                logger.debug("Admin user %s already exists", admin_email)
        else:
            admin_user = User(
                email=admin_email,
                hashed_password=hash_password(admin_password),
                role="admin",
            )
            db.add(admin_user)
            await db.commit()
            logger.debug("Created admin user: %s", admin_email)
