import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone, timedelta
from uuid import UUID, uuid4
from decimal import Decimal
from unittest.mock import MagicMock, patch

from main import app
from app.config import settings
from app.core.database import AsyncSessionLocal
from app.core.security import create_access_token
from app.core.crypto import (
    generate_ed25519_keypair,
    sign_payload_ed25519,
    build_canonical_trade_payload,
    compute_sha256_hash,
    compute_audit_block_hash
)
from app.models import User, UserKey, Trade, TradeVerification, EnergyListing
from app.verification.blockchain_service import (
    blockchain_service,
    BlockchainService,
    BlockchainServiceError,
    BlockchainConnectionError
)

# Seeded users in database
SELLER_ID = UUID("11111111-1111-1111-1111-111111111111")  # Aarav Sharma (Seller)
BUYER_ID = UUID("22222222-2222-2222-2222-222222222222")   # Priya Patel (Buyer)
UNAUTHORIZED_ID = UUID("33333333-3333-3333-3333-333333333333") # Rohan Verma
SEED_LISTING_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

@pytest_asyncio.fixture(scope="function")
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest_asyncio.fixture(scope="function")
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session

def get_prosumer_headers():
    token = create_access_token(subject=str(SELLER_ID))
    return {"Authorization": f"Bearer {token}"}

def get_consumer_headers():
    token = create_access_token(subject=str(BUYER_ID))
    return {"Authorization": f"Bearer {token}"}

def get_unauthorized_headers():
    token = create_access_token(subject=str(UNAUTHORIZED_ID))
    return {"Authorization": f"Bearer {token}"}


# =========================================================================
# 1. CONFIGURATION, HASH CONVERSION & SCALING UNIT TESTS
# =========================================================================

def test_1_blockchain_configuration_defaults():
    """Verify that blockchain settings load valid defaults."""
    assert settings.BLOCKCHAIN_RPC_URL.startswith("http")
    assert settings.BLOCKCHAIN_CHAIN_ID == 31337
    assert len(settings.ENERGY_DEAL_REGISTRY_ADDRESS) == 42
    assert settings.ENERGY_DEAL_REGISTRY_ADDRESS.startswith("0x")

def test_2_hash_conversion_to_bytes32():
    """Verify deterministic conversion of 64-char SHA-256 hex string to 32 bytes."""
    valid_sha256_hex = "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"
    bytes32_val = BlockchainService.format_hash_to_bytes32(valid_sha256_hex)
    assert len(bytes32_val) == 32
    assert bytes32_val.hex() == valid_sha256_hex

    # With 0x prefix
    bytes32_prefixed = BlockchainService.format_hash_to_bytes32("0x" + valid_sha256_hex)
    assert bytes32_prefixed == bytes32_val

def test_3_invalid_hash_rejected():
    """Verify malformed hash strings are rejected with ValueError."""
    with pytest.raises(ValueError):
        BlockchainService.format_hash_to_bytes32("too-short")

    with pytest.raises(ValueError):
        BlockchainService.format_hash_to_bytes32("g" * 64)  # Invalid hex char 'g'

    with pytest.raises(ValueError):
        BlockchainService.format_hash_to_bytes32("")

def test_4_deterministic_numeric_scaling():
    """Verify exact 2-decimal scaling (kWh and INR) without floating point loss."""
    assert BlockchainService.scale_numeric_value(35.00) == 3500
    assert BlockchainService.scale_numeric_value(25.50) == 2550
    assert BlockchainService.scale_numeric_value(203.00) == 20300
    assert BlockchainService.scale_numeric_value(145.55) == 14555
    assert BlockchainService.scale_numeric_value(Decimal("0.05")) == 5


# =========================================================================
# 2. REST API & PERSISTENT ANCHORING INTEGRATION TESTS
# =========================================================================

async def create_verified_test_trade(db_session, buyer_id=BUYER_ID, seller_id=SELLER_ID, energy_kwh=25.0, unit_price=5.8):
    """Helper to create a fully dual-signed verified trade fixture using seeded entities."""
    now = datetime.now(timezone.utc)
    trade_id = uuid4()
    total_cost = round(energy_kwh * unit_price, 4)

    trade = Trade(
        id=trade_id,
        buyer_id=buyer_id,
        seller_id=seller_id,
        listing_id=SEED_LISTING_ID,
        energy_amount_kwh=energy_kwh,
        unit_price=unit_price,
        total_amount=total_cost,
        status="fully_verified",
        delivery_start=now,
        delivery_end=now + timedelta(hours=8)
    )
    db_session.add(trade)
    await db_session.flush()

    canonical_dict = build_canonical_trade_payload(
        trade_id=str(trade.id),
        buyer_id=str(trade.buyer_id),
        seller_id=str(trade.seller_id),
        listing_id=str(trade.listing_id),
        energy_kwh=float(trade.energy_amount_kwh),
        unit_price=float(trade.unit_price),
        total_amount=float(trade.total_amount),
        currency="INR",
        delivery_start=trade.delivery_start,
        delivery_end=trade.delivery_end
    )
    trade_hash = compute_sha256_hash(canonical_dict)

    b_priv, b_pub = generate_ed25519_keypair()
    s_priv, s_pub = generate_ed25519_keypair()
    b_sig = sign_payload_ed25519(b_priv, trade_hash)
    s_sig = sign_payload_ed25519(s_priv, trade_hash)

    b_key = UserKey(user_id=buyer_id, public_key_hex=b_pub, algorithm="Ed25519", is_active=True)
    s_key = UserKey(user_id=seller_id, public_key_hex=s_pub, algorithm="Ed25519", is_active=True)
    db_session.add(b_key)
    db_session.add(s_key)

    ref_code = f"P2P-VRF-{int(now.timestamp())}-{trade_hash[:8].upper()}"
    prev_hash = "0" * 64
    block_hash = compute_audit_block_hash(
        previous_hash=prev_hash,
        trade_canonical_hash=trade_hash,
        buyer_signature_hex=b_sig,
        seller_signature_hex=s_sig,
        verified_at=now
    )

    verification = TradeVerification(
        trade_id=trade.id,
        trade_canonical_hash=trade_hash,
        verification_reference=ref_code,
        buyer_signature_hex=b_sig,
        buyer_signed_at=now,
        seller_signature_hex=s_sig,
        seller_signed_at=now,
        is_fully_verified=True,
        verified_at=now,
        audit_chain_previous_hash=prev_hash,
        current_block_hash=block_hash,
        blockchain_status="unanchored"
    )
    db_session.add(verification)
    await db_session.commit()
    await db_session.refresh(trade)
    await db_session.refresh(verification)
    return trade, verification

async def test_5_unauthorized_user_cannot_anchor_trade(client, db_session):
    """Verify that an unrelated user cannot anchor another user's trade."""
    trade, _ = await create_verified_test_trade(db_session, BUYER_ID, SELLER_ID)

    # Use unauthorized user credentials (Rohan Verma)
    resp = await client.post(f"/api/v1/verification/trades/{trade.id}/anchor", headers=get_unauthorized_headers())
    assert resp.status_code == 403
    assert "Forbidden" in resp.json()["detail"]

async def test_6_partially_signed_trade_cannot_be_anchored(client, db_session):
    """Verify that a trade that is not fully verified cannot be anchored."""
    now = datetime.now(timezone.utc)
    trade_id = uuid4()

    trade = Trade(
        id=trade_id,
        buyer_id=BUYER_ID,
        seller_id=SELLER_ID,
        listing_id=SEED_LISTING_ID,
        energy_amount_kwh=10.0,
        unit_price=5.0,
        total_amount=50.0,
        status="pending_signatures",
        delivery_start=now,
        delivery_end=now + timedelta(hours=8)
    )
    db_session.add(trade)
    await db_session.flush()

    verif = TradeVerification(
        trade_id=trade.id,
        trade_canonical_hash="0" * 64,
        verification_reference=f"P2P-VRF-{int(now.timestamp())}-00000000",
        is_fully_verified=False,
        blockchain_status="unanchored"
    )
    db_session.add(verif)
    await db_session.commit()

    resp = await client.post(f"/api/v1/verification/trades/{trade.id}/anchor", headers=get_consumer_headers())
    assert resp.status_code == 400
    assert "not fully verified" in resp.json()["detail"].lower()

async def test_7_unanchored_trade_reports_unanchored_proof(client, db_session):
    """Verify that get blockchain proof reports unanchored for fresh verified trade."""
    trade, verif = await create_verified_test_trade(db_session, BUYER_ID, SELLER_ID)

    resp = await client.get(f"/api/v1/verification/trades/{trade.id}/blockchain-proof", headers=get_consumer_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert data["trade_id"] == str(trade.id)
    assert data["blockchain_status"] == "unanchored"
    assert data["blockchain_tx_hash"] is None

async def test_8_successful_blockchain_anchor_and_receipt(client, db_session):
    """Verify full end-to-end anchoring flow and database receipt persistence."""
    trade, verif = await create_verified_test_trade(db_session, BUYER_ID, SELLER_ID, energy_kwh=35.0, unit_price=5.8)

    mock_anchor_result = {
        "trade_id": str(trade.id),
        "verification_reference": verif.verification_reference,
        "trade_canonical_hash": verif.trade_canonical_hash,
        "blockchain_status": "anchored",
        "blockchain_tx_hash": "0x" + "a" * 64,
        "blockchain_block_number": 42,
        "blockchain_contract_address": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        "blockchain_anchored_at": datetime.now(timezone.utc),
        "already_registered": False
    }

    with patch.object(blockchain_service, "anchor_trade", return_value=mock_anchor_result), \
         patch.object(blockchain_service, "get_deal", return_value={"trade_id": str(trade.id), "trade_canonical_hash": verif.trade_canonical_hash}):
        resp = await client.post(f"/api/v1/verification/trades/{trade.id}/anchor", headers=get_consumer_headers())
        assert resp.status_code == 200
        data = resp.json()
        assert data["blockchain_status"] == "anchored"
        assert data["blockchain_tx_hash"] == "0x" + "a" * 64
        assert data["blockchain_block_number"] == 42
        assert data["is_on_chain_verified"] is True

async def test_9_duplicate_anchor_idempotency(client, db_session):
    """Verify that anchoring an already-anchored trade is idempotent and succeeds without duplicate tx."""
    trade, verif = await create_verified_test_trade(db_session, BUYER_ID, SELLER_ID)

    # Set as already anchored in DB
    verif.blockchain_status = "anchored"
    verif.blockchain_tx_hash = "0x" + "b" * 64
    verif.blockchain_block_number = 100
    verif.blockchain_contract_address = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    verif.blockchain_anchored_at = datetime.now(timezone.utc)
    await db_session.commit()

    resp = await client.post(f"/api/v1/verification/trades/{trade.id}/anchor", headers=get_consumer_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert data["blockchain_status"] == "anchored"
    assert data["blockchain_tx_hash"] == "0x" + "b" * 64
    assert "already anchored" in data["message"].lower()

async def test_10_cross_trade_isolation(client, db_session):
    """Verify strict isolation between Trade A and Trade B blockchain state."""
    trade_a, verif_a = await create_verified_test_trade(db_session, BUYER_ID, SELLER_ID, energy_kwh=10.0, unit_price=5.0)
    trade_b, verif_b = await create_verified_test_trade(db_session, BUYER_ID, SELLER_ID, energy_kwh=20.0, unit_price=6.0)

    verif_a.blockchain_status = "anchored"
    verif_a.blockchain_tx_hash = "0x" + "1" * 64
    verif_a.blockchain_block_number = 10

    verif_b.blockchain_status = "anchored"
    verif_b.blockchain_tx_hash = "0x" + "2" * 64
    verif_b.blockchain_block_number = 20
    await db_session.commit()

    resp_a = await client.get(f"/api/v1/verification/trades/{trade_a.id}/blockchain-proof", headers=get_consumer_headers())
    resp_b = await client.get(f"/api/v1/verification/trades/{trade_b.id}/blockchain-proof", headers=get_consumer_headers())

    assert resp_a.json()["blockchain_tx_hash"] == "0x" + "1" * 64
    assert resp_b.json()["blockchain_tx_hash"] == "0x" + "2" * 64
    assert resp_a.json()["trade_id"] != resp_b.json()["trade_id"]

async def test_11_rpc_failure_does_not_invalidate_milestone_5(client, db_session):
    """Verify that an RPC node outage returns a service error but preserves Milestone 5 verification."""
    trade, verif = await create_verified_test_trade(db_session, BUYER_ID, SELLER_ID)

    with patch.object(blockchain_service, "anchor_trade", side_effect=BlockchainConnectionError("RPC Node Offline")):
        resp = await client.post(f"/api/v1/verification/trades/{trade.id}/anchor", headers=get_consumer_headers())
        assert resp.status_code == 503
        assert "Blockchain anchoring failed" in resp.json()["detail"]

    # Verify Milestone 5 DB record is NOT damaged
    await db_session.refresh(trade)
    await db_session.refresh(verif)
    assert trade.status == "fully_verified"
    assert verif.is_fully_verified is True
    assert verif.blockchain_status == "failed"

async def test_12_already_on_chain_recovery(client, db_session):
    """Verify that if blockchain already has the record, proof endpoint reconciles DB status."""
    trade, verif = await create_verified_test_trade(db_session, BUYER_ID, SELLER_ID)

    mock_deal = {
        "trade_id": str(trade.id),
        "verification_reference": verif.verification_reference,
        "trade_canonical_hash": verif.trade_canonical_hash,
        "energy_amount_kwh_scaled": 2500,
        "total_amount_scaled": 14500,
        "anchored_at": datetime.now(timezone.utc),
        "anchored_by": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
    }

    with patch.object(blockchain_service, "is_connected", return_value=True), \
         patch.object(blockchain_service, "get_deal", return_value=mock_deal), \
         patch.object(blockchain_service, "verify_deal_hash", return_value=True):
        resp = await client.get(f"/api/v1/verification/trades/{trade.id}/blockchain-proof", headers=get_consumer_headers())
        assert resp.status_code == 200
        data = resp.json()
        assert data["blockchain_status"] == "anchored"
        assert data["is_on_chain_verified"] is True

        # Check DB was reconciled
        await db_session.refresh(verif)
        assert verif.blockchain_status == "anchored"

async def test_13_contract_hash_verification_tamper_detection(client, db_session):
    """Verify that tamper verification compares against on-chain hash when anchored."""
    trade, verif = await create_verified_test_trade(db_session, BUYER_ID, SELLER_ID)

    verif.blockchain_status = "anchored"
    verif.blockchain_tx_hash = "0x" + "c" * 64
    await db_session.commit()

    # 1. Authentic verify
    with patch.object(blockchain_service, "is_connected", return_value=True), \
         patch.object(blockchain_service, "get_deal", return_value={"trade_canonical_hash": verif.trade_canonical_hash}), \
         patch.object(blockchain_service, "verify_deal_hash", return_value=True):
        resp = await client.post("/api/v1/verification/verify", json={"trade_id": str(trade.id)})
        assert resp.status_code == 200
        data = resp.json()
        assert data["verified"] is True
        assert data["blockchain_verified"] is True

    # 2. Tampered verify (simulating modified price)
    with patch.object(blockchain_service, "is_connected", return_value=True), \
         patch.object(blockchain_service, "get_deal", return_value={"trade_canonical_hash": verif.trade_canonical_hash}), \
         patch.object(blockchain_service, "verify_deal_hash", return_value=False):
        resp = await client.post(
            "/api/v1/verification/verify",
            json={"trade_id": str(trade.id), "tampered_payload": {"trade_id": str(trade.id), "unit_price": 99.0}}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["verified"] is False
        assert data["blockchain_verified"] is False
        assert "Blockchain anchor mismatch" in data["details"]
