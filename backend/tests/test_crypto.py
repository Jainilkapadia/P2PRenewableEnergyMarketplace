import pytest
from app.core.crypto import (
    canonicalize_payload,
    compute_sha256_hash,
    generate_ed25519_keypair,
    sign_payload_ed25519,
    verify_ed25519_signature
)

def test_canonicalization_and_hashing():
    payload_a = {"b": 2, "a": 1, "c": [1, 2, 3]}
    payload_b = {"c": [1, 2, 3], "a": 1, "b": 2}
    
    hash_a = compute_sha256_hash(payload_a)
    hash_b = compute_sha256_hash(payload_b)
    
    assert hash_a == hash_b
    assert len(hash_a) == 64

def test_ed25519_signature_lifecycle():
    # 1. Generate Keypair
    priv_hex, pub_hex = generate_ed25519_keypair()
    assert len(priv_hex) == 64
    assert len(pub_hex) == 64

    # 2. Sign canonical trade hash
    trade_payload = {
        "trade_id": "test-trade-123",
        "energy_kwh": 25.0,
        "unit_price": 0.14
    }
    payload_hash = compute_sha256_hash(trade_payload)
    sig_hex = sign_payload_ed25519(priv_hex, payload_hash)

    # 3. Verify valid signature
    is_valid = verify_ed25519_signature(pub_hex, payload_hash, sig_hex)
    assert is_valid is True

    # 4. Detect tampered payload
    tampered_payload = {
        "trade_id": "test-trade-123",
        "energy_kwh": 30.0,  # Modified energy amount
        "unit_price": 0.14
    }
    tampered_hash = compute_sha256_hash(tampered_payload)
    is_valid_tampered = verify_ed25519_signature(pub_hex, tampered_hash, sig_hex)
    assert is_valid_tampered is False

    # 5. Detect wrong public key
    _, wrong_pub_hex = generate_ed25519_keypair()
    is_valid_wrong_key = verify_ed25519_signature(wrong_pub_hex, payload_hash, sig_hex)
    assert is_valid_wrong_key is False
