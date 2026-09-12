from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
from geoalchemy2.functions import ST_X, ST_Y

from app.core.database import get_db
from app.auth.routes import get_current_user
from app.models import User, UserKey
from app.auth.schemas import KeyRegister, UserResponse

router = APIRouter(prefix="/users", tags=["Users & Crypto Keys"])

@router.get("/", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all registered grid nodes and prosumer/consumer identities.
    """
    stmt = select(
        User,
        ST_Y(User.location).label("lat"),
        ST_X(User.location).label("lng")
    ).order_by(User.created_at.asc())
    res = await db.execute(stmt)
    users_out = []
    for row in res.all():
        u, lat, lng = row
        users_out.append(UserResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            address_text=u.address_text,
            grid_substation_id=u.grid_substation_id,
            latitude=lat,
            longitude=lng
        ))
    return users_out

@router.post("/keys/register")
async def register_public_key(
    key_in: KeyRegister,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Registers or updates the user's active Ed25519 public key.
    """
    # Deactivate previous keys for this user
    existing_keys = await db.execute(
        select(UserKey).where(UserKey.user_id == current_user.id)
    )
    for key in existing_keys.scalars().all():
        key.is_active = False

    new_key = UserKey(
        user_id=current_user.id,
        public_key_hex=key_in.public_key_hex,
        algorithm=key_in.algorithm or "Ed25519",
        is_active=True
    )
    db.add(new_key)
    await db.commit()
    return {"message": "Public key successfully registered and active."}

@router.get("/{user_id}/public-key")
async def get_user_public_key(user_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    Retrieves the active public key for a given user ID to allow peer verification.
    """
    result = await db.execute(
        select(UserKey).where(
            UserKey.user_id == user_id,
            UserKey.is_active == True
        ).order_by(UserKey.created_at.desc())
    )
    key = result.scalars().first()
    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active public key not found for this user."
        )
    return {
        "user_id": str(user_id),
        "public_key_hex": key.public_key_hex,
        "algorithm": key.algorithm
    }
