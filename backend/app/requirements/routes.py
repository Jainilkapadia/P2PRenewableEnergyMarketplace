from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from geoalchemy2.functions import ST_X, ST_Y
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.auth.routes import get_current_user
from app.models import EnergyRequirement, User
from app.requirements.schemas import EnergyRequirementCreate, EnergyRequirementResponse

router = APIRouter(prefix="/requirements", tags=["Consumer Energy Requirements"])

@router.post("/", response_model=EnergyRequirementResponse)
async def create_requirement(
    req_in: EnergyRequirementCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    geom_point = f"SRID=4326;POINT({req_in.longitude} {req_in.latitude})"

    new_req = EnergyRequirement(
        consumer_id=current_user.id,
        title=req_in.title,
        energy_required_kwh=req_in.energy_required_kwh,
        max_price_per_kwh=req_in.max_price_per_kwh,
        required_from=req_in.required_from,
        required_to=req_in.required_to,
        max_radius_km=req_in.max_radius_km or 15.0,
        min_seller_reliability=req_in.min_seller_reliability or 70.0,
        location=geom_point,
        grid_substation_id=req_in.grid_substation_id or current_user.grid_substation_id or "AHMEDABAD_SUB_ZONE_1",
        preferred_substation_only=req_in.preferred_substation_only or False,
        status="open"
    )
    db.add(new_req)
    await db.commit()
    await db.refresh(new_req)

    return EnergyRequirementResponse(
        id=new_req.id,
        consumer_id=new_req.consumer_id,
        consumer_name=current_user.full_name,
        title=new_req.title,
        energy_required_kwh=float(new_req.energy_required_kwh),
        max_price_per_kwh=float(new_req.max_price_per_kwh),
        required_from=new_req.required_from,
        required_to=new_req.required_to,
        max_radius_km=float(new_req.max_radius_km),
        min_seller_reliability=float(new_req.min_seller_reliability),
        grid_substation_id=new_req.grid_substation_id,
        preferred_substation_only=new_req.preferred_substation_only,
        status=new_req.status,
        latitude=req_in.latitude,
        longitude=req_in.longitude,
        created_at=new_req.created_at
    )

@router.get("/my", response_model=List[EnergyRequirementResponse])
async def list_my_requirements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(
            EnergyRequirement,
            ST_Y(EnergyRequirement.location).label("lat"),
            ST_X(EnergyRequirement.location).label("lng")
        )
        .where(EnergyRequirement.consumer_id == current_user.id)
        .order_by(EnergyRequirement.created_at.desc())
    )
    results = await db.execute(query)
    
    output = []
    for row in results.all():
        req, lat, lng = row
        output.append(EnergyRequirementResponse(
            id=req.id,
            consumer_id=req.consumer_id,
            consumer_name=current_user.full_name,
            title=req.title,
            energy_required_kwh=float(req.energy_required_kwh),
            max_price_per_kwh=float(req.max_price_per_kwh),
            required_from=req.required_from,
            required_to=req.required_to,
            max_radius_km=float(req.max_radius_km),
            min_seller_reliability=float(req.min_seller_reliability),
            grid_substation_id=req.grid_substation_id,
            preferred_substation_only=req.preferred_substation_only,
            status=req.status,
            latitude=lat or 23.0225,
            longitude=lng or 72.5714,
            created_at=req.created_at
        ))
    return output
