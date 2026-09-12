"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { usePerspective } from "@/lib/perspective-context";
import {
  AHMEDABAD_LISTINGS,
  AHMEDABAD_CONSUMER_REQUIREMENT,
  CONSUMER_RANKED_MATCHES,
  PROSUMER_RANKED_DEMANDS,
  DUAL_PROFILE,
} from "@/lib/demo-data";
import { formatINR, formatKWh, formatDistance } from "@/lib/utils";
import {
  Zap,
  Sun,
  ShieldCheck,
  TrendingDown,
  ArrowRight,
  Sparkles,
  MapPin,
  Clock,
  Layers,
  Award,
  Wallet,
  Activity,
  BatteryCharging,
  CheckCircle2,
  ListPlus,
  PlusCircle,
  TrendingUp,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { role, user } = useAuth();
  const { perspective, activeUser, isConsumer, isProsumer, isDual } = usePerspective();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // If Admin role, redirect to /admin
  useEffect(() => {
    if (role === "admin") {
      router.push("/admin");
    }
  }, [role, router]);

  const topMatch = CONSUMER_RANKED_MATCHES[0];
  const topDemand = PROSUMER_RANKED_DEMANDS[0];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Energy Terminal
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 uppercase">
              {perspective} Mode
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Decentralized clean power routing on substation feeder{" "}
            <span className="font-mono text-indigo-400 font-semibold">
              {activeUser.substation || "AHMEDABAD_SUB_ZONE_1"}
            </span>
          </p>
        </div>

        {/* Dynamic Action Buttons */}
        <div className="flex items-center gap-2">
          {perspective === "consumer" && (
            <>
              <Link
                href="/map"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-semibold text-xs transition-all"
              >
                <MapPin className="h-4 w-4 text-emerald-400" />
                <span>Nearby Map</span>
              </Link>
              <Link
                href="/matching"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-emerald-500/20 glow-emerald"
              >
                <Sparkles className="h-4 w-4" />
                <span>Find Renewable Energy</span>
              </Link>
            </>
          )}

          {perspective === "prosumer" && (
            <>
              <Link
                href="/map"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-semibold text-xs transition-all"
              >
                <MapPin className="h-4 w-4 text-amber-400" />
                <span>Market Map</span>
              </Link>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-amber-500/20 glow-amber"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Create Energy Listing</span>
              </button>
            </>
          )}

          {perspective === "dual" && (
            <>
              <Link
                href="/map"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-semibold text-xs transition-all"
              >
                <MapPin className="h-4 w-4 text-indigo-400" />
                <span>Find Energy</span>
              </Link>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-500/20"
              >
                <ListPlus className="h-4 w-4" />
                <span>Create Listing</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Role-Specific Dashboard Views */}
      <AnimatePresence mode="wait">
        {perspective === "consumer" && (
          <motion.div
            key="consumer-view"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Consumer Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Current Demand</span>
                  <BatteryCharging className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-slate-100">
                  {formatKWh(AHMEDABAD_CONSUMER_REQUIREMENT.energyRequiredKwh)}
                </div>
                <div className="mt-1 text-xs text-slate-400 flex items-center gap-1">
                  <span className="text-emerald-400">EV Daytime Top-Up</span> • Navrangpura
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Mean Peer Price</span>
                  <TrendingDown className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
                  {formatINR(5.80)}
                  <span className="text-xs text-slate-400 font-normal"> / kWh</span>
                </div>
                <div className="mt-1 text-xs text-emerald-400/90 font-medium">
                  23.7% savings vs Torrent Grid (₹7.60)
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Reliability Score</span>
                  <Award className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-slate-100">
                  {activeUser.reliabilityScore}%
                </div>
                <div className="mt-1 text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified Dual-Signed Receipts
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Available Liquidity</span>
                  <Wallet className="h-4 w-4 text-amber-400" />
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-slate-100">
                  {formatINR(activeUser.walletBalance)}
                </div>
                <div className="mt-1 text-xs text-amber-400 font-medium">
                  {formatINR(activeUser.escrowBalance)} locked in active trade
                </div>
              </div>
            </div>

            {/* Consumer Spotlight & Map Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/30 border border-emerald-500/30 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Sparkles className="h-3.5 w-3.5" />
                    Rank #1 Constraint Match
                  </span>
                  <div className="text-right">
                    <span className="text-2xl font-black font-mono text-emerald-400">
                      {topMatch.compositeMatchScore}%
                    </span>
                    <span className="text-[10px] block text-slate-400 uppercase tracking-wider">
                      Composite Match
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <h2 className="text-lg font-bold text-slate-100">{topMatch.listing.title}</h2>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                    <span>Seller: <strong className="text-slate-200">{topMatch.listing.prosumerName}</strong></span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-emerald-400" />
                      {topMatch.listing.location.address} ({formatDistance(topMatch.listing.distanceKm)})
                    </span>
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-slate-800">
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Unit Price</span>
                    <span className="text-sm font-mono font-bold text-emerald-400">
                      {formatINR(topMatch.listing.pricePerKwh)}/kWh
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Available</span>
                    <span className="text-sm font-mono font-bold text-slate-200">
                      {formatKWh(topMatch.listing.energyRemainingKwh)}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Distance</span>
                    <span className="text-sm font-mono font-bold text-slate-200">
                      {formatDistance(topMatch.listing.distanceKm)}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Substation Feeder</span>
                    <span className="text-xs font-mono font-bold text-indigo-400 truncate block">
                      {topMatch.listing.gridSubstationId} (Aligned)
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-800">
                  <p className="text-xs text-slate-300 italic max-w-md">
                    &ldquo;{topMatch.summary}&rdquo;
                  </p>
                  <Link
                    href={`/matching`}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-all shrink-0"
                  >
                    <span>Inspect Match & Trade</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* Nearby Grid Map Preview */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-emerald-400" />
                      Ahmedabad Solar Nodes
                    </h3>
                    <Link href="/map" className="text-xs text-emerald-400 hover:underline">
                      Open Full Map
                    </Link>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    3 active prosumer nodes in Bodakdev, Prahlad Nagar & Science City.
                  </p>

                  <div className="mt-4 space-y-2.5">
                    {AHMEDABAD_LISTINGS.map((listing) => (
                      <Link
                        key={listing.id}
                        href="/map"
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-7 w-7 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                            <Sun className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-slate-200 truncate block group-hover:text-emerald-300">
                              {listing.prosumerName} ({listing.location.neighborhood})
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {formatKWh(listing.energyRemainingKwh)} • {formatINR(listing.pricePerKwh)}/kWh
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800">
                  <Link
                    href="/map"
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                  >
                    <span>View Interactive Grid Map</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {perspective === "prosumer" && (
          <motion.div
            key="prosumer-view"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Prosumer Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Energy Available</span>
                  <Sun className="h-4 w-4 text-amber-400" />
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-amber-400">
                  {formatKWh(activeUser.activeListing?.energyRemainingKwh || 35.0)}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  5.5kW Array • Bodakdev Microgrid
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Listing Price</span>
                  <TrendingUp className="h-4 w-4 text-amber-400" />
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-slate-100">
                  {formatINR(activeUser.activeListing?.pricePerKwh || 5.80)}
                  <span className="text-xs text-slate-400 font-normal"> / kWh</span>
                </div>
                <div className="mt-1 text-xs text-amber-400 font-medium">
                  Active in Ahmedabad Marketplace
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Reliability Score</span>
                  <Award className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-slate-100">
                  {activeUser.reliabilityScore}%
                </div>
                <div className="mt-1 text-xs text-emerald-400 font-medium">
                  {activeUser.reliabilityLabel}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Settled Revenue</span>
                  <Wallet className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-slate-100">
                  {formatINR(activeUser.walletBalance)}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {activeUser.completedTradesCount} completed trades
                </div>
              </div>
            </div>

            {/* Prosumer Active Listing & Demand Match */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-amber-950/20 border border-amber-500/30">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Sun className="h-3.5 w-3.5" />
                    Active Surplus Broadcast
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    ID: {activeUser.activeListing?.id?.slice(0, 8)}...
                  </span>
                </div>

                <div className="mt-4">
                  <h2 className="text-lg font-bold text-slate-100">
                    {activeUser.activeListing?.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeUser.location.address} • Feeder: {activeUser.substation}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 pt-4 border-t border-slate-800">
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Surplus Available</span>
                    <span className="text-base font-mono font-bold text-amber-400">
                      {formatKWh(activeUser.activeListing?.energyRemainingKwh || 35.0)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Offer Rate</span>
                    <span className="text-base font-mono font-bold text-slate-100">
                      {formatINR(activeUser.activeListing?.pricePerKwh || 5.80)}/kWh
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Available Time Window</span>
                    <span className="text-xs font-mono font-bold text-slate-200 truncate block mt-1">
                      {activeUser.activeListing?.availableHours}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between pt-4 border-t border-slate-800">
                  <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Live in PostGIS spatial registry
                  </span>
                  <Link
                    href="/marketplace"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-all"
                  >
                    <span>View in Marketplace</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* Demand Match */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    Top Matched Demand
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Nearby consumer seeking {formatKWh(topDemand.consumer.energyRequiredKwh)}
                  </p>

                  <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200">
                        {topDemand.consumer.consumerName}
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {topDemand.compositeMatchScore}% Match
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {topDemand.consumer.location.neighborhood} ({formatDistance(topDemand.consumer.maxRadiusKm)})
                    </p>
                    <p className="text-xs text-slate-300 italic mt-2">
                      &ldquo;{topDemand.summary}&rdquo;
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800">
                  <Link
                    href="/map"
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                  >
                    <MapPin className="h-3.5 w-3.5 text-amber-400" />
                    <span>View Grid Map</span>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {perspective === "dual" && (
          <motion.div
            key="dual-view"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Dual Trader Cards (Buying + Selling) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Energy Selling</span>
                  <Sun className="h-4 w-4 text-amber-400" />
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-amber-400">
                  35.0 kWh
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Prahlad Nagar Solar + Battery
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Energy Buying</span>
                  <BatteryCharging className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
                  15.0 kWh
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Night BESS Top-up Requirement
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Dual Reliability</span>
                  <Award className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-slate-100">
                  96.0%
                </div>
                <div className="mt-1 text-xs text-indigo-400 font-medium">
                  Verified Dual Trader
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Liquid Balance</span>
                  <Wallet className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-slate-100">
                  {formatINR(8450.0)}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  ₹120.00 in Escrow
                </div>
              </div>
            </div>

            {/* Dual Grid Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Selling Panel */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Your Active Energy Listing
                  </h3>
                  <span className="text-xs font-mono text-slate-400">₹6.00 / kWh</span>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  Prahlad Nagar Solar + Battery Storage (35.0 kWh Available)
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Feeder: AHMEDABAD_SUB_ZONE_1 • 18 completed trades
                </p>
                <div className="mt-4 flex gap-2">
                  <Link
                    href="/marketplace"
                    className="flex-1 text-center py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold transition-all"
                  >
                    View Listing
                  </Link>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
                  >
                    Update Surplus
                  </button>
                </div>
              </div>

              {/* Buying Panel */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Your Energy Requirement
                  </h3>
                  <span className="text-xs font-mono text-slate-400">Max ₹6.20 / kWh</span>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  Night Storage Top-up (BESS) — 15.0 kWh Needed
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Required Window: 20:00 - 23:00 • 8.0 km radius
                </p>
                <div className="mt-4 flex gap-2">
                  <Link
                    href="/matching"
                    className="flex-1 text-center py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-semibold transition-all"
                  >
                    Find Matching Prosumers
                  </Link>
                  <Link
                    href="/map"
                    className="flex-1 text-center py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
                  >
                    View Map
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal for Create Listing (Foundation placeholder) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
                <Sun className="h-5 w-5" />
                <span>Create Energy Listing</span>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Broadcast rooftop solar surplus to the Ahmedabad microgrid. In Milestone 3, full listing lifecycle will be active.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium">Energy Available (kWh)</label>
                <input
                  type="number"
                  defaultValue={30}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-300 font-medium">Price per kWh (₹)</label>
                <input
                  type="number"
                  defaultValue={5.8}
                  step={0.1}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
                />
              </div>
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => {
                  alert("Listing creation module will be fully linked in Milestone 3.");
                  setShowCreateModal(false);
                }}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold"
              >
                Save Listing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
