from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core.database import get_db
from app.auth.routes import get_current_user
from app.models import User, UserKey
from app.auth.schemas import KeyRegister

router = APIRouter(prefix="/users", tags=["Users & Crypto Keys"])

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
