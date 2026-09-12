import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone, timedelta
from uuid import uuid4

from main import app
from app.core.database import AsyncSessionLocal, engine
from app.core.security import create_access_token
from app.core.crypto import (
    canonicalize_payload,
    compute_sha256_hash,
    build_canonical_trade_payload,
    compute_audit_block_hash,
    generate_ed25519_keypair,
    sign_payload_ed25519,
    verify_ed25519_signature
)

@pytest_asyncio.fixture(scope="function")
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

def get_prosumer_headers():
    # Aarav Sharma (Seller)
    token = create_access_token(subject="11111111-1111-1111-1111-111111111111")
    return {"Authorization": f"Bearer {token}"}

def get_consumer_headers():
    # Priya Patel (Buyer)
    token = create_access_token(subject="22222222-2222-2222-2222-222222222222")
    return {"Authorization": f"Bearer {token}"}

def get_dual_headers():
    token = create_access_token(subject="33333333-3333-3333-3333-333333333333")
    return {"Authorization": f"Bearer {token}"}

def get_admin_headers():
    token = create_access_token(subject="55555555-5555-5555-5555-555555555555")
    return {"Authorization": f"Bearer {token}"}


# =========================================================================
# 1. CRYPTOGRAPHIC CORE & CANONICALIZATION TESTS
# =========================================================================

def test_canonical_trade_payload_deterministic_ordering():
    """Verify that key insertion order or formatting differences do not change the canonical JSON or SHA-256 hash."""
    payload_a = {
        "trade_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "buyer_id": "22222222-2222-2222-2222-222222222222",
        "seller_id": "11111111-1111-1111-1111-111111111111",
        "listing_id": "33333333-3333-3333-3333-333333333333",
        "energy_kwh": 25.0,
        "unit_price": 5.80,
        "total_amount": 145.0,
        "currency": "INR",
        "delivery_window": "2026-09-12T10:00:00Z_to_2026-09-12T16:00:00Z"
    }

    # Different key ordering
    payload_b = {
        "currency": "INR",
        "delivery_window": "2026-09-12T10:00:00Z_to_2026-09-12T16:00:00Z",
        "total_amount": 145.0,
        "unit_price": 5.80,
        "energy_kwh": 25.0,
        "listing_id": "33333333-3333-3333-3333-333333333333",
        "seller_id": "11111111-1111-1111-1111-111111111111",
        "buyer_id": "22222222-2222-2222-2222-222222222222",
        "trade_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
    }

    str_a = canonicalize_payload(payload_a)
    str_b = canonicalize_payload(payload_b)
    assert str_a == str_b

    hash_a = compute_sha256_hash(payload_a)
    hash_b = compute_sha256_hash(payload_b)
    assert hash_a == hash_b
    assert len(hash_a) == 64

def test_hash_invariance_and_tamper_sensitivity():
    """Even a 1 paise change in unit_price alters the SHA-256 hash completely."""
    base_payload = {
        "trade_id": "test-trade-uuid",
        "buyer_id": "buyer-uuid",
        "seller_id": "seller-uuid",
        "listing_id": "listing-uuid",
        "energy_kwh": 25.0,
        "unit_price": 5.8000,
        "total_amount": 145.0000,
        "currency": "INR",
        "delivery_window": "2026-09-12T10:00:00Z_to_2026-09-12T16:00:00Z"
    }
    tampered_payload = {
        **base_payload,
        "unit_price": 5.8100  # 1 paise change
    }

    base_hash = compute_sha256_hash(base_payload)
    tampered_hash = compute_sha256_hash(tampered_payload)

    assert base_hash != tampered_hash
    assert len(base_hash) == 64
    assert len(tampered_hash) == 64

def test_ed25519_key_and_signature_lifecycle():
    """Verify Ed25519 asymmetric signature generation, verification, and tamper rejection."""
    priv_hex, pub_hex = generate_ed25519_keypair()
    assert len(priv_hex) == 64
    assert len(pub_hex) == 64

    message = "8f4a1029c7e30d176b92a543f01948329ef01a8421c97a493b8e716e1a0b5b12"
    sig_hex = sign_payload_ed25519(priv_hex, message)
    assert len(sig_hex) == 128

    # Valid
    assert verify_ed25519_signature(pub_hex, message, sig_hex) is True

    # Tampered message
    tampered_msg = "3e9b1140df8821045a8cd41209bca7105fe881023a9b18361730cf192305ca71"
    assert verify_ed25519_signature(pub_hex, tampered_msg, sig_hex) is False

    # Wrong public key
    _, other_pub_hex = generate_ed25519_keypair()
    assert verify_ed25519_signature(other_pub_hex, message, sig_hex) is False

def test_audit_chain_block_hash_determinism():
    """Verify linked audit chain block calculation."""
    genesis_prev = "0" * 64
    trade_hash = "8f4a1029c7e30d176b92a543f01948329ef01a8421c97a493b8e716e1a0b5b12"
    buyer_sig = "a" * 128
    seller_sig = "b" * 128
    ts = datetime(2026, 9, 12, 12, 0, 0, tzinfo=timezone.utc)

    block_hash_1 = compute_audit_block_hash(genesis_prev, trade_hash, buyer_sig, seller_sig, ts)
    block_hash_2 = compute_audit_block_hash(genesis_prev, trade_hash, buyer_sig, seller_sig, ts)
    assert block_hash_1 == block_hash_2
    assert len(block_hash_1) == 64

    # Different previous block produces different block hash
    block_hash_alt = compute_audit_block_hash("f" * 64, trade_hash, buyer_sig, seller_sig, ts)
    assert block_hash_1 != block_hash_alt


# =========================================================================
# 2. FULL BUYER-SELLER DUAL SIGNING WORKFLOW & REST API TESTS
# =========================================================================

async def test_full_dual_party_signing_and_verification_workflow(client: AsyncClient):
    """
    Complete end-to-end integration test:
    1. Buyer (Priya) and Seller (Aarav) generate and register Ed25519 public keys.
    2. Prosumer creates an active listing.
    3. Buyer initiates a trade.
    4. Verify initial pending_signatures status.
    5. Buyer signs canonical trade hash.
    6. Seller signs canonical trade hash.
    7. Verify state transition to fully_verified with linked audit block.
    8. Verify receipt lookup by reference code.
    9. Run tamper-detection API endpoint.
    """
    buyer_headers = get_consumer_headers()
    seller_headers = get_prosumer_headers()

    # Step 1: Generate & Register Ed25519 Keypairs
    buyer_priv, buyer_pub = generate_ed25519_keypair()
    seller_priv, seller_pub = generate_ed25519_keypair()

    reg_b = await client.post("/api/v1/verification/keys/register", json={"public_key_hex": buyer_pub, "algorithm": "Ed25519"}, headers=buyer_headers)
    assert reg_b.status_code == 200

    reg_s = await client.post("/api/v1/verification/keys/register", json={"public_key_hex": seller_pub, "algorithm": "Ed25519"}, headers=seller_headers)
    assert reg_s.status_code == 200

    # Step 2: Prosumer creates a listing
    now = datetime.now(timezone.utc)
    listing_payload = {
        "title": "Solar Roof Verifiable Array",
        "energy_available_kwh": 30.0,
        "price_per_kwh": 5.80,
        "available_from": (now + timedelta(hours=1)).isoformat(),
        "available_to": (now + timedelta(hours=5)).isoformat(),
        "source_type": "solar_rooftop",
        "latitude": 23.0300,
        "longitude": 72.5180,
        "grid_substation_id": "AHMEDABAD_SUB_ZONE_1"
    }
    l_resp = await client.post("/api/v1/listings/", json=listing_payload, headers=seller_headers)
    assert l_resp.status_code == 201
    listing_id = l_resp.json()["id"]

    # Step 3: Buyer initiates a trade
    trade_payload = {
        "listing_id": listing_id,
        "energy_amount_kwh": 20.0,
        "unit_price": 5.80,
        "match_score": 95.0,
        "match_explanation": {"summary": "Direct solar match"}
    }
    t_resp = await client.post("/api/v1/trades/initiate", json=trade_payload, headers=buyer_headers)
    assert t_resp.status_code == 200
    trade_data = t_resp.json()
    trade_id = trade_data["id"]
    assert trade_data["status"] == "pending_signatures"

    # Step 4: Inspect verification record before signing
    v_resp = await client.get(f"/api/v1/verification/trades/{trade_id}", headers=buyer_headers)
    assert v_resp.status_code == 200
    v_data = v_resp.json()
    assert v_data["is_fully_verified"] is False
    assert v_data["buyer_verification"] is None
    assert v_data["seller_verification"] is None
    trade_canonical_hash = v_data["trade_canonical_hash"]
    assert len(trade_canonical_hash) == 64

    # Step 5: Buyer signs canonical hash
    buyer_sig = sign_payload_ed25519(buyer_priv, trade_canonical_hash)
    b_sign_resp = await client.post(
        f"/api/v1/verification/trades/{trade_id}/buyer-sign",
        json={"signature_hex": buyer_sig},
        headers=buyer_headers
    )
    assert b_sign_resp.status_code == 200
    b_sign_data = b_sign_resp.json()
    assert b_sign_data["is_fully_verified"] is False
    assert b_sign_data["buyer_verification"] is not None
    assert b_sign_data["buyer_verification"]["is_valid"] is True
    assert b_sign_data["seller_verification"] is None

    # Step 6: Seller signs canonical hash
    seller_sig = sign_payload_ed25519(seller_priv, trade_canonical_hash)
    s_sign_resp = await client.post(
        f"/api/v1/verification/trades/{trade_id}/seller-sign",
        json={"signature_hex": seller_sig},
        headers=seller_headers
    )
    assert s_sign_resp.status_code == 200
    s_sign_data = s_sign_resp.json()

    # Step 7: Fully verified state reached
    assert s_sign_data["is_fully_verified"] is True
    assert s_sign_data["buyer_verification"]["is_valid"] is True
    assert s_sign_data["seller_verification"]["is_valid"] is True
    assert s_sign_data["current_block_hash"] is not None
    assert len(s_sign_data["current_block_hash"]) == 64
    assert s_sign_data["audit_chain_previous_hash"] is not None
    ref_code = s_sign_data["verification_reference"]
    assert ref_code.startswith("P2P-VRF-")

    # Step 8: Public receipt inspection
    receipt_resp = await client.get(f"/api/v1/verification/receipts/{ref_code}")
    assert receipt_resp.status_code == 200
    receipt_data = receipt_resp.json()
    assert receipt_data["trade_id"] == trade_id
    assert receipt_data["is_fully_verified"] is True

    # Step 9: Tamper detection API verification
    # 9a. Authentic verification passes
    tamper_check_valid = await client.post(
        "/api/v1/verification/verify",
        json={"trade_id": trade_id}
    )
    assert tamper_check_valid.status_code == 200
    val_res = tamper_check_valid.json()
    assert val_res["verified"] is True
    assert val_res["hash_valid"] is True
    assert val_res["buyer_signature_valid"] is True
    assert val_res["seller_signature_valid"] is True
    assert val_res["audit_chain_valid"] is True

    # 9b. Tampered payload is caught and rejected
    tampered_payload = dict(v_data["canonical_payload"])
    tampered_payload["unit_price"] = 5.81  # 1 paise tamper
    tamper_check_invalid = await client.post(
        "/api/v1/verification/verify",
        json={"trade_id": trade_id, "tampered_payload": tampered_payload}
    )
    assert tamper_check_invalid.status_code == 200
    inval_res = tamper_check_invalid.json()
    assert inval_res["verified"] is False
    assert inval_res["hash_valid"] is False
    assert "Payload altered" in inval_res["details"]


# =========================================================================
# 3. AUTHORIZATION & SECURITY BOUNDARY TESTS
# =========================================================================

async def test_signing_authorization_enforcement(client: AsyncClient):
    """
    Enforce security rules:
    - Non-buyer cannot submit buyer signature (403).
    - Non-seller cannot submit seller signature (403).
    - Unrelated party cannot inspect trade verification (403).
    - Invalid signature rejected (400).
    """
    buyer_headers = get_consumer_headers()
    seller_headers = get_prosumer_headers()
    unrelated_headers = get_dual_headers()

    # Create listing & trade
    now = datetime.now(timezone.utc)
    l_resp = await client.post("/api/v1/listings/", json={
        "title": "Solar Auth Test Listing",
        "energy_available_kwh": 20.0,
        "price_per_kwh": 6.0,
        "available_from": (now + timedelta(hours=1)).isoformat(),
        "available_to": (now + timedelta(hours=5)).isoformat(),
        "source_type": "solar_rooftop",
        "latitude": 23.0300,
        "longitude": 72.5180,
        "grid_substation_id": "AHMEDABAD_SUB_ZONE_1"
    }, headers=seller_headers)
    listing_id = l_resp.json()["id"]

    t_resp = await client.post("/api/v1/trades/initiate", json={
        "listing_id": listing_id,
        "energy_amount_kwh": 10.0,
        "unit_price": 6.0
    }, headers=buyer_headers)
    trade_id = t_resp.json()["id"]

    # Seller attempts to submit buyer signature -> 403 Forbidden
    resp_bad_buyer = await client.post(
        f"/api/v1/verification/trades/{trade_id}/buyer-sign",
        json={"signature_hex": "aa" * 64},
        headers=seller_headers
    )
    assert resp_bad_buyer.status_code == 403

    # Buyer attempts to submit seller signature -> 403 Forbidden
    resp_bad_seller = await client.post(
        f"/api/v1/verification/trades/{trade_id}/seller-sign",
        json={"signature_hex": "bb" * 64},
        headers=buyer_headers
    )
    assert resp_bad_seller.status_code == 403

    # Unrelated user attempts to inspect trade -> 403 Forbidden
    resp_bad_inspect = await client.get(
        f"/api/v1/verification/trades/{trade_id}",
        headers=unrelated_headers
    )
    assert resp_bad_inspect.status_code == 403

    # Invalid signature by buyer -> 400 Bad Request
    resp_fake_sig = await client.post(
        f"/api/v1/verification/trades/{trade_id}/buyer-sign",
        json={"signature_hex": "ff" * 64},
        headers=buyer_headers
    )
    assert resp_fake_sig.status_code == 400
    assert "verification failed" in resp_fake_sig.json()["detail"].lower()


async def test_seller_signs_first_workflow(client: AsyncClient):
    """Verify that seller signing first transitions state to seller_signed, then buyer signing transitions to fully_verified."""
    buyer_headers = get_consumer_headers()
    seller_headers = get_prosumer_headers()

    buyer_priv, buyer_pub = generate_ed25519_keypair()
    seller_priv, seller_pub = generate_ed25519_keypair()

    await client.post("/api/v1/verification/keys/register", json={"public_key_hex": buyer_pub, "algorithm": "Ed25519"}, headers=buyer_headers)
    await client.post("/api/v1/verification/keys/register", json={"public_key_hex": seller_pub, "algorithm": "Ed25519"}, headers=seller_headers)

    now = datetime.now(timezone.utc)
    l_resp = await client.post("/api/v1/listings/", json={
        "title": "Solar Reverse Sign Order Array",
        "energy_available_kwh": 25.0,
        "price_per_kwh": 5.75,
        "available_from": (now + timedelta(hours=1)).isoformat(),
        "available_to": (now + timedelta(hours=5)).isoformat(),
        "source_type": "solar_rooftop",
        "latitude": 23.0300,
        "longitude": 72.5180,
        "grid_substation_id": "AHMEDABAD_SUB_ZONE_1"
    }, headers=seller_headers)
    listing_id = l_resp.json()["id"]

    t_resp = await client.post("/api/v1/trades/initiate", json={
        "listing_id": listing_id,
        "energy_amount_kwh": 15.0,
        "unit_price": 5.75
    }, headers=buyer_headers)
    trade_id = t_resp.json()["id"]

    # 1. Fetch canonical hash
    v_resp = await client.get(f"/api/v1/verification/trades/{trade_id}", headers=seller_headers)
    trade_hash = v_resp.json()["trade_canonical_hash"]

    # 2. Seller signs first
    seller_sig = sign_payload_ed25519(seller_priv, trade_hash)
    s_resp = await client.post(
        f"/api/v1/verification/trades/{trade_id}/seller-sign",
        json={"signature_hex": seller_sig},
        headers=seller_headers
    )
    assert s_resp.status_code == 200
    s_data = s_resp.json()
    assert s_data["is_fully_verified"] is False
    assert s_data["seller_verification"] is not None
    assert s_data["buyer_verification"] is None

    # Verify trade status is seller_signed
    trade_check = await client.get(f"/api/v1/trades/{trade_id}", headers=seller_headers)
    assert trade_check.json()["status"] == "seller_signed"

    # 3. Buyer signs second
    buyer_sig = sign_payload_ed25519(buyer_priv, trade_hash)
    b_resp = await client.post(
        f"/api/v1/verification/trades/{trade_id}/buyer-sign",
        json={"signature_hex": buyer_sig},
        headers=buyer_headers
    )
    assert b_resp.status_code == 200
    b_data = b_resp.json()
    assert b_data["is_fully_verified"] is True
    assert b_data["buyer_verification"]["is_valid"] is True
    assert b_data["seller_verification"]["is_valid"] is True
    assert b_data["current_block_hash"] is not None

@pytest.mark.asyncio
async def test_get_my_trades_has_no_duplicates_and_has_partner_names(client: AsyncClient):
    """Verify that GET /trades/my does not produce Cartesian product duplicates and resolves other_party_name."""
    buyer_headers = get_consumer_headers()
    resp = await client.get("/api/v1/trades/my", headers=buyer_headers)
    assert resp.status_code == 200
    trades = resp.json()
    assert isinstance(trades, list)
    
    trade_ids = [t["id"] for t in trades]
    assert len(trade_ids) == len(set(trade_ids)), "Duplicate trade IDs returned by GET /trades/my!"
    
    for t in trades:
        assert "id" in t
        assert "status" in t
        assert "buyer_name" in t
        assert "seller_name" in t

@pytest.mark.asyncio
async def test_verification_response_contains_compatibility_fields(client: AsyncClient):
    """Verify that trade verification endpoint returns both canonical_payload and compatibility fields."""
    buyer_headers = get_consumer_headers()
    seller_headers = get_prosumer_headers()

    # Create a fresh trade
    now = datetime.now(timezone.utc)
    l_resp = await client.post("/api/v1/listings/", json={
        "title": "Solar Test Array 1",
        "energy_available_kwh": 30.0,
        "price_per_kwh": 6.00,
        "source_type": "solar_rooftop",
        "available_from": (now + timedelta(hours=1)).isoformat(),
        "available_to": (now + timedelta(hours=4)).isoformat(),
        "latitude": 23.0225,
        "longitude": 72.5714,
        "grid_substation_id": "AHMEDABAD_SUB_ZONE_1"
    }, headers=seller_headers)
    assert l_resp.status_code == 201
    listing_id = l_resp.json()["id"]

    t_resp = await client.post("/api/v1/trades/initiate", json={
        "listing_id": listing_id,
        "energy_amount_kwh": 10.0,
        "unit_price": 6.00
    }, headers=buyer_headers)
    assert t_resp.status_code == 200
    trade_id = t_resp.json()["id"]

    v_resp = await client.get(f"/api/v1/verification/trades/{trade_id}", headers=buyer_headers)
    assert v_resp.status_code == 200
    v_data = v_resp.json()

    assert "canonical_payload" in v_data
    assert "canonical_trade_payload" in v_data
    assert v_data["canonical_payload"] == v_data["canonical_trade_payload"]
    assert v_data["canonical_payload"]["trade_id"] == trade_id
    assert "buyer_signature" in v_data
    assert "seller_signature" in v_data
    assert v_data["is_fully_verified"] is False

@pytest.mark.asyncio
async def test_signing_with_alias_and_auto_key_registration(client: AsyncClient):
    """Verify that signing supports flexible signature field alias and auto-registers public key."""
    buyer_headers = get_consumer_headers()
    seller_headers = get_prosumer_headers()

    now = datetime.now(timezone.utc)
    l_resp = await client.post("/api/v1/listings/", json={
        "title": "Wind Test Array 2",
        "energy_available_kwh": 20.0,
        "price_per_kwh": 5.50,
        "source_type": "wind",
        "available_from": (now + timedelta(hours=2)).isoformat(),
        "available_to": (now + timedelta(hours=5)).isoformat(),
        "latitude": 23.0300,
        "longitude": 72.5800,
        "grid_substation_id": "AHMEDABAD_SUB_ZONE_1"
    }, headers=seller_headers)
    assert l_resp.status_code == 201
    listing_id = l_resp.json()["id"]

    t_resp = await client.post("/api/v1/trades/initiate", json={
        "listing_id": listing_id,
        "energy_amount_kwh": 5.0,
        "unit_price": 5.50
    }, headers=buyer_headers)
    assert t_resp.status_code == 200
    trade_id = t_resp.json()["id"]

    v_resp = await client.get(f"/api/v1/verification/trades/{trade_id}", headers=buyer_headers)
    trade_hash = v_resp.json()["trade_canonical_hash"]

    # Generate new ad-hoc keypair for buyer
    b_priv, b_pub = generate_ed25519_keypair()
    buyer_sig = sign_payload_ed25519(b_priv, trade_hash)

    # Sign using 'signature' alias and providing 'public_key_hex'
    b_sign_resp = await client.post(
        f"/api/v1/verification/trades/{trade_id}/buyer-sign",
        json={
            "signature": buyer_sig,
            "public_key_hex": b_pub
        },
        headers=buyer_headers
    )
    assert b_sign_resp.status_code == 200
    b_sign_data = b_sign_resp.json()
    assert b_sign_data["buyer_verification"]["is_valid"] is True
    assert b_sign_data["buyer_signature"] == buyer_sig

    # Test tamper detection endpoint with tampered payload
    tamper_resp = await client.post("/api/v1/verification/verify", json={
        "trade_id": trade_id,
        "canonical_trade_payload": {
            **v_resp.json()["canonical_payload"],
            "unit_price": 999.0
        }
    })
    assert tamper_resp.status_code == 200
    tamper_data = tamper_resp.json()
    assert tamper_data["verified"] is False
    assert tamper_data["hash_valid"] is False


# =========================================================================
# 4. VERIFICATION STATE ISOLATION & REGRESSION TESTS
# =========================================================================

@pytest.mark.asyncio
async def test_verification_isolation_between_trades(client: AsyncClient):
    """
    Test 1 — Verification isolation:
    Trade A is fully signed and verified.
    Trade B is created and remains pending signatures.
    Inspecting Trade A returns is_fully_verified=True.
    Inspecting Trade B returns is_fully_verified=False, buyer_verification=None, seller_verification=None.
    Trade B NEVER inherits Trade A's verification record, signatures, or status.
    """
    buyer_headers = get_consumer_headers()
    seller_headers = get_prosumer_headers()

    b_priv, b_pub = generate_ed25519_keypair()
    s_priv, s_pub = generate_ed25519_keypair()

    await client.post("/api/v1/verification/keys/register", json={"public_key_hex": b_pub, "algorithm": "Ed25519"}, headers=buyer_headers)
    await client.post("/api/v1/verification/keys/register", json={"public_key_hex": s_pub, "algorithm": "Ed25519"}, headers=seller_headers)

    now = datetime.now(timezone.utc)
    l_resp = await client.post("/api/v1/listings/", json={
        "title": "Solar Array Isolation Test",
        "energy_available_kwh": 50.0,
        "price_per_kwh": 5.50,
        "source_type": "solar_rooftop",
        "available_from": (now + timedelta(hours=1)).isoformat(),
        "available_to": (now + timedelta(hours=5)).isoformat(),
        "latitude": 23.0300,
        "longitude": 72.5180,
        "grid_substation_id": "AHMEDABAD_SUB_ZONE_1"
    }, headers=seller_headers)
    assert l_resp.status_code == 201
    listing_id = l_resp.json()["id"]

    # 1. Create Trade A
    t_a_resp = await client.post("/api/v1/trades/initiate", json={
        "listing_id": listing_id,
        "energy_amount_kwh": 10.0,
        "unit_price": 5.50
    }, headers=buyer_headers)
    trade_a_id = t_a_resp.json()["id"]

    # Finalize Trade A (both parties sign)
    v_a = (await client.get(f"/api/v1/verification/trades/{trade_a_id}", headers=buyer_headers)).json()
    sig_a_b = sign_payload_ed25519(b_priv, v_a["trade_canonical_hash"])
    await client.post(f"/api/v1/verification/trades/{trade_a_id}/buyer-sign", json={"signature_hex": sig_a_b}, headers=buyer_headers)

    sig_a_s = sign_payload_ed25519(s_priv, v_a["trade_canonical_hash"])
    await client.post(f"/api/v1/verification/trades/{trade_a_id}/seller-sign", json={"signature_hex": sig_a_s}, headers=seller_headers)

    # Confirm Trade A is fully verified
    v_a_final = (await client.get(f"/api/v1/verification/trades/{trade_a_id}", headers=buyer_headers)).json()
    assert v_a_final["is_fully_verified"] is True
    assert v_a_final["buyer_verification"] is not None
    assert v_a_final["seller_verification"] is not None

    # 2. Create Trade B (unrelated/fresh trade)
    t_b_resp = await client.post("/api/v1/trades/initiate", json={
        "listing_id": listing_id,
        "energy_amount_kwh": 12.0,
        "unit_price": 5.50
    }, headers=buyer_headers)
    trade_b_id = t_b_resp.json()["id"]

    # 3. Verify Trade B isolation
    v_b = (await client.get(f"/api/v1/verification/trades/{trade_b_id}", headers=buyer_headers)).json()
    assert v_b["trade_id"] == trade_b_id
    assert v_b["trade_id"] != trade_a_id
    assert v_b["is_fully_verified"] is False
    assert v_b["buyer_verification"] is None
    assert v_b["seller_verification"] is None
    assert v_b["buyer_signature"] is None
    assert v_b["seller_signature"] is None
    assert v_b["trade_canonical_hash"] != v_a_final["trade_canonical_hash"]
    assert v_b["verification_reference"] != v_a_final["verification_reference"]

@pytest.mark.asyncio
async def test_trade_list_isolation_my_trades(client: AsyncClient):
    """
    Test 2 — Trade list isolation:
    GET /trades/my accurately distinguishes verified trade from unsigned trade.
    Trade A shows is_fully_verified=True, Trade B shows is_fully_verified=False.
    """
    buyer_headers = get_consumer_headers()
    seller_headers = get_prosumer_headers()

    resp = await client.get("/api/v1/trades/my", headers=buyer_headers)
    assert resp.status_code == 200
    trades = resp.json()
    
    verified_trades = [t for t in trades if t["status"] == "fully_verified"]
    pending_trades = [t for t in trades if t["status"] == "pending_signatures"]

    for vt in verified_trades:
        assert vt["is_fully_verified"] is True

    for pt in pending_trades:
        assert pt["is_fully_verified"] is False
        assert pt["buyer_signed"] is False
        assert pt["seller_signed"] is False

@pytest.mark.asyncio
async def test_cross_user_verification_isolation(client: AsyncClient):
    """
    Test 3 — Cross-user isolation:
    Unrelated user C cannot view private verification details of Trade A between user A and B.
    """
    buyer_headers = get_consumer_headers()
    seller_headers = get_prosumer_headers()
    unrelated_headers = get_dual_headers()

    now = datetime.now(timezone.utc)
    l_resp = await client.post("/api/v1/listings/", json={
        "title": "Solar Array Cross-User Test",
        "energy_available_kwh": 25.0,
        "price_per_kwh": 5.80,
        "source_type": "solar_rooftop",
        "available_from": (now + timedelta(hours=1)).isoformat(),
        "available_to": (now + timedelta(hours=5)).isoformat(),
        "latitude": 23.0300,
        "longitude": 72.5180,
        "grid_substation_id": "AHMEDABAD_SUB_ZONE_1"
    }, headers=seller_headers)
    listing_id = l_resp.json()["id"]

    t_resp = await client.post("/api/v1/trades/initiate", json={
        "listing_id": listing_id,
        "energy_amount_kwh": 5.0,
        "unit_price": 5.80
    }, headers=buyer_headers)
    trade_id = t_resp.json()["id"]

    # Unrelated user attempts to inspect private verification
    cross_resp = await client.get(f"/api/v1/verification/trades/{trade_id}", headers=unrelated_headers)
    assert cross_resp.status_code == 403
    assert "Not authorized" in cross_resp.json()["detail"]

@pytest.mark.asyncio
async def test_tamper_verification_uses_trade_specific_hash(client: AsyncClient):
    """
    Test 5 — Tamper verification isolation:
    Tamper verification on Trade B uses Trade B's canonical payload and hash.
    Authentic check on Trade B passes; modifying Trade B payload fails.
    """
    buyer_headers = get_consumer_headers()
    seller_headers = get_prosumer_headers()

    now = datetime.now(timezone.utc)
    l_resp = await client.post("/api/v1/listings/", json={
        "title": "Solar Tamper Check Array",
        "energy_available_kwh": 30.0,
        "price_per_kwh": 6.20,
        "source_type": "solar_rooftop",
        "available_from": (now + timedelta(hours=1)).isoformat(),
        "available_to": (now + timedelta(hours=5)).isoformat(),
        "latitude": 23.0300,
        "longitude": 72.5180,
        "grid_substation_id": "AHMEDABAD_SUB_ZONE_1"
    }, headers=seller_headers)
    listing_id = l_resp.json()["id"]

    t_resp = await client.post("/api/v1/trades/initiate", json={
        "listing_id": listing_id,
        "energy_amount_kwh": 8.0,
        "unit_price": 6.20
    }, headers=buyer_headers)
    trade_id = t_resp.json()["id"]

    # 1. Authentic verify without tampered payload -> valid
    auth_resp = await client.post("/api/v1/verification/verify", json={"trade_id": trade_id})
    assert auth_resp.status_code == 200
    auth_data = auth_resp.json()
    assert auth_data["trade_id"] == trade_id
    assert auth_data["hash_valid"] is True
    assert auth_data["verified"] is True

    # 2. Tampered verify with altered unit price -> invalid
    v_info = (await client.get(f"/api/v1/verification/trades/{trade_id}", headers=buyer_headers)).json()
    tampered_payload = dict(v_info["canonical_payload"])
    tampered_payload["unit_price"] = 99.99
    tamper_resp = await client.post("/api/v1/verification/verify", json={
        "trade_id": trade_id,
        "tampered_payload": tampered_payload
    })
    assert tamper_resp.status_code == 200
    tamper_data = tamper_resp.json()
    assert tamper_data["hash_valid"] is False
    assert tamper_data["verified"] is False
    assert "Payload altered" in tamper_data["details"]

@pytest.mark.asyncio
async def test_public_key_isolation_between_users(client: AsyncClient):
    """
    Test 6 — Public key isolation:
    User A's public key from GET /users/{user_id}/public-key does not match User B's public key.
    """
    buyer_headers = get_consumer_headers()
    seller_headers = get_prosumer_headers()

    b_priv, b_pub = generate_ed25519_keypair()
    s_priv, s_pub = generate_ed25519_keypair()

    await client.post("/api/v1/verification/keys/register", json={"public_key_hex": b_pub, "algorithm": "Ed25519"}, headers=buyer_headers)
    await client.post("/api/v1/verification/keys/register", json={"public_key_hex": s_pub, "algorithm": "Ed25519"}, headers=seller_headers)

    buyer_user_id = "22222222-2222-2222-2222-222222222222"
    seller_user_id = "11111111-1111-1111-1111-111111111111"

    pk_b = await client.get(f"/api/v1/users/{buyer_user_id}/public-key")
    pk_s = await client.get(f"/api/v1/users/{seller_user_id}/public-key")

    assert pk_b.status_code == 200
    assert pk_s.status_code == 200

    b_key_hex = pk_b.json()["public_key_hex"]
    s_key_hex = pk_s.json()["public_key_hex"]

    assert b_key_hex == b_pub
    assert s_key_hex == s_pub
    assert b_key_hex != s_key_hex

@pytest.mark.asyncio
async def test_fresh_trade_initialization_isolation(client: AsyncClient):
    """
    Test 7 — Fresh trade initialization:
    A newly created trade has no signatures or verification state inherited from previous trades.
    """
    buyer_headers = get_consumer_headers()
    seller_headers = get_prosumer_headers()

    now = datetime.now(timezone.utc)
    l_resp = await client.post("/api/v1/listings/", json={
        "title": "Solar Fresh Init Test",
        "energy_available_kwh": 40.0,
        "price_per_kwh": 5.40,
        "source_type": "solar_rooftop",
        "available_from": (now + timedelta(hours=1)).isoformat(),
        "available_to": (now + timedelta(hours=5)).isoformat(),
        "latitude": 23.0300,
        "longitude": 72.5180,
        "grid_substation_id": "AHMEDABAD_SUB_ZONE_1"
    }, headers=seller_headers)
    listing_id = l_resp.json()["id"]

    t_resp = await client.post("/api/v1/trades/initiate", json={
        "listing_id": listing_id,
        "energy_amount_kwh": 10.0,
        "unit_price": 5.40
    }, headers=buyer_headers)
    trade_data = t_resp.json()

    assert trade_data["status"] == "pending_signatures"
    assert trade_data["is_fully_verified"] is False
    assert trade_data["buyer_signed"] is False
    assert trade_data["seller_signed"] is False

    v_resp = await client.get(f"/api/v1/verification/trades/{trade_data['id']}", headers=buyer_headers)
    v_data = v_resp.json()
    assert v_data["is_fully_verified"] is False
    assert v_data["buyer_signature"] is None
    assert v_data["seller_signature"] is None
    assert v_data["buyer_verification"] is None
    assert v_data["seller_verification"] is None
    assert v_data["verified_at"] is None


