from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.matching.schemas import MatchQueryRequest, MatchSearchResponse
from app.matching.engine import execute_constraint_matching

router = APIRouter(prefix="/matching", tags=["Smart Matching Engine"])

@router.post("/find-matches", response_model=MatchSearchResponse)
async def find_matches(
    query: MatchQueryRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Executes the constraint-based matching algorithm and returns ranked, explainable matches.
    """
    return await execute_constraint_matching(query, db)
