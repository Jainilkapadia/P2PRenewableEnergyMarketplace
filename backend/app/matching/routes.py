from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core.database import get_db
from app.auth.routes import get_current_user
from app.models import User, EnergyRequirement
from app.matching.schemas import MatchQueryRequest, MatchSearchResponse
from app.matching.engine import execute_constraint_matching, find_matches_for_requirement

router = APIRouter(prefix="/matching", tags=["Smart Matching Engine"])

@router.get("/{requirement_id}", response_model=MatchSearchResponse)
async def get_matches_for_requirement(
    requirement_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Executes the multi-factor smart matching algorithm for a specific consumer requirement.
    Enforces RBAC / privacy boundaries: only the requirement owner or an admin can access matches.
    """
    # 1. Fetch requirement
    res = await db.execute(select(EnergyRequirement).where(EnergyRequirement.id == requirement_id))
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Energy requirement with ID {requirement_id} not found."
        )

    # 2. Authorization check
    user_role = (current_user.role or "").lower()
    if req.consumer_id != current_user.id and user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to run or view matches for this private energy requirement."
        )

    # 3. Find and rank matches
    return await find_matches_for_requirement(requirement_id, db)

@router.post("/find-matches", response_model=MatchSearchResponse)
async def find_matches(
    query: MatchQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Executes constraint matching for ad-hoc queries and returns ranked, explainable matches.
    """
    return await execute_constraint_matching(query, db)

