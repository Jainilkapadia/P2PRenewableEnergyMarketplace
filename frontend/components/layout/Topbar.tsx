"use client";

import React from "react";
import Link from "next/link";
import { usePerspective } from "@/lib/perspective-context";
import { formatINR } from "@/lib/utils";
import {
  Wallet,
  Bell,
  KeyRound,
  Sun,
  Zap,
  Layers,
  MapPin,
  ArrowRightLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Topbar() {
  const { perspective, togglePerspective, activeUser } = usePerspective();

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#080d1a]/90 backdrop-blur sticky top-0 z-20 px-4 md:px-6 flex items-center justify-between gap-4">
      {/* Left: Perspective Switcher Control */}
      <div className="flex items-center gap-3">
        <div className="flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800">
          <button
            onClick={() => perspective !== "consumer" && togglePerspective()}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              perspective === "consumer"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
            <span>Consumer: Priya (EV)</span>
          </button>

          <button
            onClick={() => perspective !== "prosumer" && togglePerspective()}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              perspective === "prosumer"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Sun className="h-3.5 w-3.5 text-amber-400" />
            <span>Prosumer: Aarav (Solar)</span>
          </button>
        </div>

        {/* Substation Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/60 border border-slate-800 text-[11px] font-mono text-slate-300">
          <Layers className="h-3 w-3 text-indigo-400" />
          <span>Feeder: {activeUser.substation}</span>
        </div>
      </div>

      {/* Right: Wallet Balance, Notifications & Active Profile */}
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
              {formatINR(activeUser.walletBalance)}
            </span>
          </div>
          {activeUser.escrowBalance > 0 && (
            <span className="hidden sm:inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 ml-1">
              {formatINR(activeUser.escrowBalance)} Escrow
            </span>
          )}
        </Link>

        {/* Notification Bell */}
        <Link
          href="/dashboard"
          className="relative p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-400"></span>
        </Link>

        {/* User Identity Chip with Cryptographic Key Status */}
        <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-slate-800">
          <div className="flex flex-col text-right">
            <span className="text-xs font-medium text-slate-100">{activeUser.name}</span>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center justify-end gap-1">
              <KeyRound className="h-2.5 w-2.5" />
              Ed25519 Active
            </span>
          </div>
          <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-200">
            {activeUser.name.charAt(0)}
          </div>
        </div>
      </div>
    </header>
  );
}
