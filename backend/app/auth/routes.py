from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from jose import JWTError, jwt

from app.core.database import get_db
from app.core.security import (
    verify_password, get_password_hash, create_access_token, oauth2_scheme
)
from app.config import settings
from app.models import User, Wallet, ReliabilityScore, UserKey
from app.auth.schemas import UserRegister, UserLogin, Token, UserResponse, KeyRegister

router = APIRouter(prefix="/auth", tags=["Authentication"])

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=Token)
async def register_user(user_in: UserRegister, db: AsyncSession = Depends(get_db)):
    # Check if user already exists
    existing = await db.execute(select(User).where(User.email == user_in.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists."
        )

    # Convert lat/lon to PostGIS geometry
    geom_point = None
    if user_in.latitude is not None and user_in.longitude is not None:
        geom_point = f"SRID=4326;POINT({user_in.longitude} {user_in.latitude})"

    new_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role or "dual",
        location=geom_point,
        address_text=user_in.address_text,
        grid_substation_id=user_in.grid_substation_id or "AHMEDABAD_SUB_ZONE_1",
    )
    db.add(new_user)
    await db.flush()

    # Create associated starter Wallet with $1000 demo credits
    new_wallet = Wallet(user_id=new_user.id, available_balance=1000.0, escrow_balance=0.0)
    db.add(new_wallet)

    # Initialize pristine Reliability Score
    new_reliability = ReliabilityScore(
        user_id=new_user.id, score=100.0, total_trades_initiated=0,
        successful_transactions=0, cancelled_transactions=0, disputes_count=0
    )
    db.add(new_reliability)

    await db.commit()
    await db.refresh(new_user)

    access_token = create_access_token(subject=str(new_user.id))
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": str(new_user.id),
        "email": new_user.email,
        "full_name": new_user.full_name,
        "role": new_user.role
    }

@router.post("/login", response_model=Token)
async def login_user(user_in: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    access_token = create_access_token(subject=str(user.id))
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role
    }

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
