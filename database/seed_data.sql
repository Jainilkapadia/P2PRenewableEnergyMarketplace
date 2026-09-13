-- Seed Demo Users (Password: 'password123' -> valid bcrypt hash)
-- Coherent India-based dataset: Ahmedabad, Gujarat
INSERT INTO users (id, email, hashed_password, full_name, role, location, address_text, grid_substation_id)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'aarav.prosumer@solar.io', '$2b$12$CFYilce5iMRuoWtOFB5iBOHeFdJ7eH2fO3SfctBliwH1TmpNXObnO', 'Aarav Sharma (Solar Prosumer)', 'prosumer', ST_SetSRID(ST_MakePoint(72.5122, 23.0384), 4326), 'Sindhu Bhavan Marg, Bodakdev, Ahmedabad, GJ', 'AHMEDABAD_SUB_ZONE_1'),
    ('22222222-2222-2222-2222-222222222222', 'priya.consumer@eco.io', '$2b$12$CFYilce5iMRuoWtOFB5iBOHeFdJ7eH2fO3SfctBliwH1TmpNXObnO', 'Priya Patel (EV Consumer)', 'consumer', ST_SetSRID(ST_MakePoint(72.5611, 23.0365), 4326), 'CG Road, Navrangpura, Ahmedabad, GJ', 'AHMEDABAD_SUB_ZONE_1'),
    ('33333333-3333-3333-3333-333333333333', 'rohan.dual@greenenergy.in', '$2b$12$CFYilce5iMRuoWtOFB5iBOHeFdJ7eH2fO3SfctBliwH1TmpNXObnO', 'Rohan Verma (Dual Prosumer)', 'dual', ST_SetSRID(ST_MakePoint(72.5074, 23.0118), 4326), 'Corporate Rd, Prahlad Nagar, Ahmedabad, GJ', 'AHMEDABAD_SUB_ZONE_1'),
    ('44444444-4444-4444-4444-444444444444', 'kavita.solar@cleanpower.org', '$2b$12$CFYilce5iMRuoWtOFB5iBOHeFdJ7eH2fO3SfctBliwH1TmpNXObnO', 'Dr. Kavita Rao (Microgrid Host)', 'prosumer', ST_SetSRID(ST_MakePoint(72.5060, 23.0780), 4326), 'Science City Rd, Sola, Ahmedabad, GJ', 'AHMEDABAD_SUB_ZONE_2'),
    ('55555555-5555-5555-5555-555555555555', 'admin@p2penergy.gov.in', '$2b$12$CFYilce5iMRuoWtOFB5iBOHeFdJ7eH2fO3SfctBliwH1TmpNXObnO', 'Torrent Power Smart Grid Admin', 'admin', ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326), 'Torrent Power Grid HQ, Ashram Rd, Ahmedabad, GJ', 'AHMEDABAD_SUB_ZONE_1')
ON CONFLICT (id) DO NOTHING;

-- Seed Wallets (All in INR)
INSERT INTO wallets (user_id, available_balance, escrow_balance, currency)
VALUES
    ('11111111-1111-1111-1111-111111111111', 12500.0000, 0.0000, 'INR'),
    ('22222222-2222-2222-2222-222222222222', 8500.0000, 0.0000, 'INR'),
    ('33333333-3333-3333-3333-333333333333', 15000.0000, 0.0000, 'INR'),
    ('44444444-4444-4444-4444-444444444444', 21000.0000, 0.0000, 'INR'),
    ('55555555-5555-5555-5555-555555555555', 500000.0000, 0.0000, 'INR')
ON CONFLICT (user_id) DO NOTHING;

-- Seed Reliability Scores (Unchanged score values and metrics)
INSERT INTO reliability_scores (user_id, score, total_trades_initiated, successful_transactions, cancelled_transactions, disputes_count, completed_energy_kwh)
VALUES
    ('11111111-1111-1111-1111-111111111111', 98.50, 42, 41, 1, 0, 850.50),
    ('22222222-2222-2222-2222-222222222222', 96.00, 25, 24, 1, 0, 420.00),
    ('33333333-3333-3333-3333-333333333333', 100.00, 18, 18, 0, 0, 310.00),
    ('44444444-4444-4444-4444-444444444444', 94.20, 60, 56, 3, 1, 1420.00),
    ('55555555-5555-5555-5555-555555555555', 100.00, 0, 0, 0, 0, 0.00)
ON CONFLICT (user_id) DO NOTHING;

-- Seed Demo Cryptographic Public Keys (Ed25519 - Unchanged)
INSERT INTO user_keys (user_id, public_key_hex, algorithm, is_active)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a', 'Ed25519', TRUE),
    ('22222222-2222-2222-2222-222222222222', '3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c', 'Ed25519', TRUE),
    ('33333333-3333-3333-3333-333333333333', '61d9a263c959779df3f707a0c029fdadfbcd419f7274092b3bc9c6a1e582e05b', 'Ed25519', TRUE),
    ('44444444-4444-4444-4444-444444444444', 'b2a09c2a5796a30fb7bb27a8105d15a5198dd9ecb7e289fbfa816999a38ff13a', 'Ed25519', TRUE)
ON CONFLICT DO NOTHING;

-- Seed Energy Listings (Ahmedabad Locations - 30-Day Hackathon Window)
INSERT INTO energy_listings (id, prosumer_id, title, energy_available_kwh, energy_remaining_kwh, price_per_kwh, available_from, available_to, source_type, location, grid_substation_id, status)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Bodakdev Solar Rooftop Surplus (5.5kW Array)', 35.00, 35.00, 5.8000, NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days', 'solar_rooftop', ST_SetSRID(ST_MakePoint(72.5122, 23.0384), 4326), 'AHMEDABAD_SUB_ZONE_1', 'active'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'Prahlad Nagar Clean Solar & Battery Buffer', 50.00, 50.00, 6.2000, NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days', 'solar_battery', ST_SetSRID(ST_MakePoint(72.5074, 23.0118), 4326), 'AHMEDABAD_SUB_ZONE_1', 'active'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '44444444-4444-4444-4444-444444444444', 'Science City High-Efficiency Microgrid Solar Output', 80.00, 80.00, 5.4000, NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days', 'microgrid_solar', ST_SetSRID(ST_MakePoint(72.5060, 23.0780), 4326), 'AHMEDABAD_SUB_ZONE_2', 'active')
ON CONFLICT (id) DO UPDATE SET
    available_from = EXCLUDED.available_from,
    available_to = EXCLUDED.available_to,
    energy_remaining_kwh = EXCLUDED.energy_remaining_kwh,
    status = EXCLUDED.status;

-- Seed Energy Requirements (Ahmedabad Locations - 30-Day Hackathon Window)
INSERT INTO energy_requirements (id, consumer_id, title, energy_required_kwh, max_price_per_kwh, required_from, required_to, max_radius_km, min_seller_reliability, location, grid_substation_id, preferred_substation_only, status)
VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'EV Charging & Daytime Household Clean Demand', 25.00, 7.0000, NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days', 15.00, 85.00, ST_SetSRID(ST_MakePoint(72.5611, 23.0365), 4326), 'AHMEDABAD_SUB_ZONE_1', FALSE, 'open')
ON CONFLICT (id) DO UPDATE SET
    required_from = EXCLUDED.required_from,
    required_to = EXCLUDED.required_to,
    status = EXCLUDED.status;


