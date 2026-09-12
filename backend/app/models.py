import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, Numeric, Integer, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geometry
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False, default="dual")
    location = Column(Geometry("POINT", srid=4326))
    address_text = Column(String(255))
    grid_substation_id = Column(String(50), nullable=False, default="AHMEDABAD_SUB_ZONE_1")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class UserKey(Base):
    __tablename__ = "user_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    public_key_hex = Column(Text, nullable=False)
    algorithm = Column(String(20), nullable=False, default="Ed25519")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class EnergyListing(Base):
    __tablename__ = "energy_listings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prosumer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(150), nullable=False, default="Rooftop Solar Clean Surplus")
    energy_available_kwh = Column(Numeric(10, 2), nullable=False)
    energy_remaining_kwh = Column(Numeric(10, 2), nullable=False)
    price_per_kwh = Column(Numeric(10, 4), nullable=False)
    available_from = Column(DateTime(timezone=True), nullable=False)
    available_to = Column(DateTime(timezone=True), nullable=False)
    source_type = Column(String(30), default="solar_rooftop")
    location = Column(Geometry("POINT", srid=4326), nullable=False)
    grid_substation_id = Column(String(50), nullable=False, default="AHMEDABAD_SUB_ZONE_1")
    status = Column(String(20), nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class EnergyRequirement(Base):
    __tablename__ = "energy_requirements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    consumer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(150), nullable=False, default="EV / Household Clean Energy Demand")
    energy_required_kwh = Column(Numeric(10, 2), nullable=False)
    max_price_per_kwh = Column(Numeric(10, 4), nullable=False)
    required_from = Column(DateTime(timezone=True), nullable=False)
    required_to = Column(DateTime(timezone=True), nullable=False)
    max_radius_km = Column(Numeric(6, 2), nullable=False, default=15.0)
    min_seller_reliability = Column(Numeric(4, 2), nullable=False, default=70.0)
    location = Column(Geometry("POINT", srid=4326))
    grid_substation_id = Column(String(50), nullable=False, default="AHMEDABAD_SUB_ZONE_1")
    preferred_substation_only = Column(Boolean, default=False)
    status = Column(String(20), nullable=False, default="open")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class Trade(Base):
    __tablename__ = "trades"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    buyer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    seller_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    listing_id = Column(UUID(as_uuid=True), ForeignKey("energy_listings.id"), nullable=False)
    requirement_id = Column(UUID(as_uuid=True), ForeignKey("energy_requirements.id"), nullable=True)
    energy_amount_kwh = Column(Numeric(10, 2), nullable=False)
    unit_price = Column(Numeric(10, 4), nullable=False)
    total_amount = Column(Numeric(12, 4), nullable=False)
    status = Column(String(30), nullable=False, default="matched")
    delivery_start = Column(DateTime(timezone=True), nullable=False)
    delivery_end = Column(DateTime(timezone=True), nullable=False)
    match_score_snapshot = Column(Numeric(5, 2), nullable=True)
    match_explanation = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class TradeVerification(Base):
    __tablename__ = "trade_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trade_id = Column(UUID(as_uuid=True), ForeignKey("trades.id", ondelete="CASCADE"), unique=True, nullable=False)
    trade_canonical_hash = Column(String(64), nullable=False)
    buyer_signature_hex = Column(Text, nullable=True)
    buyer_signed_at = Column(DateTime(timezone=True), nullable=True)
    seller_signature_hex = Column(Text, nullable=True)
    seller_signed_at = Column(DateTime(timezone=True), nullable=True)
    is_fully_verified = Column(Boolean, default=False)
    verification_reference = Column(String(100), unique=True, nullable=False)
    audit_chain_previous_hash = Column(String(64), nullable=True)
    current_block_hash = Column(String(64), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)

class ReliabilityScore(Base):
    __tablename__ = "reliability_scores"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    score = Column(Numeric(5, 2), nullable=False, default=100.0)
    total_trades_initiated = Column(Integer, default=0, nullable=False)
    successful_transactions = Column(Integer, default=0, nullable=False)
    cancelled_transactions = Column(Integer, default=0, nullable=False)
    disputes_count = Column(Integer, default=0, nullable=False)
    completed_energy_kwh = Column(Numeric(12, 2), default=0.0, nullable=False)
    last_updated = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    available_balance = Column(Numeric(14, 4), nullable=False, default=1000.0000)
    escrow_balance = Column(Numeric(14, 4), nullable=False, default=0.0000)
    currency = Column(String(10), default="INR")
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wallet_id = Column(UUID(as_uuid=True), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False)
    trade_id = Column(UUID(as_uuid=True), ForeignKey("trades.id"), nullable=True)
    transaction_type = Column(String(30), nullable=False)
    amount = Column(Numeric(14, 4), nullable=False)
    balance_after = Column(Numeric(14, 4), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), nullable=False)
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class Dispute(Base):
    __tablename__ = "disputes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trade_id = Column(UUID(as_uuid=True), ForeignKey("trades.id", ondelete="CASCADE"), nullable=False)
    raised_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(20), default="pending")
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
