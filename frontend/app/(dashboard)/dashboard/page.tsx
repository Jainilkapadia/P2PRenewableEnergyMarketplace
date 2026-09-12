"use client";

import React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { usePerspective } from "@/lib/perspective-context";
import {
  AHMEDABAD_LISTINGS,
  AHMEDABAD_CONSUMER_REQUIREMENT,
  CONSUMER_RANKED_MATCHES,
  PROSUMER_RANKED_DEMANDS,
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
} from "lucide-react";

export default function DashboardPage() {
  const { perspective, activeUser, isConsumer, isProsumer } = usePerspective();
  const topMatch = CONSUMER_RANKED_MATCHES[0];
  const topDemand = PROSUMER_RANKED_DEMANDS[0];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Energy Terminal
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {perspective === "consumer" ? "Consumer Perspective" : "Prosumer Perspective"}
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Decentralized clean power routing on substation feeder{" "}
            <span className="font-mono text-indigo-400 font-semibold">{activeUser.substation}</span>
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          {perspective === "consumer" ? (
            <Link
              href="/matching"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-emerald-500/20 glow-emerald"
            >
              <Sparkles className="h-4 w-4" />
              <span>Run Smart Matcher</span>
            </Link>
          ) : (
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-amber-500/20 glow-amber"
            >
              <Sun className="h-4 w-4" />
              <span>Broadcast Surplus</span>
            </Link>
          )}
        </div>
      </div>

      {/* Animated Dashboard Container */}
      <AnimatePresence mode="wait">
        {perspective === "consumer" ? (
          <motion.div
            key="consumer-view"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            {/* Top Row Metric Cards */}
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
                  <span className="text-emerald-400">EV Daytime Top-Up</span> • {AHMEDABAD_CONSUMER_REQUIREMENT.location.neighborhood}
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
                  23.7% savings vs Torrent Power Grid (₹7.60)
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

            {/* Main Middle Row: Best Match Hero + Map Preview Strip */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Best Match Spotlight (2 Cols) */}
              <div className="lg:col-span-2 p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/30 border border-emerald-500/30 relative overflow-hidden glow-emerald">
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

                {/* Match Factor Highlights */}
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

                {/* Transparency Summary & CTA */}
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

              {/* Nearby Grid Map Preview (1 Col) */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-indigo-400" />
                      Ahmedabad Solar Nodes
                    </h3>
                    <Link href="/map" className="text-xs text-emerald-400 hover:underline">
                      Open Full Map
                    </Link>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    3 active prosumer nodes within your 15km Ahmedabad radius.
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
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {formatDistance(listing.distanceKm)} • {listing.gridSubstationId}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono font-bold text-emerald-400 block">
                            {formatINR(listing.pricePerKwh)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatKWh(listing.energyRemainingKwh)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Feeder: <strong className="text-slate-200">{activeUser.substation}</strong></span>
                  <span className="text-emerald-400">Local Wheeling Active</span>
                </div>
              </div>
            </div>

            {/* Bottom Row: Recent Trades */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  Recent Transaction Ledger ({activeUser.name})
                </h3>
                <Link href="/trades" className="text-xs text-emerald-400 hover:underline">
                  View All Trades →
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] text-slate-400 uppercase font-mono border-b border-slate-800">
                    <tr>
                      <th className="pb-2">Trade Partner</th>
                      <th className="pb-2">Energy (kWh)</th>
                      <th className="pb-2">Unit Tariff</th>
                      <th className="pb-2">Total Amount</th>
                      <th className="pb-2">Substation</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-slate-200">
                    {activeUser.recentTrades.map((trade) => (
                      <tr key={trade.id} className="hover:bg-slate-800/30">
                        <td className="py-3 font-sans font-medium text-slate-100">
                          {trade.partnerName}
                          <span className="block text-[10px] text-slate-400 font-normal">{trade.partnerRole}</span>
                        </td>
                        <td className="py-3 font-bold text-emerald-400">{formatKWh(trade.energyKwh)}</td>
                        <td className="py-3">{formatINR(trade.unitPrice)}/kWh</td>
                        <td className="py-3 font-bold">{formatINR(trade.totalAmount)}</td>
                        <td className="py-3 text-indigo-400">{trade.substation}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {trade.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 text-right text-slate-400 font-sans">{trade.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Prosumer Perspective */
          <motion.div
            key="prosumer-view"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            {/* Prosumer Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Available Surplus</span>
                  <Sun className="h-4 w-4 text-amber-400" />
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-amber-400">
                  {formatKWh(35.0)}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Rooftop 5.5 kW Photovoltaic Array
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Active Listing Price</span>
                  <Zap className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
                  {formatINR(5.80)}
                  <span className="text-xs text-slate-400 font-normal"> / kWh</span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Competitive peer clearing rate
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Prosumer Trust Score</span>
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-slate-100">
                  {activeUser.reliabilityScore}%
                </div>
                <div className="mt-1 text-xs text-emerald-400 font-medium">
                  Ranked Top 5% in Ahmedabad Bodakdev Node
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Prosumer Wallet Balance</span>
                  <Wallet className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-slate-100">
                  {formatINR(activeUser.walletBalance)}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Ready for instant withdrawal
                </div>
              </div>
            </div>

            {/* Prosumer Active Listing Banner + Nearby Demand Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-amber-950/20 border border-amber-500/30">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Sun className="h-3.5 w-3.5" />
                    Active Solar Listing Broadcast
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    BROADCASTING (ONLINE)
                  </span>
                </div>

                <h2 className="text-lg font-bold text-slate-100 mt-3">
                  Bodakdev Solar Rooftop Surplus (5.5kW Array)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Sindhu Bhavan Marg, Bodakdev, Ahmedabad • Available for next 8 daylight hours
                </p>

                <div className="mt-5 grid grid-cols-3 gap-3 pt-4 border-t border-slate-800">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-xs text-slate-400 block">Total Surplus</span>
                    <span className="text-lg font-bold font-mono text-amber-400">35.0 kWh</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-xs text-slate-400 block">Current Rate</span>
                    <span className="text-lg font-bold font-mono text-emerald-400">{formatINR(5.80)}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-xs text-slate-400 block">Grid Feeder</span>
                    <span className="text-sm font-bold font-mono text-indigo-400">{activeUser.substation}</span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <Link
                    href="/marketplace"
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
                  >
                    Manage Listing
                  </Link>
                </div>
              </div>

              {/* Nearby Consumer Demand Spotlight */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <BatteryCharging className="h-4 w-4 text-emerald-400" />
                    Incoming Demand Nearby
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Consumers matching your generation profile.
                  </p>

                  <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">
                        {AHMEDABAD_CONSUMER_REQUIREMENT.consumerName}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10">
                        94.2% Match
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {AHMEDABAD_CONSUMER_REQUIREMENT.title}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs font-mono">
                      <span>Requirement: <strong>{formatKWh(AHMEDABAD_CONSUMER_REQUIREMENT.energyRequiredKwh)}</strong></span>
                      <span className="text-emerald-400">Max: {formatINR(AHMEDABAD_CONSUMER_REQUIREMENT.maxPricePerKwh)}</span>
                    </div>
                  </div>
                </div>

                <Link
                  href="/matching"
                  className="mt-4 w-full py-2 text-center rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                >
                  Review Match Queue
                </Link>
              </div>
            </div>

            {/* Prosumer Bottom Row: Recent Trades */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-amber-400" />
                  Recent Sales Ledger ({activeUser.name})
                </h3>
                <Link href="/trades" className="text-xs text-amber-400 hover:underline">
                  View All Trades →
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] text-slate-400 uppercase font-mono border-b border-slate-800">
                    <tr>
                      <th className="pb-2">Buyer / Partner</th>
                      <th className="pb-2">Energy (kWh)</th>
                      <th className="pb-2">Unit Tariff</th>
                      <th className="pb-2">Total Amount</th>
                      <th className="pb-2">Substation</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-slate-200">
                    {activeUser.recentTrades.map((trade) => (
                      <tr key={trade.id} className="hover:bg-slate-800/30">
                        <td className="py-3 font-sans font-medium text-slate-100">
                          {trade.partnerName}
                          <span className="block text-[10px] text-slate-400 font-normal">{trade.partnerRole}</span>
                        </td>
                        <td className="py-3 font-bold text-emerald-400">{formatKWh(trade.energyKwh)}</td>
                        <td className="py-3">{formatINR(trade.unitPrice)}/kWh</td>
                        <td className="py-3 font-bold">{formatINR(trade.totalAmount)}</td>
                        <td className="py-3 text-indigo-400">{trade.substation}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {trade.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 text-right text-slate-400 font-sans">{trade.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
