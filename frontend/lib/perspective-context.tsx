"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth, UserRole } from "./auth-context";
import {
  CONSUMER_PROFILE,
  PROSUMER_PROFILE,
  DUAL_PROFILE,
  ADMIN_PROFILE,
  DEMO_USERS_MAP,
  PerspectiveProfile,
} from "./demo-data";

export type Perspective = "consumer" | "prosumer" | "dual" | "admin";

interface PerspectiveContextType {
  perspective: Perspective;
  setPerspective: (perspective: Perspective) => void;
  togglePerspective: () => void;
  activeUser: PerspectiveProfile;
  isConsumer: boolean;
  isProsumer: boolean;
  isDual: boolean;
  isAdmin: boolean;
}

const PerspectiveContext = createContext<PerspectiveContextType | undefined>(undefined);

export function PerspectiveProvider({ children }: { children: React.ReactNode }) {
  const { role, profile, user } = useAuth();
  const [dualViewMode, setDualViewMode] = useState<"dual" | "consumer" | "prosumer">("dual");

  // Keep dualViewMode reset when role changes
  useEffect(() => {
    if (role === "dual") {
      setDualViewMode("dual");
    }
  }, [role]);

  // For Dual accounts, allow toggling between unified dual view, buying mode, or selling mode
  // For all other roles, the perspective is strictly locked to the authenticated user's role
  const effectivePerspective: Perspective =
    role === "dual" ? dualViewMode : role || "consumer";

  // Active profile is strictly mapped to the authenticated user's identity
  const activeUser: PerspectiveProfile =
    DEMO_USERS_MAP[role] || profile || CONSUMER_PROFILE;

  const togglePerspective = () => {
    // Only a Dual account can toggle between buying and selling modes within their own account
    if (role === "dual") {
      setDualViewMode((prev) =>
        prev === "consumer" ? "prosumer" : prev === "prosumer" ? "dual" : "consumer"
      );
    }
  };

  const setPerspective = (p: Perspective) => {
    if (role === "dual" && (p === "consumer" || p === "prosumer" || p === "dual")) {
      setDualViewMode(p);
    }
  };

  return (
    <PerspectiveContext.Provider
      value={{
        perspective: effectivePerspective,
        setPerspective,
        togglePerspective,
        activeUser,
        isConsumer: effectivePerspective === "consumer",
        isProsumer: effectivePerspective === "prosumer",
        isDual: role === "dual",
        isAdmin: role === "admin",
      }}
    >
      {children}
    </PerspectiveContext.Provider>
  );
}

export function usePerspective() {
  const context = useContext(PerspectiveContext);
  if (!context) {
    throw new Error("usePerspective must be used within a PerspectiveProvider");
  }
  return context;
}
