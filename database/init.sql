-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Drop tables if needed (in reverse dependency order)
DROP TABLE IF EXISTS disputes CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS wallet_transactions CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS reliability_scores CASCADE;
DROP TABLE IF EXISTS trade_verifications CASCADE;
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS energy_requirements CASCADE;
DROP TABLE IF EXISTS energy_listings CASCADE;
DROP TABLE IF EXISTS user_keys CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users & Cryptographic Keys
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'dual', -- consumer, prosumer, dual, admin
    location GEOMETRY(Point, 4326),          -- WGS84 Longitude/Latitude
    address_text VARCHAR(255),
    grid_substation_id VARCHAR(50) NOT NULL DEFAULT 'AHMEDABAD_SUB_ZONE_1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_location ON users USING GIST (location);

CREATE TABLE user_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    public_key_hex TEXT NOT NULL,
    algorithm VARCHAR(20) NOT NULL DEFAULT 'Ed25519',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Energy Listings (Prosumers)
CREATE TABLE energy_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prosumer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL DEFAULT 'Rooftop Solar Clean Surplus',
    energy_available_kwh NUMERIC(10, 2) NOT NULL CHECK (energy_available_kwh > 0),
    energy_remaining_kwh NUMERIC(10, 2) NOT NULL CHECK (energy_remaining_kwh >= 0),
    price_per_kwh NUMERIC(10, 4) NOT NULL CHECK (price_per_kwh > 0),
    available_from TIMESTAMPTZ NOT NULL,
    available_to TIMESTAMPTZ NOT NULL,
    source_type VARCHAR(30) DEFAULT 'solar_rooftop',
    location GEOMETRY(Point, 4326) NOT NULL,
    grid_substation_id VARCHAR(50) NOT NULL DEFAULT 'AHMEDABAD_SUB_ZONE_1',
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, partially_filled, completed, cancelled
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_energy_listings_location ON energy_listings USING GIST (location);
CREATE INDEX idx_energy_listings_status ON energy_listings (status);

-- 3. Energy Requirements (Consumers)
CREATE TABLE energy_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL DEFAULT 'EV / Household Clean Energy Demand',
    energy_required_kwh NUMERIC(10, 2) NOT NULL CHECK (energy_required_kwh > 0),
    max_price_per_kwh NUMERIC(10, 4) NOT NULL CHECK (max_price_per_kwh > 0),
    required_from TIMESTAMPTZ NOT NULL,
    required_to TIMESTAMPTZ NOT NULL,
    max_radius_km NUMERIC(6, 2) NOT NULL DEFAULT 15.0,
    min_seller_reliability NUMERIC(4, 2) NOT NULL DEFAULT 70.0,
    location GEOMETRY(Point, 4326),
    grid_substation_id VARCHAR(50) NOT NULL DEFAULT 'AHMEDABAD_SUB_ZONE_1',
    preferred_substation_only BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- open, matched, fulfilled, cancelled
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_energy_requirements_location ON energy_requirements USING GIST (location);
CREATE INDEX idx_energy_requirements_status ON energy_requirements (status);

-- 4. Trades
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES users(id) NOT NULL,
    seller_id UUID REFERENCES users(id) NOT NULL,
    listing_id UUID REFERENCES energy_listings(id) NOT NULL,
    requirement_id UUID REFERENCES energy_requirements(id),
    energy_amount_kwh NUMERIC(10, 2) NOT NULL,
    unit_price NUMERIC(10, 4) NOT NULL,
    total_amount NUMERIC(12, 4) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'matched',
    -- 'matched' -> 'pending_signatures' -> 'buyer_signed' -> 'seller_signed' -> 'settled' -> 'disputed' / 'cancelled'
    delivery_start TIMESTAMPTZ NOT NULL,
    delivery_end TIMESTAMPTZ NOT NULL,
    match_score_snapshot NUMERIC(5, 2),
    match_explanation JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trades_buyer ON trades (buyer_id);
CREATE INDEX idx_trades_seller ON trades (seller_id);
CREATE INDEX idx_trades_status ON trades (status);

-- 5. Verification & Digital Signatures
CREATE TABLE trade_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID UNIQUE REFERENCES trades(id) ON DELETE CASCADE,
    trade_canonical_hash VARCHAR(64) NOT NULL, -- SHA-256 of canonical trade metadata
    buyer_signature_hex TEXT,
    buyer_signed_at TIMESTAMPTZ,
    seller_signature_hex TEXT,
    seller_signed_at TIMESTAMPTZ,
    is_fully_verified BOOLEAN DEFAULT FALSE,
    verification_reference VARCHAR(100) UNIQUE NOT NULL, -- Format: P2P-VRF-<TIMESTAMP>-<HASH_PREFIX>
    audit_chain_previous_hash VARCHAR(64),
    current_block_hash VARCHAR(64),
    verified_at TIMESTAMPTZ,
    blockchain_tx_hash VARCHAR(66),
    blockchain_block_number BIGINT,
    blockchain_contract_address VARCHAR(42),
    blockchain_anchored_at TIMESTAMPTZ,
    blockchain_status VARCHAR(20) NOT NULL DEFAULT 'unanchored'
);

CREATE INDEX idx_verifications_trade_id ON trade_verifications (trade_id);
CREATE INDEX idx_verifications_ref ON trade_verifications (verification_reference);

-- 6. Reliability Scores (Verifiable)
CREATE TABLE reliability_scores (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    score NUMERIC(5, 2) NOT NULL DEFAULT 100.0, -- 0.00 to 100.00
    total_trades_initiated INT NOT NULL DEFAULT 0,
    successful_transactions INT NOT NULL DEFAULT 0,
    cancelled_transactions INT NOT NULL DEFAULT 0,
    disputes_count INT NOT NULL DEFAULT 0,
    completed_energy_kwh NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Wallet & Double-Entry Ledger
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    available_balance NUMERIC(14, 4) NOT NULL DEFAULT 1000.0000,
    escrow_balance NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    currency VARCHAR(10) DEFAULT 'INR',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
    trade_id UUID REFERENCES trades(id),
    transaction_type VARCHAR(30) NOT NULL, -- 'deposit', 'escrow_hold', 'escrow_release', 'payment_credit', 'refund'
    amount NUMERIC(14, 4) NOT NULL,
    balance_after NUMERIC(14, 4) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions (wallet_id);

-- 8. Notifications & Disputes
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'trade_match', 'sign_required', 'settlement_success', 'dispute'
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_read ON notifications (user_id, is_read);
CREATE INDEX idx_notifications_user_created ON notifications (user_id, created_at DESC);

CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
    raised_by UUID REFERENCES users(id) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'resolved_buyer', 'resolved_seller'
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
