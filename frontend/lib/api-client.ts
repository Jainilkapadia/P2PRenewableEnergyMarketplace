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
    throw new Error(errorData.detail || `API error: ${response.statusText} (${response.status})`);
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
  
  // Requirements
  getMyRequirements: () => fetchFromApi<any[]>("/requirements/my"),
  
  // Matching Engine
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
  getVerification: (tradeId: string) => fetchFromApi<any>(`/verification/verify/${tradeId}`),
  getAuditChain: () => fetchFromApi<any[]>("/verification/audit-chain"),
  
  // Reliability
  getReliability: (userId: string) => fetchFromApi<any>(`/reliability/${userId}`),

  // Analytics
  getMarketOverview: () => fetchFromApi<any>("/analytics/overview"),
  getSolarForecast: () => fetchFromApi<any[]>("/analytics/forecast/solar"),
};
