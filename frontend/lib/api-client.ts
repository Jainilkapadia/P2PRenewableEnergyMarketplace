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
  
  // Reliability
  getReliability: (userId: string) => fetchFromApi<any>(`/reliability/${userId}`),

  // Analytics
  getMarketOverview: () => fetchFromApi<any>("/analytics/overview"),
  getSolarForecast: () => fetchFromApi<any[]>("/analytics/forecast/solar"),
};
