import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone, timedelta
from uuid import UUID, uuid4
from unittest.mock import patch

from main import app
from app.core.database import AsyncSessionLocal
from app.core.security import create_access_token
from app.core.crypto import generate_ed25519_keypair, sign_payload_ed25519
from app.models import Trade, TradeVerification, EnergyListing, Wallet
from app.verification.blockchain_service import blockchain_service, BlockchainServiceError

@pytest_asyncio.fixture(scope="function")
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

def get_prosumer_headers():
    # Aarav Sharma (Seller / Prosumer)
    token = create_access_token(subject="11111111-1111-1111-1111-111111111111")
    return {"Authorization": f"Bearer {token}"}

def get_consumer_headers():
    # Priya Patel (Buyer / Consumer)
    token = create_access_token(subject="22222222-2222-2222-2222-222222222222")
    return {"Authorization": f"Bearer {token}"}

def get_dual_headers():
    # Rohan Verma (Dual)
    token = create_access_token(subject="33333333-3333-3333-3333-333333333333")
    return {"Authorization": f"Bearer {token}"}

# =========================================================================
# NOTIFICATION SYSTEM TESTS
# =========================================================================

@pytest.mark.asyncio
async def test_listing_notification_creation(client: AsyncClient):
    """1. Verify prosumer receives in-app notification upon creating a listing."""
    headers = get_prosumer_headers()
    listing_payload = {
        "title": f"Test Solar Rooftop Surplus {uuid4().hex[:6]}",
        "energy_available_kwh": 20.0,
        "price_per_kwh": 5.75,
        "available_from": datetime.now(timezone.utc).isoformat(),
        "available_to": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        "source_type": "solar_rooftop",
        "latitude": 23.0384,
        "longitude": 72.5122,
        "grid_substation_id": "AHMEDABAD_SUB_ZONE_1"
    }
    resp = await client.post("/api/v1/listings/", json=listing_payload, headers=headers)
    assert resp.status_code == 201
    listing_id = resp.json()["id"]

    # Verify notification exists in prosumer stream
    notif_resp = await client.get("/api/v1/notifications/", headers=headers)
    assert notif_resp.status_code == 200
    notifs = notif_resp.json()
    match = next((n for n in notifs if n.get("reference_id") == listing_id), None)
    assert match is not None
    assert match["type"] == "listing_created"
    assert "Energy Listing Published" in match["title"]
    assert "₹5.75" in match["message"]
    assert match["is_read"] is False

@pytest.mark.asyncio
async def test_requirement_notification_creation(client: AsyncClient):
    """2. Verify consumer receives in-app notification upon creating a requirement."""
    headers = get_consumer_headers()
    req_payload = {
        "title": f"Test EV Charging Demand {uuid4().hex[:6]}",
        "energy_required_kwh": 15.0,
        "max_price_per_kwh": 6.50,
        "required_from": datetime.now(timezone.utc).isoformat(),
        "required_to": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
        "latitude": 23.0365,
        "longitude": 72.5611,
        "max_radius_km": 10.0,
        "min_seller_reliability": 80.0,
        "grid_substation_id": "AHMEDABAD_SUB_ZONE_1",
        "preferred_substation_only": False
    }
    resp = await client.post("/api/v1/requirements/", json=req_payload, headers=headers)
    assert resp.status_code == 201
    requirement_id = resp.json()["id"]

    # Verify notification exists in consumer stream
    notif_resp = await client.get("/api/v1/notifications/", headers=headers)
    assert notif_resp.status_code == 200
    notifs = notif_resp.json()
    match = next((n for n in notifs if n.get("reference_id") == requirement_id), None)
    assert match is not None
    assert match["type"] == "requirement_created"
    assert "Requirement Registered" in match["title"]
    assert "15.0 kWh" in match["message"]

@pytest.mark.asyncio
async def test_trade_initiation_recipient_correctness(client: AsyncClient):
    """3. Verify trade initiation sends distinct notifications to both Seller and Buyer."""
    buyer_headers = get_consumer_headers()
    seller_headers = get_prosumer_headers()

    # Create listing by Aarav
    listing_resp = await client.post("/api/v1/listings/", json={
        "title": f"Trade Notification Listing {uuid4().hex[:6]}",
        "energy_available_kwh": 30.0,
        "price_per_kwh": 5.50,
        "available_from": datetime.now(timezone.utc).isoformat(),
        "available_to": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        "latitude": 23.0384,
        "longitude": 72.5122,
        "grid_substation_id": "AHMEDABAD_SUB_ZONE_1"
    }, headers=seller_headers)
    assert listing_resp.status_code == 201
    listing_id = listing_resp.json()["id"]

    # Initiate trade by Priya (buyer)
    init_resp = await client.post("/api/v1/trades/initiate", json={
        "listing_id": listing_id,
        "energy_amount_kwh": 10.0,
        "unit_price": 5.50,
        "match_score": 95.0
    }, headers=buyer_headers)
    assert init_resp.status_code == 200
    trade_id = init_resp.json()["id"]

    # Check Seller (Aarav) notification
    seller_notifs = (await client.get("/api/v1/notifications/", headers=seller_headers)).json()
    seller_trade_notif = next((n for n in seller_notifs if n.get("reference_id") == trade_id), None)
    assert seller_trade_notif is not None
    assert seller_trade_notif["type"] == "trade_initiated"
    assert "Signature Required" in seller_trade_notif["title"]
    assert "₹5.50" in seller_trade_notif["message"]

    # Check Buyer (Priya) notification
    buyer_notifs = (await client.get("/api/v1/notifications/", headers=buyer_headers)).json()
    buyer_trade_notif = next((n for n in buyer_notifs if n.get("reference_id") == trade_id), None)
    assert buyer_trade_notif is not None
    assert buyer_trade_notif["type"] == "trade_initiated"
    assert "Escrow Locked" in buyer_trade_notif["title"]
    assert "₹55.00" in buyer_trade_notif["message"]

@pytest.mark.asyncio
async def test_signing_and_dual_verification_notifications(client: AsyncClient):
    """4-6. Test buyer sign, seller sign, and full verification notifications."""
    buyer_headers = get_consumer_headers()
    seller_headers = get_prosumer_headers()

    # Step A: Register keys for both parties
    b_priv, b_pub = generate_ed25519_keypair()
    s_priv, s_pub = generate_ed25519_keypair()

    await client.post("/api/v1/verification/keys/register", json={"public_key_hex": b_pub}, headers=buyer_headers)
    await client.post("/api/v1/verification/keys/register", json={"public_key_hex": s_pub}, headers=seller_headers)

    # Step B: Create listing and trade
    listing_resp = await client.post("/api/v1/listings/", json={
        "title": f"Signing Flow Listing {uuid4().hex[:6]}",
        "energy_available_kwh": 25.0,
        "price_per_kwh": 5.80,
        "available_from": datetime.now(timezone.utc).isoformat(),
        "available_to": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        "latitude": 23.0384,
        "longitude": 72.5122
    }, headers=seller_headers)
    listing_id = listing_resp.json()["id"]

    trade_resp = await client.post("/api/v1/trades/initiate", json={
        "listing_id": listing_id,
        "energy_amount_kwh": 10.0,
        "unit_price": 5.80
    }, headers=buyer_headers)
    trade_id = trade_resp.json()["id"]

    verif_data = (await client.get(f"/api/v1/verification/trades/{trade_id}", headers=buyer_headers)).json()
    canonical_hash = verif_data["trade_canonical_hash"]

    # Step C: Buyer signs
    b_sig = sign_payload_ed25519(b_priv, canonical_hash)
    b_sign_resp = await client.post(f"/api/v1/verification/trades/{trade_id}/buyer-sign", json={
        "signature_hex": b_sig,
        "public_key_hex": b_pub
    }, headers=buyer_headers)
    assert b_sign_resp.status_code == 200

    # Verify Buyer got signature_verified notification
    b_notifs = (await client.get("/api/v1/notifications/", headers=buyer_headers)).json()
    assert any(n["type"] == "signature_verified" and n.get("reference_id") == trade_id for n in b_notifs)

    # Verify Seller got buyer_signed notification
    s_notifs = (await client.get("/api/v1/notifications/", headers=seller_headers)).json()
    assert any(n["type"] == "buyer_signed" and n.get("reference_id") == trade_id for n in s_notifs)

    # Step D: Seller signs (triggering check_and_finalize_dual_verification)
    s_sig = sign_payload_ed25519(s_priv, canonical_hash)
    s_sign_resp = await client.post(f"/api/v1/verification/trades/{trade_id}/seller-sign", json={
        "signature_hex": s_sig,
        "public_key_hex": s_pub
    }, headers=seller_headers)
    assert s_sign_resp.status_code == 200
    assert s_sign_resp.json()["is_fully_verified"] is True

    # Verify Seller got signature_verified
    s_notifs_after = (await client.get("/api/v1/notifications/", headers=seller_headers)).json()
    assert any(n["type"] == "signature_verified" and n.get("reference_id") == trade_id for n in s_notifs_after)

    # Verify Buyer got seller_signed
    b_notifs_after = (await client.get("/api/v1/notifications/", headers=buyer_headers)).json()
    assert any(n["type"] == "seller_signed" and n.get("reference_id") == trade_id for n in b_notifs_after)

    # Verify BOTH got trade_verified
    assert any(n["type"] == "trade_verified" and n.get("reference_id") == trade_id for n in b_notifs_after)
    assert any(n["type"] == "trade_verified" and n.get("reference_id") == trade_id for n in s_notifs_after)

@pytest.mark.asyncio
async def test_blockchain_anchor_notifications(client: AsyncClient):
    """7. Verify blockchain anchoring sends confirmed notifications to both buyer and seller."""
    buyer_headers = get_consumer_headers()
    seller_headers = get_prosumer_headers()

    b_priv, b_pub = generate_ed25519_keypair()
    s_priv, s_pub = generate_ed25519_keypair()

    await client.post("/api/v1/verification/keys/register", json={"public_key_hex": b_pub}, headers=buyer_headers)
    await client.post("/api/v1/verification/keys/register", json={"public_key_hex": s_pub}, headers=seller_headers)

    listing_resp = await client.post("/api/v1/listings/", json={
        "title": f"Anchor Notification Listing {uuid4().hex[:6]}",
        "energy_available_kwh": 20.0,
        "price_per_kwh": 5.80,
        "available_from": datetime.now(timezone.utc).isoformat(),
        "available_to": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        "latitude": 23.0384,
        "longitude": 72.5122
    }, headers=seller_headers)
    listing_id = listing_resp.json()["id"]

    trade_resp = await client.post("/api/v1/trades/initiate", json={
        "listing_id": listing_id,
        "energy_amount_kwh": 10.0,
        "unit_price": 5.80
    }, headers=buyer_headers)
    trade_id = trade_resp.json()["id"]

    verif_data = (await client.get(f"/api/v1/verification/trades/{trade_id}", headers=buyer_headers)).json()
    canonical_hash = verif_data["trade_canonical_hash"]

    # Dual sign
    b_sig = sign_payload_ed25519(b_priv, canonical_hash)
    await client.post(f"/api/v1/verification/trades/{trade_id}/buyer-sign", json={"signature_hex": b_sig, "public_key_hex": b_pub}, headers=buyer_headers)
    s_sig = sign_payload_ed25519(s_priv, canonical_hash)
    await client.post(f"/api/v1/verification/trades/{trade_id}/seller-sign", json={"signature_hex": s_sig, "public_key_hex": s_pub}, headers=seller_headers)

    # Anchor trade with mocked blockchain service
    mock_anchor_result = {
        "trade_id": str(trade_id),
        "verification_reference": verif_data["verification_reference"],
        "trade_canonical_hash": canonical_hash,
        "blockchain_status": "anchored",
        "blockchain_tx_hash": "0x" + "a" * 64,
        "blockchain_block_number": 42,
        "blockchain_contract_address": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        "blockchain_anchored_at": datetime.now(timezone.utc),
        "already_registered": False
    }

    with patch.object(blockchain_service, "anchor_trade", return_value=mock_anchor_result), \
         patch.object(blockchain_service, "get_deal", return_value={"trade_id": str(trade_id), "trade_canonical_hash": canonical_hash}):
        anchor_resp = await client.post(f"/api/v1/verification/trades/{trade_id}/anchor", headers=buyer_headers)
        assert anchor_resp.status_code == 200
        assert anchor_resp.json()["blockchain_status"] == "anchored"

    # Verify both parties received blockchain_anchored notification
    b_notifs = (await client.get("/api/v1/notifications/", headers=buyer_headers)).json()
    s_notifs = (await client.get("/api/v1/notifications/", headers=seller_headers)).json()

    assert any(n["type"] == "blockchain_anchored" and n.get("reference_id") == trade_id for n in b_notifs)
    assert any(n["type"] == "blockchain_anchored" and n.get("reference_id") == trade_id for n in s_notifs)

@pytest.mark.asyncio
async def test_blockchain_anchor_failure_notification(client: AsyncClient):
    """Test that an RPC failure during anchor notifies the user without invalidating verified state."""
    buyer_headers = get_consumer_headers()
    seller_headers = get_prosumer_headers()

    b_priv, b_pub = generate_ed25519_keypair()
    s_priv, s_pub = generate_ed25519_keypair()

    await client.post("/api/v1/verification/keys/register", json={"public_key_hex": b_pub}, headers=buyer_headers)
    await client.post("/api/v1/verification/keys/register", json={"public_key_hex": s_pub}, headers=seller_headers)

    listing_resp = await client.post("/api/v1/listings/", json={
        "title": f"Anchor Fail Listing {uuid4().hex[:6]}",
        "energy_available_kwh": 20.0,
        "price_per_kwh": 5.80,
        "available_from": datetime.now(timezone.utc).isoformat(),
        "available_to": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        "latitude": 23.0384,
        "longitude": 72.5122
    }, headers=seller_headers)
    trade_resp = await client.post("/api/v1/trades/initiate", json={
        "listing_id": listing_resp.json()["id"],
        "energy_amount_kwh": 10.0,
        "unit_price": 5.80
    }, headers=buyer_headers)
    trade_id = trade_resp.json()["id"]

    verif_data = (await client.get(f"/api/v1/verification/trades/{trade_id}", headers=buyer_headers)).json()
    canonical_hash = verif_data["trade_canonical_hash"]

    b_sig = sign_payload_ed25519(b_priv, canonical_hash)
    await client.post(f"/api/v1/verification/trades/{trade_id}/buyer-sign", json={"signature_hex": b_sig, "public_key_hex": b_pub}, headers=buyer_headers)
    s_sig = sign_payload_ed25519(s_priv, canonical_hash)
    await client.post(f"/api/v1/verification/trades/{trade_id}/seller-sign", json={"signature_hex": s_sig, "public_key_hex": s_pub}, headers=seller_headers)

    # Fail anchor call with simulated RPC error
    with patch.object(blockchain_service, "anchor_trade", side_effect=BlockchainServiceError("Connection refused on RPC node")):
        anchor_fail_resp = await client.post(f"/api/v1/verification/trades/{trade_id}/anchor", headers=buyer_headers)
        assert anchor_fail_resp.status_code == 503

    # Invoking user gets blockchain_anchor_failed notification
    b_notifs = (await client.get("/api/v1/notifications/", headers=buyer_headers)).json()
    assert any(n["type"] == "blockchain_anchor_failed" and n.get("reference_id") == trade_id for n in b_notifs)

    # Milestone 5 off-chain verification remains intact!
    trade_check = (await client.get(f"/api/v1/verification/trades/{trade_id}", headers=buyer_headers)).json()
    assert trade_check["is_fully_verified"] is True
    assert trade_check["blockchain_status"] == "failed"

@pytest.mark.asyncio
async def test_unread_count_and_mark_read_operations(client: AsyncClient):
    """8-10. Test unread count, mark single as read, and mark all as read."""
    headers = get_dual_headers()

    # Create 2 requirements to produce at least 2 unread notifications
    await client.post("/api/v1/requirements/", json={
        "title": f"Unread Test 1 {uuid4().hex[:6]}",
        "energy_required_kwh": 5.0,
        "max_price_per_kwh": 6.0,
        "required_from": datetime.now(timezone.utc).isoformat(),
        "required_to": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "latitude": 23.0118,
        "longitude": 72.5074
    }, headers=headers)

    await client.post("/api/v1/requirements/", json={
        "title": f"Unread Test 2 {uuid4().hex[:6]}",
        "energy_required_kwh": 8.0,
        "max_price_per_kwh": 6.2,
        "required_from": datetime.now(timezone.utc).isoformat(),
        "required_to": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "latitude": 23.0118,
        "longitude": 72.5074
    }, headers=headers)

    # 8. Check unread count
    count_resp = await client.get("/api/v1/notifications/unread-count", headers=headers)
    assert count_resp.status_code == 200
    initial_unread = count_resp.json()["unread_count"]
    assert initial_unread >= 2

    # Fetch notification list
    notifs = (await client.get("/api/v1/notifications/?unread_only=true", headers=headers)).json()
    first_notif_id = notifs[0]["id"]

    # 9. Mark single notification as read
    read_resp = await client.put(f"/api/v1/notifications/{first_notif_id}/read", headers=headers)
    assert read_resp.status_code == 200

    # Verify count decremented by 1
    count_after_single = (await client.get("/api/v1/notifications/unread-count", headers=headers)).json()["unread_count"]
    assert count_after_single == initial_unread - 1

    # 10. Mark all notifications as read
    mark_all_resp = await client.put("/api/v1/notifications/mark-all-read", headers=headers)
    assert mark_all_resp.status_code == 200
    assert mark_all_resp.json()["marked_count"] >= 1

    # Verify count is now 0
    final_count = (await client.get("/api/v1/notifications/unread-count", headers=headers)).json()["unread_count"]
    assert final_count == 0

@pytest.mark.asyncio
async def test_user_isolation_and_unauthorized_mutation(client: AsyncClient):
    """11-12. Ensure User B cannot view or mutate User A's notifications."""
    aarav_headers = get_prosumer_headers()
    priya_headers = get_consumer_headers()

    # Create notification for Aarav
    await client.post("/api/v1/listings/", json={
        "title": f"Isolation Listing {uuid4().hex[:6]}",
        "energy_available_kwh": 10.0,
        "price_per_kwh": 5.50,
        "available_from": datetime.now(timezone.utc).isoformat(),
        "available_to": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "latitude": 23.0384,
        "longitude": 72.5122
    }, headers=aarav_headers)

    aarav_notifs = (await client.get("/api/v1/notifications/", headers=aarav_headers)).json()
    assert len(aarav_notifs) > 0
    aarav_notif_id = aarav_notifs[0]["id"]

    # 11. Priya cannot see Aarav's notification in her stream
    priya_notifs = (await client.get("/api/v1/notifications/", headers=priya_headers)).json()
    assert not any(n["id"] == aarav_notif_id for n in priya_notifs)

    # 12. Priya cannot mark Aarav's notification as read (returns 404)
    mutation_resp = await client.put(f"/api/v1/notifications/{aarav_notif_id}/read", headers=priya_headers)
    assert mutation_resp.status_code == 404

    # Non-existent notification returns 404
    fake_id = str(uuid4())
    fake_resp = await client.put(f"/api/v1/notifications/{fake_id}/read", headers=priya_headers)
    assert fake_resp.status_code == 404

@pytest.mark.asyncio
async def test_no_sensitive_data_leakage(client: AsyncClient):
    """13. Ensure notification payloads never leak passwords, private keys, or tokens."""
    headers = get_prosumer_headers()
    notifs = (await client.get("/api/v1/notifications/", headers=headers)).json()

    sensitive_keywords = ["private_key", "password", "hashed_password", "secret", "bearer", "token"]
    for notif in notifs:
        title_lower = notif["title"].lower()
        msg_lower = notif["message"].lower()
        for kw in sensitive_keywords:
            assert kw not in title_lower, f"Leaked sensitive keyword '{kw}' in notification title: {notif['title']}"
            assert kw not in msg_lower, f"Leaked sensitive keyword '{kw}' in notification message: {notif['message']}"

@pytest.mark.asyncio
async def test_duplicate_anchor_idempotency_prevents_duplicate_notifications(client: AsyncClient):
    """14. Idempotent repeat anchor request does not create duplicate anchor notifications."""
    buyer_headers = get_consumer_headers()
    seller_headers = get_prosumer_headers()

    b_priv, b_pub = generate_ed25519_keypair()
    s_priv, s_pub = generate_ed25519_keypair()
    await client.post("/api/v1/verification/keys/register", json={"public_key_hex": b_pub}, headers=buyer_headers)
    await client.post("/api/v1/verification/keys/register", json={"public_key_hex": s_pub}, headers=seller_headers)

    listing_resp = await client.post("/api/v1/listings/", json={
        "title": f"Idempotent Anchor {uuid4().hex[:6]}",
        "energy_available_kwh": 20.0,
        "price_per_kwh": 5.80,
        "available_from": datetime.now(timezone.utc).isoformat(),
        "available_to": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        "latitude": 23.0384,
        "longitude": 72.5122
    }, headers=seller_headers)
    trade_resp = await client.post("/api/v1/trades/initiate", json={
        "listing_id": listing_resp.json()["id"],
        "energy_amount_kwh": 10.0,
        "unit_price": 5.80
    }, headers=buyer_headers)
    trade_id = trade_resp.json()["id"]

    verif_data = (await client.get(f"/api/v1/verification/trades/{trade_id}", headers=buyer_headers)).json()
    canonical_hash = verif_data["trade_canonical_hash"]

    b_sig = sign_payload_ed25519(b_priv, canonical_hash)
    await client.post(f"/api/v1/verification/trades/{trade_id}/buyer-sign", json={"signature_hex": b_sig, "public_key_hex": b_pub}, headers=buyer_headers)
    s_sig = sign_payload_ed25519(s_priv, canonical_hash)
    await client.post(f"/api/v1/verification/trades/{trade_id}/seller-sign", json={"signature_hex": s_sig, "public_key_hex": s_pub}, headers=seller_headers)

    mock_anchor_result = {
        "trade_id": str(trade_id),
        "verification_reference": verif_data["verification_reference"],
        "trade_canonical_hash": canonical_hash,
        "blockchain_status": "anchored",
        "blockchain_tx_hash": "0x" + "b" * 64,
        "blockchain_block_number": 43,
        "blockchain_contract_address": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        "blockchain_anchored_at": datetime.now(timezone.utc),
        "already_registered": False
    }

    with patch.object(blockchain_service, "anchor_trade", return_value=mock_anchor_result), \
         patch.object(blockchain_service, "get_deal", return_value={"trade_id": str(trade_id), "trade_canonical_hash": canonical_hash}):
        # First anchor
        resp1 = await client.post(f"/api/v1/verification/trades/{trade_id}/anchor", headers=buyer_headers)
        assert resp1.status_code == 200

        count_after_first = len([
            n for n in (await client.get("/api/v1/notifications/", headers=buyer_headers)).json()
            if n["type"] == "blockchain_anchored" and n.get("reference_id") == trade_id
        ])
        assert count_after_first == 1

        # Second anchor (idempotent repeat)
        resp2 = await client.post(f"/api/v1/verification/trades/{trade_id}/anchor", headers=buyer_headers)
        assert resp2.status_code == 200
        assert "already anchored" in resp2.json()["message"]

        count_after_second = len([
            n for n in (await client.get("/api/v1/notifications/", headers=buyer_headers)).json()
            if n["type"] == "blockchain_anchored" and n.get("reference_id") == trade_id
        ])
        assert count_after_second == 1, "Duplicate blockchain_anchored notification generated on idempotent retry!"
