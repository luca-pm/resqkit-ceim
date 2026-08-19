import logging

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, status
from schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from services.auth import AuthService, EmailAlreadyRegisteredError, InvalidCredentialsError
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
logger = logging.getLogger(__name__)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new local account and return a signed-in session token."""
    auth_service = AuthService(db)
    try:
        user = await auth_service.register_user(email=payload.email, password=payload.password, name=payload.name)
    except EmailAlreadyRegisteredError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    token, expires_at, _ = await auth_service.issue_app_token(user=user)
    return TokenResponse(token=token, expires_at=expires_at)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with email/password and return a session token."""
    auth_service = AuthService(db)
    try:
        user = await auth_service.authenticate_user(email=payload.email, password=payload.password)
    except InvalidCredentialsError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token, expires_at, _ = await auth_service.issue_app_token(user=user)
    return TokenResponse(token=token, expires_at=expires_at)


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """Get current user info."""
    return current_user


@router.post("/logout")
async def logout():
    """Log out. The token is stateless, so this just tells the client to discard it."""
    return {"message": "Logged out. Discard the stored token."}
