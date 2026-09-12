"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth, UserRole } from "@/lib/auth-context";
import { usePerspective } from "@/lib/perspective-context";
import { formatINR } from "@/lib/utils";
import {
  Wallet,
  Bell,
  KeyRound,
  Sun,
  Zap,
  Layers,
  ShieldAlert,
  LogOut,
  ChevronDown,
  User,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Topbar() {
  const { user, role, profile, logout } = useAuth();
  const { perspective, isDual, togglePerspective } = usePerspective();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const getRoleTheme = (r: UserRole) => {
    switch (r) {
      case "prosumer":
        return {
          icon: Sun,
          label: "Prosumer (Solar)",
          badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
          dotColor: "bg-amber-400",
        };
      case "dual":
        return {
          icon: Layers,
          label: "Dual (Buy/Sell)",
          badgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
          dotColor: "bg-indigo-400",
        };
      case "admin":
        return {
          icon: ShieldAlert,
          label: "Grid Admin",
          badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30",
          dotColor: "bg-purple-400",
        };
      case "consumer":
      default:
        return {
          icon: Zap,
          label: "Consumer (EV)",
          badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
          dotColor: "bg-emerald-400",
        };
    }
  };

  const theme = getRoleTheme(role);

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#080d1a]/90 backdrop-blur sticky top-0 z-20 px-4 md:px-6 flex items-center justify-between gap-4">
      {/* Left: Authenticated Node Identity & Dual Mode Controls */}
      <div className="flex items-center gap-3">
        {/* Authenticated User Role Badge */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-sm",
              theme.badgeClass
            )}
          >
            <theme.icon className="h-3.5 w-3.5" />
            <span className="font-semibold text-slate-100">{user?.full_name || profile?.name}</span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-950/60 border border-slate-700 text-slate-300">
              {role}
            </span>
          </div>

          {/* If the single authenticated user has a DUAL role, allow toggling view perspective between Buy and Sell */}
          {isDual && (
            <button
              onClick={togglePerspective}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
              title="Toggle view mode within your Dual account"
            >
              <span className="text-slate-400">View:</span>
              <span className="capitalize font-semibold text-indigo-300">{perspective} Mode</span>
            </button>
          )}
        </div>

        {/* Substation Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/60 border border-slate-800 text-[11px] font-mono text-slate-300">
          <span className={cn("h-2 w-2 rounded-full", theme.dotColor)} />
          <span>Feeder: {user?.grid_substation_id || profile?.substation || "AHMEDABAD_SUB_ZONE_1"}</span>
        </div>
      </div>

      {/* Right: Wallet Balance, Notifications & Authenticated Profile Menu */}
      <div className="flex items-center gap-3">
        {/* Wallet Balance Chip */}
        <Link
          href="/wallet"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all group"
        >
          <div className="h-6 w-6 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Wallet className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-slate-400 font-medium leading-none">Available</span>
            <span className="text-xs font-mono font-semibold text-slate-100 group-hover:text-emerald-300 transition-colors">
              {formatINR(profile?.walletBalance || 0)}
            </span>
          </div>
          {(profile?.escrowBalance || 0) > 0 && (
            <span className="hidden sm:inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 ml-1">
              {formatINR(profile?.escrowBalance || 0)} Escrow
            </span>
          )}
        </Link>

        {/* Notification Bell */}
        <Link
          href="/notifications"
          className="relative p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-400"></span>
        </Link>

        {/* Profile Details & Logout Menu */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
          >
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-medium text-slate-100">
                {user?.full_name || profile?.name}
              </span>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center justify-end gap-1">
                <KeyRound className="h-2.5 w-2.5" />
                Ed25519 Active
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-200">
              {(user?.full_name || profile?.name || "U").charAt(0)}
            </div>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>

          {/* Profile Modal / Dropdown */}
          {showProfileMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowProfileMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3 z-40 space-y-3">
                <div className="border-b border-slate-800 pb-2">
                  <p className="text-xs font-semibold text-slate-100">{user?.full_name || profile?.name}</p>
                  <p className="text-[11px] font-mono text-slate-400 truncate">{user?.email || "authenticated@grid.in"}</p>
                  <span className={cn("inline-block mt-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded border", theme.badgeClass)}>
                    {role} Role
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Substation:</span>
                    <span className="font-mono text-[11px] text-slate-200">{user?.grid_substation_id || profile?.substation || "ZONE_1"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Node Status:</span>
                    <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                      <ShieldCheck className="h-3 w-3" />
                      Active
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
