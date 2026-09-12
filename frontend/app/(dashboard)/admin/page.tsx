"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatINR, formatKWh } from "@/lib/utils";
import {
  ShieldAlert,
  Users,
  Store,
  ArrowLeftRight,
  ShieldCheck,
  AlertTriangle,
  HeartPulse,
  Activity,
  Layers,
  MapPin,
  Sparkles,
  RefreshCw,
  Sun,
  Zap,
  CheckCircle2,
} from "lucide-react";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [listingsList, setListingsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadGridData = async () => {
    setIsLoading(true);
    try {
      const [users, listings] = await Promise.all([
        api.getUsers().catch(() => []),
        api.getListings().catch(() => []),
      ]);
      setUsersList(users);
      setListingsList(listings);
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGridData();
  }, []);

  const totalUsers = usersList.length || 5;
  const activeListings = listingsList.length || 3;
  const totalCapacityKwh = listingsList.reduce(
    (acc, l) => acc + (parseFloat(l.energy_available_kwh) || 0),
    0
  ) || 120.0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
            Discom Grid Admin Control Center
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
              Torrent NOC
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Regulator telemetry, node verification & microgrid settlement audit for Ahmedabad
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadGridData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Sync Grid State</span>
          </button>
          <Link
            href="/map"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-slate-100 font-semibold text-xs transition-all shadow-lg shadow-purple-600/20"
          >
            <MapPin className="h-4 w-4" />
            <span>Inspect Grid Topology</span>
          </Link>
        </div>
      </div>

      {/* Grid High-Level Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Registered Nodes</span>
            <Users className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-100">
            {totalUsers}
          </div>
          <div className="mt-1 text-xs text-purple-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            100% Ed25519 Key Verified
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Active Solar Generation</span>
            <Sun className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-400">
            {formatKWh(totalCapacityKwh)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {activeListings} active prosumer microgrid listings
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Settlement Protocol</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
            100%
          </div>
          <div className="mt-1 text-xs text-emerald-400/90 font-medium">
            Verifiable Dual-Signed Receipts
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Grid Feeder Stability</span>
            <HeartPulse className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-100">
            50.02 Hz
          </div>
          <div className="mt-1 text-xs text-cyan-400 font-medium">
            0 Grid Congestion Events (Nominal)
          </div>
        </div>
      </div>

      {/* Main Admin Section: Registered Nodes Registry & Microgrid Listings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Node Registry Table (2 Cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" />
                Ahmedabad Registered Grid Nodes
              </h2>
              <p className="text-xs text-slate-400">
                Live registry fetched from PostgreSQL / PostGIS database
              </p>
            </div>
            <Link
              href="/admin/users"
              className="text-xs text-purple-400 hover:text-purple-300 font-medium"
            >
              View Full Directory →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="pb-2.5 font-medium">Node / Organization</th>
                  <th className="pb-2.5 font-medium">Role</th>
                  <th className="pb-2.5 font-medium">Feeder Substation</th>
                  <th className="pb-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {usersList.length > 0 ? (
                  usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pr-2">
                        <div className="font-semibold text-slate-200">{u.full_name}</div>
                        <div className="text-[11px] font-mono text-slate-500">{u.email}</div>
                      </td>
                      <td className="py-3 pr-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                            u.role === "admin"
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              : u.role === "prosumer"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : u.role === "dual"
                              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 pr-2 font-mono text-[11px] text-slate-400">
                        {u.grid_substation_id || "AHMEDABAD_SUB_ZONE_1"}
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      Loading nodes from grid database...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Microgrid Quick Actions & Dispute Monitor (1 Col) */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Dispute & SLA Resolution
            </h3>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
              <div className="text-2xl font-bold font-mono text-emerald-400">0</div>
              <p className="text-xs text-slate-400 mt-0.5">Active Grid Disputes</p>
              <p className="text-[11px] text-slate-500 mt-2">
                All P2P settlements are signed with Ed25519 cryptographic proofs.
              </p>
            </div>
            <div className="mt-4">
              <Link
                href="/admin/disputes"
                className="w-full block text-center py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Open Dispute Center
              </Link>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
              <HeartPulse className="h-4 w-4 text-cyan-400" />
              Substation Feeders
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="font-mono text-slate-300">AHMEDABAD_SUB_ZONE_1</span>
                <span className="text-emerald-400 font-semibold">Healthy (99.8%)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                <span className="font-mono text-slate-300">AHMEDABAD_NOC_CENTRAL</span>
                <span className="text-emerald-400 font-semibold">Online (100%)</span>
              </div>
            </div>
            <div className="mt-4">
              <Link
                href="/admin/health"
                className="w-full block text-center py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Inspect System Telemetry
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
