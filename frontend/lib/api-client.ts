const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function fetchFromApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let errorMessage = `API error: ${response.statusText} (${response.status})`;
    if (errorData) {
      if (typeof errorData.detail === "string") {
        errorMessage = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        errorMessage = errorData.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
      } else if (errorData.detail && typeof errorData.detail === "object") {
        errorMessage = JSON.stringify(errorData.detail);
      } else if (errorData.message) {
        errorMessage = typeof errorData.message === "string" ? errorData.message : JSON.stringify(errorData.message);
      }
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export const api = {
  // Authentication
  login: (credentials: { email: string; password: string }) =>
    fetchFromApi<{
      access_token: string;
      token_type: string;
      user_id: string;
      email: string;
      full_name: string;
      role: string;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),

  register: (userData: {
    email: string;
    password: string;
    full_name: string;
    role?: string;
    latitude?: number;
    longitude?: number;
    address_text?: string;
    grid_substation_id?: string;
  }) =>
    fetchFromApi<{
      access_token: string;
      token_type: string;
      user_id: string;
      email: string;
      full_name: string;
      role: string;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    }),

  getMe: () =>
    fetchFromApi<{
      id: string;
      email: string;
      full_name: string;
      role: string;
      address_text?: string;
      grid_substation_id: string;
      latitude?: number;
      longitude?: number;
    }>("/auth/me"),

  // Users
  getUsers: () => fetchFromApi<any[]>("/users/"),

  // Listings
  getListings: () => fetchFromApi<any[]>("/listings/"),
  getMyListings: () => fetchFromApi<any[]>("/listings/my"),
  getListingById: (id: string) => fetchFromApi<any>(`/listings/${id}`),
  getNearbyListings: (params: { latitude: number; longitude: number; radius_km?: number }) => {
    const query = new URLSearchParams({
      latitude: params.latitude.toString(),
      longitude: params.longitude.toString(),
      ...(params.radius_km ? { radius_km: params.radius_km.toString() } : {}),
    });
    return fetchFromApi<any[]>(`/listings/nearby?${query.toString()}`);
  },
  createListing: (payload: any) =>
    fetchFromApi<any>("/listings/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateListing: (id: string, payload: any) =>
    fetchFromApi<any>(`/listings/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteListing: (id: string) =>
    fetchFromApi<any>(`/listings/${id}`, {
      method: "DELETE",
    }),
  
  // Requirements
  getRequirements: () => fetchFromApi<any[]>("/requirements/"),
  getMyRequirements: () => fetchFromApi<any[]>("/requirements/my"),
  getRequirementById: (id: string) => fetchFromApi<any>(`/requirements/${id}`),
  createRequirement: (payload: any) =>
    fetchFromApi<any>("/requirements/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteRequirement: (id: string) =>
    fetchFromApi<any>(`/requirements/${id}`, {
      method: "DELETE",
    }),

  
  // Matching Engine
  getMatchesForRequirement: (requirementId: string) =>
    fetchFromApi<any>(`/matching/${requirementId}`),
  findMatches: (payload: any) => fetchFromApi<any>("/matching/find-matches", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  
  // Trades
  initiateTrade: (payload: any) => fetchFromApi<any>("/trades/initiate", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  getMyTrades: () => fetchFromApi<any[]>("/trades/my"),
  
  // Wallet
  getWallet: () => fetchFromApi<any>("/wallet/me"),
  deposit: (amount: number) => fetchFromApi<any>("/wallet/deposit", {
    method: "POST",
    body: JSON.stringify({ amount }),
  }),
  
  // Verification
  signTrade: (payload: any) => fetchFromApi<any>("/verification/sign", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  buyerSignTrade: (tradeId: string, payload: { signature?: string; public_key?: string; signature_hex?: string; public_key_hex?: string }) =>
    fetchFromApi<any>(`/verification/trades/${tradeId}/buyer-sign`, {
      method: "POST",
      body: JSON.stringify({
        signature_hex: payload.signature_hex || payload.signature,
        public_key_hex: payload.public_key_hex || payload.public_key,
        signature: payload.signature_hex || payload.signature,
        public_key: payload.public_key_hex || payload.public_key,
      }),
    }),
  sellerSignTrade: (tradeId: string, payload: { signature?: string; public_key?: string; signature_hex?: string; public_key_hex?: string }) =>
    fetchFromApi<any>(`/verification/trades/${tradeId}/seller-sign`, {
      method: "POST",
      body: JSON.stringify({
        signature_hex: payload.signature_hex || payload.signature,
        public_key_hex: payload.public_key_hex || payload.public_key,
        signature: payload.signature_hex || payload.signature,
        public_key: payload.public_key_hex || payload.public_key,
      }),
    }),
  getTradeVerification: (tradeId: string) => fetchFromApi<any>(`/verification/trades/${tradeId}`),
  getVerificationReceipt: (reference: string) => fetchFromApi<any>(`/verification/receipts/${reference}`),
  verifyTradeIntegrity: (payload: {
    trade_id: string;
    tampered_payload?: Record<string, any>;
    canonical_trade_payload?: Record<string, any>;
    [key: string]: any;
  }) =>
    fetchFromApi<any>("/verification/verify", {
      method: "POST",
      body: JSON.stringify({
        trade_id: payload.trade_id,
        tampered_payload: payload.tampered_payload || payload.canonical_trade_payload,
      }),
    }),
  registerPublicKey: (payload: { public_key?: string; algorithm?: string; public_key_hex?: string }) =>
    fetchFromApi<any>("/verification/keys/register", {
      method: "POST",
      body: JSON.stringify({
        public_key_hex: payload.public_key_hex || payload.public_key,
        public_key: payload.public_key_hex || payload.public_key,
        algorithm: payload.algorithm || "Ed25519",
      }),
    }),
  getUserPublicKey: (userId: string) =>
    fetchFromApi<{ user_id: string; public_key_hex: string; algorithm: string }>(`/users/${userId}/public-key`),
  getVerification: (tradeId: string) => fetchFromApi<any>(`/verification/verify/${tradeId}`),
  getAuditChain: () => fetchFromApi<any[]>("/verification/audit-chain"),
  
  // Blockchain Anchor & Proof (Milestone 6)
  anchorTrade: (tradeId: string) =>
    fetchFromApi<BlockchainProofResponse>(`/verification/trades/${tradeId}/anchor`, {
      method: "POST",
    }),
  getBlockchainProof: (tradeId: string) =>
    fetchFromApi<BlockchainProofResponse>(`/verification/trades/${tradeId}/blockchain-proof`),

  // Reliability
  getReliability: (userId: string) => fetchFromApi<any>(`/reliability/${userId}`),

  // Analytics
  getMarketOverview: () => fetchFromApi<MarketOverviewStats>("/analytics/overview"),
  getSolarForecast: (params?: { capacity_kw?: number; system_capacity_kw?: number; tilt_angle_deg?: number }) => {
    const query = new URLSearchParams();
    if (params?.capacity_kw !== undefined) query.set("capacity_kw", params.capacity_kw.toString());
    if (params?.system_capacity_kw !== undefined) query.set("system_capacity_kw", params.system_capacity_kw.toString());
    if (params?.tilt_angle_deg !== undefined) query.set("tilt_angle_deg", params.tilt_angle_deg.toString());
    const qs = query.toString();
    return fetchFromApi<SolarForecastPoint[]>(`/analytics/forecast/solar${qs ? `?${qs}` : ""}`);
  },

  // Notifications (Milestone 10)
  getNotifications: (params?: { unread_only?: boolean; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.unread_only) query.set("unread_only", "true");
    if (params?.limit) query.set("limit", params.limit.toString());
    const qs = query.toString();
    return fetchFromApi<AppNotification[]>(`/notifications/${qs ? `?${qs}` : ""}`);
  },
  getUnreadNotificationCount: () =>
    fetchFromApi<{ unread_count: number }>("/notifications/unread-count"),
  markNotificationAsRead: (notificationId: string) =>
    fetchFromApi<{ message: string; id: string }>(`/notifications/${notificationId}/read`, {
      method: "PUT",
    }),
  markAllNotificationsAsRead: () =>
    fetchFromApi<{ message: string; marked_count: number }>("/notifications/mark-all-read", {
      method: "PUT",
    }),
};

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface MarketOverviewStats {
  total_volume_traded_kwh: number;
  total_value_transacted_inr: number;
  average_unit_price: number;
  total_verified_trades: number;
  co2_offset_kg: number;
  active_prosumers_count: number;
  grid_tariff_benchmark: number;
  total_value_transacted_usd?: number | null;
}

export interface SolarForecastPoint {
  hour: number;
  time_label: string;
  expected_generation_kwh: number;
  confidence_interval_low: number;
  confidence_interval_high: number;
  optimal_selling_price: number;
  is_optimal_window: boolean;
}

export interface BlockchainProofResponse {
  trade_id: string;
  verification_reference: string;
  trade_canonical_hash: string;
  blockchain_status: "unanchored" | "pending" | "anchored" | "failed" | string;
  blockchain_tx_hash: string | null;
  blockchain_block_number: number | null;
  blockchain_contract_address: string | null;
  blockchain_anchored_at: string | null;
  is_on_chain_verified?: boolean | null;
  on_chain_deal?: {
    trade_id?: string;
    verification_reference?: string;
    trade_canonical_hash?: string;
    energy_scaled?: number;
    total_amount_scaled?: number;
    anchored_at?: string;
    block_number?: number;
  } | null;
  message?: string | null;
  already_registered?: boolean;
}
