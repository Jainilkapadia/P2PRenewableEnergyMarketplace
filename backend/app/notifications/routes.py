from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, update
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.auth.routes import get_current_user
from app.models import User, Notification

router = APIRouter(prefix="/notifications", tags=["Notifications"])

# --- Schemas ---

class NotificationResponse(BaseModel):
    id: UUID
    title: str
    message: str
    type: str
    reference_id: Optional[UUID] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UnreadCountResponse(BaseModel):
    unread_count: int

class MarkAllReadResponse(BaseModel):
    message: str
    marked_count: int

# --- Reusable Helper ---

async def create_user_notification(
    db: AsyncSession,
    user_id: UUID,
    title: str,
    message: str,
    notif_type: str,
    reference_id: Optional[UUID] = None
) -> Notification:
    """
    Creates and stages a persistent in-app notification for the specified user.
    Participates atomically in the caller's database transaction without committing.
    """
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notif_type,
        reference_id=reference_id,
        is_read=False
    )
    db.add(notif)
    return notif

# --- API Endpoints ---

@router.get("/", response_model=List[NotificationResponse])
async def get_my_notifications(
    limit: int = Query(50, ge=1, le=100),
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves authenticated user's notification stream ordered by newest first."""
    stmt = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        stmt = stmt.where(Notification.is_read == False)
    stmt = stmt.order_by(desc(Notification.created_at)).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()

@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns the total number of unread notifications for the authenticated user."""
    stmt = (
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        )
    )
    count = (await db.execute(stmt)).scalar() or 0
    return UnreadCountResponse(unread_count=int(count))

@router.put("/mark-all-read", response_model=MarkAllReadResponse)
async def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Marks all unread notifications belonging to the authenticated user as read."""
    stmt = (
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        )
        .values(is_read=True)
    )
    res = await db.execute(stmt)
    await db.commit()
    return MarkAllReadResponse(
        message="All notifications marked as read.",
        marked_count=res.rowcount or 0
    )

@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Marks a specific notification as read, enforcing strict user ownership."""
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    )
    res = await db.execute(stmt)
    notif = res.scalar_one_or_none()
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found or access denied."
        )
    notif.is_read = True
    await db.commit()
    return {"message": "Notification marked as read.", "id": str(notif.id)}
