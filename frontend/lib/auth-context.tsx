"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api-client";
import {
  CONSUMER_PROFILE,
  PROSUMER_PROFILE,
  DUAL_PROFILE,
  ADMIN_PROFILE,
  DEMO_USERS_MAP,
  PerspectiveProfile,
} from "./demo-data";

export type UserRole = "consumer" | "prosumer" | "dual" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  address_text?: string;
  grid_substation_id?: string;
  latitude?: number;
  longitude?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: PerspectiveProfile;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole;
  login: (email: string, password: string) => Promise<UserRole>;
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    role?: string;
    latitude?: number;
    longitude?: number;
    address_text?: string;
  }) => Promise<UserRole>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Normalize role string safely
  const normalizeRole = (r?: string): UserRole => {
    if (!r) return "consumer";
    const lower = r.toLowerCase().trim();
    if (lower === "prosumer" || lower === "solar_seller") return "prosumer";
    if (lower === "dual" || lower === "prosumer_consumer") return "dual";
    if (lower === "admin" || lower === "grid_admin") return "admin";
    return "consumer";
  };

  const activeRole: UserRole = normalizeRole(user?.role);

  // Compute rich profile data corresponding to active authenticated user/role
  const profile: PerspectiveProfile =
    DEMO_USERS_MAP[activeRole] || CONSUMER_PROFILE;

  // Initial session restoration from localStorage with backend verification
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem("auth_token");
        if (storedToken) {
          setToken(storedToken);
          // Verify with /auth/me backend endpoint
          const me = await api.getMe();
          setUser({
            id: me.id,
            email: me.email,
            full_name: me.full_name,
            role: normalizeRole(me.role),
            address_text: me.address_text,
            grid_substation_id: me.grid_substation_id,
            latitude: me.latitude,
            longitude: me.longitude,
          });
        } else {
          // If no stored token, user is unauthenticated
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.warn("Session verification notice:", err);
        // Invalid or expired token -> clear session
        localStorage.removeItem("auth_token");
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<UserRole> => {
    setIsLoading(true);
    try {
      const resp = await api.login({ email, password });
      const role = normalizeRole(resp.role);

      localStorage.setItem("auth_token", resp.access_token);
      setToken(resp.access_token);

      setUser({
        id: resp.user_id,
        email: resp.email,
        full_name: resp.full_name,
        role: role,
      });

      // Fetch complete profile info from /me
      try {
        const me = await api.getMe();
        setUser({
          id: me.id,
          email: me.email,
          full_name: me.full_name,
          role: normalizeRole(me.role),
          address_text: me.address_text,
          grid_substation_id: me.grid_substation_id,
          latitude: me.latitude,
          longitude: me.longitude,
        });
      } catch {
        // me fetch fallback
      }

      return role;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: {
    email: string;
    password: string;
    full_name: string;
    role?: string;
    latitude?: number;
    longitude?: number;
    address_text?: string;
  }): Promise<UserRole> => {
    setIsLoading(true);
    try {
      const resp = await api.register(data);
      const role = normalizeRole(resp.role);

      localStorage.setItem("auth_token", resp.access_token);
      setToken(resp.access_token);

      setUser({
        id: resp.user_id,
        email: resp.email,
        full_name: resp.full_name,
        role: role,
      });

      return role;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        isAuthenticated: !!user,
        isLoading,
        role: activeRole,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
