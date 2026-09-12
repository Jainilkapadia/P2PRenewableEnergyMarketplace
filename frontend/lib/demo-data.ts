export interface ProsumerListing {
  id: string;
  prosumerId: string;
  prosumerName: string;
  title: string;
  energyAvailableKwh: number;
  energyRemainingKwh: number;
  pricePerKwh: number;
  availableHours: string;
  sourceType: "solar_rooftop" | "solar_battery" | "microgrid_solar";
  sourceLabel: string;
  location: {
    lat: number;
    lng: number;
    address: string;
    neighborhood: string;
  };
  distanceKm: number;
  gridSubstationId: string;
  sellerReliabilityScore: number;
  completedTrades: number;
  status: "active" | "partially_filled" | "completed";
}

export interface ConsumerRequirement {
  id: string;
  consumerId: string;
  consumerName: string;
  title: string;
  energyRequiredKwh: number;
  maxPricePerKwh: number;
  requiredHours: string;
  maxRadiusKm: number;
  minSellerReliability: number;
  location: {
    lat: number;
    lng: number;
    address: string;
    neighborhood: string;
  };
  gridSubstationId: string;
  status: "open" | "matched" | "fulfilled";
}

export interface MatchFactor {
  factor: string;
  impact: "POSITIVE" | "NEUTRAL" | "WARNING" | "BONUS";
  weight: string;
  detail: string;
}

export interface RankedMatch {
  listingId: string;
  listing: ProsumerListing;
  compositeMatchScore: number;
  rank: number;
  summary: string;
  factors: MatchFactor[];
  tradeOffInsight: string;
}

export interface TradeRecord {
  id: string;
  buyerName: string;
  sellerName: string;
  partnerName: string;
  partnerRole: string;
  energyKwh: number;
  unitPrice: number;
  totalAmount: number;
  status: "pending_signatures" | "settled" | "in_escrow";
  substation: string;
  time: string;
  canonicalHash: string;
}

export interface WalletTransactionItem {
  id: string;
  type: "escrow_hold" | "deposit" | "escrow_release" | "payment_credit";
  amount: number;
  description: string;
  date: string;
  status: "completed" | "held";
}

export interface PerspectiveProfile {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  location: {
    address: string;
    neighborhood: string;
    city: string;
    lat: number;
    lng: number;
  };
  substation: string;
  walletBalance: number;
  escrowBalance: number;
  reliabilityScore: number;
  reliabilityLabel: string;
  completedTradesCount: number;
  totalTradesCount: number;
  completedEnergyKwh: number;
  cancellationsCount: number;
  disputesCount: number;
  activeListing?: ProsumerListing;
  activeRequirement?: ConsumerRequirement;
  recentTrades: TradeRecord[];
  walletTransactions: WalletTransactionItem[];
}

// Ahmedabad Center Coordinates (Centering between Bodakdev, Navrangpura & Prahlad Nagar)
export const AHMEDABAD_CENTER = {
  lat: 23.0300,
  lng: 72.5350,
  zoom: 12.2,
};

// Seeded Prosumer Listings in Ahmedabad
export const AHMEDABAD_LISTINGS: ProsumerListing[] = [
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    prosumerId: "11111111-1111-1111-1111-111111111111",
    prosumerName: "Aarav Sharma",
    title: "Bodakdev Solar Rooftop Surplus (5.5kW Array)",
    energyAvailableKwh: 35.0,
    energyRemainingKwh: 35.0,
    pricePerKwh: 5.80,
    availableHours: "Available next 8 hours",
    sourceType: "solar_rooftop",
    sourceLabel: "Rooftop Solar",
    location: {
      lat: 23.0384,
      lng: 72.5122,
      address: "Sindhu Bhavan Marg, Bodakdev, Ahmedabad",
      neighborhood: "Bodakdev",
    },
    distanceKm: 5.0, // Distance to Priya in Navrangpura
    gridSubstationId: "AHMEDABAD_SUB_ZONE_1",
    sellerReliabilityScore: 98.5,
    completedTrades: 41,
    status: "active",
  },
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    prosumerId: "33333333-3333-3333-3333-333333333333",
    prosumerName: "Rohan Verma",
    title: "Prahlad Nagar Clean Solar & Battery Buffer",
    energyAvailableKwh: 50.0,
    energyRemainingKwh: 50.0,
    pricePerKwh: 6.20,
    availableHours: "Available next 10 hours",
    sourceType: "solar_battery",
    sourceLabel: "Solar + Battery",
    location: {
      lat: 23.0118,
      lng: 72.5074,
      address: "100 Feet Rd, Prahlad Nagar, Ahmedabad",
      neighborhood: "Prahlad Nagar",
    },
    distanceKm: 6.2, // Distance to Priya in Navrangpura
    gridSubstationId: "AHMEDABAD_SUB_ZONE_1",
    sellerReliabilityScore: 100.0,
    completedTrades: 18,
    status: "active",
  },
  {
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    prosumerId: "44444444-4444-4444-4444-444444444444",
    prosumerName: "Dr. Kavita Rao",
    title: "Science City Microgrid High-Efficiency Solar Output",
    energyAvailableKwh: 80.0,
    energyRemainingKwh: 80.0,
    pricePerKwh: 5.40,
    availableHours: "Available next 12 hours",
    sourceType: "microgrid_solar",
    sourceLabel: "Microgrid Array",
    location: {
      lat: 23.0780,
      lng: 72.5060,
      address: "Science City Rd, Sola, Ahmedabad",
      neighborhood: "Science City",
    },
    distanceKm: 7.3, // Distance to Priya in Navrangpura
    gridSubstationId: "AHMEDABAD_SUB_ZONE_2",
    sellerReliabilityScore: 94.2,
    completedTrades: 56,
    status: "active",
  },
];

// Seeded Consumer Requirement (Priya Patel in Navrangpura, Ahmedabad)
export const AHMEDABAD_CONSUMER_REQUIREMENT: ConsumerRequirement = {
  id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
  consumerId: "22222222-2222-2222-2222-222222222222",
  consumerName: "Priya Patel",
  title: "EV Charging & Daytime Household Clean Demand",
  energyRequiredKwh: 25.0,
  maxPricePerKwh: 7.00,
  requiredHours: "Next 6 hours (Daytime charging)",
  maxRadiusKm: 15.0,
  minSellerReliability: 85.0,
  location: {
    lat: 23.0365,
    lng: 72.5611,
    address: "CG Road, Navrangpura, Ahmedabad",
    neighborhood: "Navrangpura",
  },
  gridSubstationId: "AHMEDABAD_SUB_ZONE_1",
  status: "open",
};

// Seeded Ranked Matches for Priya Patel (Consumer Perspective)
export const CONSUMER_RANKED_MATCHES: RankedMatch[] = [
  {
    listingId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    listing: AHMEDABAD_LISTINGS[0],
    compositeMatchScore: 94.2,
    rank: 1,
    summary: "Rank 1 match (94.2/100): Same substation feeder bonus, 17.1% cost savings vs budget limit, located 5.0 km away in Bodakdev with 98.5% verified on-chain completion.",
    factors: [
      {
        factor: "Economic Value (Price)",
        impact: "POSITIVE",
        weight: "35%",
        detail: "Offered at ₹5.80/kWh vs your ₹7.00/kWh ceiling (17.1% savings, saves ₹30.00 total).",
      },
      {
        factor: "Proximity & Transmission",
        impact: "POSITIVE",
        weight: "20%",
        detail: "Located 5.0 km away in Bodakdev (well within your 15.0 km radius limit).",
      },
      {
        factor: "Verifiable Reliability",
        impact: "POSITIVE",
        weight: "25%",
        detail: "Seller holds a 98.5% completion score across 41 dual-signed verified energy trades.",
      },
      {
        factor: "Grid Substation Feeder",
        impact: "BONUS",
        weight: "10%",
        detail: "Both peers connected to AHMEDABAD_SUB_ZONE_1 feeder, qualifying for local peer wheeling tariff.",
      },
      {
        factor: "Delivery Time Window",
        impact: "POSITIVE",
        weight: "10%",
        detail: "100% overlap with your required 6-hour daytime charging window.",
      },
    ],
    tradeOffInsight: "Optimal balance between lowest transmission loss, verified reputation, and substation discount.",
  },
  {
    listingId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    listing: AHMEDABAD_LISTINGS[1],
    compositeMatchScore: 88.4,
    rank: 2,
    summary: "Rank 2 match (88.4/100): High battery resilience in Prahlad Nagar (6.2 km) with 100% pristine reliability, but slightly higher unit tariff (₹6.20/kWh).",
    factors: [
      {
        factor: "Proximity & Line Loss",
        impact: "POSITIVE",
        weight: "20%",
        detail: "Located 6.2 km away in Prahlad Nagar, with minimal line loss.",
      },
      {
        factor: "Verifiable Reliability",
        impact: "POSITIVE",
        weight: "25%",
        detail: "100.0% flawless delivery record over 18 verified transactions with battery backup guarantee.",
      },
      {
        factor: "Economic Value (Price)",
        impact: "NEUTRAL",
        weight: "35%",
        detail: "Offered at ₹6.20/kWh (11.4% savings vs ₹7.00 ceiling).",
      },
      {
        factor: "Grid Substation Feeder",
        impact: "BONUS",
        weight: "10%",
        detail: "Same substation feeder (AHMEDABAD_SUB_ZONE_1).",
      },
    ],
    tradeOffInsight: "Maximum reliability and battery dispatch resilience at a modest ₹0.40/kWh premium.",
  },
  {
    listingId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    listing: AHMEDABAD_LISTINGS[2],
    compositeMatchScore: 83.1,
    rank: 3,
    summary: "Rank 3 match (83.1/100): Lowest unit price (₹5.40/kWh) in Science City (7.3 km), on adjacent feeder zone (AHMEDABAD_SUB_ZONE_2).",
    factors: [
      {
        factor: "Economic Value (Price)",
        impact: "POSITIVE",
        weight: "35%",
        detail: "Lowest rate in the market at ₹5.40/kWh (22.8% savings vs your budget).",
      },
      {
        factor: "Proximity & Distance",
        impact: "POSITIVE",
        weight: "20%",
        detail: "Located 7.3 km away in Science City (well within your 15 km search radius).",
      },
      {
        factor: "Grid Substation",
        impact: "NEUTRAL",
        weight: "10%",
        detail: "Cross-substation wheeling from AHMEDABAD_SUB_ZONE_2 to AHMEDABAD_SUB_ZONE_1.",
      },
      {
        factor: "Verifiable Reliability",
        impact: "POSITIVE",
        weight: "25%",
        detail: "Strong 94.2% verified score over 56 microgrid trades.",
      },
    ],
    tradeOffInsight: "Best raw unit price, suitable if price minimization is your strict priority over feeder alignment.",
  },
];

// Ranked Incoming Demands for Aarav Sharma (Prosumer Perspective)
export const PROSUMER_RANKED_DEMANDS = [
  {
    requirementId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    consumer: AHMEDABAD_CONSUMER_REQUIREMENT,
    compositeMatchScore: 94.2,
    rank: 1,
    summary: "Rank 1 incoming demand (94.2/100): Consumer Priya Patel in Navrangpura (5.0 km) on same feeder (AHMEDABAD_SUB_ZONE_1), offering up to ₹7.00/kWh for 25 kWh.",
    factors: [
      {
        factor: "Price Premium Match",
        impact: "POSITIVE",
        weight: "35%",
        detail: "Buyer maximum willingness to pay is ₹7.00/kWh, comfortably above your ₹5.80/kWh rate.",
      },
      {
        factor: "Transmission Distance",
        impact: "POSITIVE",
        weight: "20%",
        detail: "Located only 5.0 km away along CG Road / SG Highway corridor.",
      },
      {
        factor: "Feeder Interconnect",
        impact: "BONUS",
        weight: "10%",
        detail: "Direct connection on AHMEDABAD_SUB_ZONE_1.",
      },
      {
        factor: "Buyer Reliability",
        impact: "POSITIVE",
        weight: "25%",
        detail: "Buyer holds a 96.0% verified settlement record with zero disputes.",
      },
    ],
    tradeOffInsight: "Immediate guaranteed escrow lock for 25.0 kWh (₹145.00 payout upon signature).",
  },
];

// User Profiles for Single Source of Truth
export const CONSUMER_PROFILE = {
  id: "22222222-2222-2222-2222-222222222222",
  name: "Priya Patel",
  role: "EV Clean Energy Consumer",
  roleLabel: "Consumer (EV)",
  location: {
    address: "CG Road, Navrangpura, Ahmedabad, GJ",
    neighborhood: "Navrangpura",
    city: "Ahmedabad",
    lat: 23.0365,
    lng: 72.5611,
  },
  substation: "AHMEDABAD_SUB_ZONE_1",
  walletBalance: 8500.0,
  escrowBalance: 145.0,
  reliabilityScore: 96.0,
  reliabilityLabel: "A Trusted EV Consumer",
  completedTradesCount: 24,
  totalTradesCount: 25,
  completedEnergyKwh: 420.0,
  cancellationsCount: 1,
  disputesCount: 0,
  activeRequirement: AHMEDABAD_CONSUMER_REQUIREMENT,
  recentTrades: [
    {
      id: "trade-001",
      buyerName: "Priya Patel (You)",
      sellerName: "Aarav Sharma",
      partnerName: "Aarav Sharma",
      partnerRole: "Solar Prosumer (Bodakdev)",
      energyKwh: 25.0,
      unitPrice: 5.80,
      totalAmount: 145.0,
      status: "pending_signatures" as const,
      substation: "AHMEDABAD_SUB_ZONE_1",
      time: "20 mins ago",
      canonicalHash: "8f4a1029c7e30d176b92a543f01948329ef01a8421c97a493b8e716e1a0b5b12",
    },
    {
      id: "trade-002",
      buyerName: "Priya Patel (You)",
      sellerName: "Rohan Verma",
      partnerName: "Rohan Verma",
      partnerRole: "Dual Prosumer (Prahlad Nagar)",
      energyKwh: 35.0,
      unitPrice: 6.00,
      totalAmount: 210.0,
      status: "settled" as const,
      substation: "AHMEDABAD_SUB_ZONE_1",
      time: "2 days ago",
      canonicalHash: "4c71982b10a23fe091c8491a274bb819c92ef019234857b1029487c102938471",
    },
  ],
  walletTransactions: [
    {
      id: "tx-1",
      type: "escrow_hold" as const,
      amount: 145.0,
      description: "Escrow locked for 25.0 kWh solar trade (Priya -> Aarav)",
      date: "Today, 10:15 AM",
      status: "held" as const,
    },
    {
      id: "tx-2",
      type: "deposit" as const,
      amount: 5000.0,
      description: "Simulated wallet deposit (UPI / NetBanking)",
      date: "Yesterday, 4:30 PM",
      status: "completed" as const,
    },
    {
      id: "tx-3",
      type: "escrow_release" as const,
      amount: 210.0,
      description: "Settled 35.0 kWh delivered from Rohan Verma (Prahlad Nagar)",
      date: "10 Sep 2026",
      status: "completed" as const,
    },
  ],
};

export const PROSUMER_PROFILE = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Aarav Sharma",
  role: "Rooftop Solar Prosumer",
  roleLabel: "Prosumer (Solar)",
  location: {
    address: "Sindhu Bhavan Marg, Bodakdev, Ahmedabad, GJ",
    neighborhood: "Bodakdev",
    city: "Ahmedabad",
    lat: 23.0384,
    lng: 72.5122,
  },
  substation: "AHMEDABAD_SUB_ZONE_1",
  walletBalance: 12500.0,
  escrowBalance: 0.0,
  reliabilityScore: 98.5,
  reliabilityLabel: "A+ Elite Verified Prosumer",
  completedTradesCount: 41,
  totalTradesCount: 42,
  completedEnergyKwh: 850.5,
  cancellationsCount: 1,
  disputesCount: 0,
  activeListing: AHMEDABAD_LISTINGS[0],
  recentTrades: [
    {
      id: "trade-001",
      buyerName: "Priya Patel",
      sellerName: "Aarav Sharma (You)",
      partnerName: "Priya Patel",
      partnerRole: "EV Consumer (Navrangpura)",
      energyKwh: 25.0,
      unitPrice: 5.80,
      totalAmount: 145.0,
      status: "pending_signatures" as const,
      substation: "AHMEDABAD_SUB_ZONE_1",
      time: "20 mins ago",
      canonicalHash: "8f4a1029c7e30d176b92a543f01948329ef01a8421c97a493b8e716e1a0b5b12",
    },
    {
      id: "trade-003",
      buyerName: "Amit Shah",
      sellerName: "Aarav Sharma (You)",
      partnerName: "Amit Shah",
      partnerRole: "Household Consumer (Vastrapur)",
      energyKwh: 40.0,
      unitPrice: 5.80,
      totalAmount: 232.0,
      status: "settled" as const,
      substation: "AHMEDABAD_SUB_ZONE_1",
      time: "3 days ago",
      canonicalHash: "1b88921a9c849182374619a8274bb819c92ef019234857b1029487c102938499",
    },
  ],
  walletTransactions: [
    {
      id: "tx-p1",
      type: "payment_credit" as const,
      amount: 229.68,
      description: "Payout received for 40.0 kWh solar sale (Ref: Amit Shah)",
      date: "3 days ago",
      status: "completed" as const,
    },
    {
      id: "tx-p2",
      type: "deposit" as const,
      amount: 10000.0,
      description: "Initial demo prosumer working capital",
      date: "01 Sep 2026",
      status: "completed" as const,
    },
  ],
};

export const DUAL_PROFILE = {
  id: "33333333-3333-3333-3333-333333333333",
  name: "Rohan Verma",
  email: "rohan.dual@greenenergy.in",
  role: "Dual Prosumer / Consumer",
  roleLabel: "Dual (Buy & Sell)",
  location: {
    address: "Prahlad Nagar Corporate Road, Ahmedabad, GJ",
    neighborhood: "Prahlad Nagar",
    city: "Ahmedabad",
    lat: 23.0118,
    lng: 72.5074,
  },
  substation: "AHMEDABAD_SUB_ZONE_1",
  walletBalance: 8450.0,
  escrowBalance: 120.0,
  reliabilityScore: 96.0,
  reliabilityLabel: "A Verified Dual Trader",
  completedTradesCount: 18,
  totalTradesCount: 19,
  completedEnergyKwh: 420.0,
  cancellationsCount: 1,
  disputesCount: 0,
  activeListing: AHMEDABAD_LISTINGS[1],
  activeRequirement: {
    id: "req-dual-01",
    consumerId: "33333333-3333-3333-3333-333333333333",
    consumerName: "Rohan Verma",
    title: "Night Storage Top-up (BESS)",
    energyRequiredKwh: 15.0,
    maxPricePerKwh: 6.20,
    requiredHours: "20:00 - 23:00",
    maxRadiusKm: 8.0,
    minSellerReliability: 90,
    location: {
      lat: 23.0118,
      lng: 72.5074,
      address: "Prahlad Nagar, Ahmedabad",
      neighborhood: "Prahlad Nagar",
    },
    gridSubstationId: "AHMEDABAD_SUB_ZONE_1",
    status: "open" as const,
  },
  recentTrades: [
    {
      id: "trade-002",
      buyerName: "Priya Patel",
      sellerName: "Rohan Verma (You)",
      partnerName: "Priya Patel",
      partnerRole: "EV Consumer (Navrangpura)",
      energyKwh: 35.0,
      unitPrice: 6.00,
      totalAmount: 210.0,
      status: "settled" as const,
      substation: "AHMEDABAD_SUB_ZONE_1",
      time: "2 days ago",
      canonicalHash: "4c71982b10a23fe091c8491a274bb819c92ef019234857b1029487c102938471",
    },
  ],
  walletTransactions: [
    {
      id: "tx-d1",
      type: "payment_credit" as const,
      amount: 210.0,
      description: "Sold 35.0 kWh to Priya Patel (Prahlad Nagar)",
      date: "2 days ago",
      status: "completed" as const,
    },
  ],
};

export const ADMIN_PROFILE = {
  id: "55555555-5555-5555-5555-555555555555",
  name: "Torrent Power Grid Admin",
  email: "admin@p2penergy.gov.in",
  role: "Discom Grid Authority",
  roleLabel: "Admin (Grid Operator)",
  location: {
    address: "Torrent House, Off Ashram Road, Ahmedabad, GJ",
    neighborhood: "Ashram Road",
    city: "Ahmedabad",
    lat: 23.0300,
    lng: 72.5800,
  },
  substation: "AHMEDABAD_NOC_CENTRAL",
  walletBalance: 250000.0,
  escrowBalance: 35500.0,
  reliabilityScore: 100.0,
  reliabilityLabel: "Grid Regulator",
  completedTradesCount: 142,
  totalTradesCount: 144,
  completedEnergyKwh: 12450.0,
  cancellationsCount: 2,
  disputesCount: 0,
  recentTrades: [],
  walletTransactions: [],
};

export const DEMO_USERS_MAP: Record<string, any> = {
  consumer: CONSUMER_PROFILE,
  prosumer: PROSUMER_PROFILE,
  dual: DUAL_PROFILE,
  admin: ADMIN_PROFILE,
};

