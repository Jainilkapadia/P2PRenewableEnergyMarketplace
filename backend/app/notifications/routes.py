from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.auth.routes import get_current_user
from app.models import User, Notification

router = APIRouter(prefix="/notifications", tags=["Notifications"])

class NotificationResponse(BaseModel):
    id: UUID
    title: str
    message: str
    type: str
    reference_id: UUID | None = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("/", response_model=List[NotificationResponse])
async def get_my_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(desc(Notification.created_at))
        .limit(30)
    )
    res = await db.execute(stmt)
    return res.scalars().all()

@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    )
    res = await db.execute(stmt)
    notif = res.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.commit()
    return {"message": "Notification marked as read."}
