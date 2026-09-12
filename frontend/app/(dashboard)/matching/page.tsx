"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { usePerspective } from "@/lib/perspective-context";
import {
  AHMEDABAD_CONSUMER_REQUIREMENT,
  CONSUMER_RANKED_MATCHES,
  PROSUMER_RANKED_DEMANDS,
  RankedMatch,
} from "@/lib/demo-data";
import { formatINR, formatKWh, formatDistance } from "@/lib/utils";
import {
  Sparkles,
  Sliders,
  MapPin,
  Clock,
  Award,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Sun,
  BatteryCharging,
} from "lucide-react";

export default function MatchingPage() {
  const { perspective, activeUser, isConsumer, isProsumer } = usePerspective();

  // Consumer Form State
  const [energyRequired, setEnergyRequired] = useState(25.0);
  const [maxPrice, setMaxPrice] = useState(7.0);
  const [maxRadius, setMaxRadius] = useState(15.0);
  const [minReliability, setMinReliability] = useState(85.0);

  // Prosumer Form State (surplus broadcast parameters)
  const [surplusAvailable, setSurplusAvailable] = useState(35.0);
  const [sellingPrice, setSellingPrice] = useState(5.8);

  // Matching Engine State
  const [isMatching, setIsMatching] = useState(false);
  const [expandedExplanation, setExpandedExplanation] = useState<string | null>(
    isConsumer ? CONSUMER_RANKED_MATCHES[0]?.listingId : PROSUMER_RANKED_DEMANDS[0]?.requirementId
  );

  useEffect(() => {
    setExpandedExplanation(
      isConsumer ? CONSUMER_RANKED_MATCHES[0]?.listingId : PROSUMER_RANKED_DEMANDS[0]?.requirementId
    );
  }, [perspective, isConsumer]);

  const handleRunMatcher = () => {
    setIsMatching(true);
    setTimeout(() => {
      setIsMatching(false);
    }, 1000);
  };

  const toggleExplanation = (id: string) => {
    setExpandedExplanation((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Smart Constraint Matching Engine
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              5-Factor Ahmedabad Grid Optimization
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {isConsumer
              ? "Autonomous constraint solver pairing your EV requirement with optimal verified Ahmedabad solar prosumers."
              : "Inbound demand matching engine scoring consumer bids against your Bodakdev rooftop solar surplus profile."}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Engine Core: PostGIS + Ahmedabad Rule Scorer
        </div>
      </div>

      {/* Main Grid: Left Requirement / Supply Form (1/3), Right Ranked Matches (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Parameters Form Card */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 h-fit shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-emerald-400" />
              {isConsumer ? "Energy Requirement Constraints" : "Prosumer Supply Parameters"}
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {activeUser.name} ({activeUser.roleLabel})
            </span>
          </div>

          {isConsumer ? (
            /* Consumer Form */
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Energy Required (kWh)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={energyRequired}
                    onChange={(e) => setEnergyRequired(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono font-bold text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-slate-500">kWh</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Maximum Unit Budget (₹/kWh)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono font-bold text-sm text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-slate-500">₹/kWh</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Torrent Power Grid Baseline is ₹7.60/kWh
                </span>
              </div>

              <div>
                <label className="flex items-center justify-between text-slate-400 mb-1 font-medium">
                  <span>Maximum Radius</span>
                  <span className="font-mono text-indigo-400">{maxRadius} km</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="25"
                  step="1"
                  value={maxRadius}
                  onChange={(e) => setMaxRadius(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-slate-400 mb-1 font-medium">
                  <span>Minimum Reliability</span>
                  <span className="font-mono text-amber-400">{minReliability}%</span>
                </label>
                <input
                  type="range"
                  min="70"
                  max="100"
                  step="1"
                  value={minReliability}
                  onChange={(e) => setMinReliability(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Location Anchor:</span>
                  <span className="text-slate-200 font-medium">{activeUser.location.neighborhood}, Ahmedabad</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Feeder Substation:</span>
                  <span className="text-indigo-400 font-mono">{activeUser.substation}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Prosumer Form */
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Available Solar Surplus (kWh)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={surplusAvailable}
                    onChange={(e) => setSurplusAvailable(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono font-bold text-sm text-amber-400 focus:outline-none focus:border-amber-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-slate-500">kWh</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Listing Tariff (₹/kWh)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono font-bold text-sm text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-slate-500">₹/kWh</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Peer average in Bodakdev node is ₹5.80/kWh
                </span>
              </div>

              <div>
                <label className="flex items-center justify-between text-slate-400 mb-1 font-medium">
                  <span>Transmission Range</span>
                  <span className="font-mono text-indigo-400">{maxRadius} km</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="25"
                  step="1"
                  value={maxRadius}
                  onChange={(e) => setMaxRadius(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Generation Node:</span>
                  <span className="text-slate-200 font-medium">{activeUser.location.neighborhood}, Ahmedabad</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Distribution Feeder:</span>
                  <span className="text-indigo-400 font-mono">{activeUser.substation}</span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleRunMatcher}
            disabled={isMatching}
            className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg text-slate-950 ${
              isConsumer
                ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 glow-emerald"
                : "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 glow-amber"
            }`}
          >
            {isMatching ? (
              <>
                <span className="h-3 w-3 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></span>
                <span>Optimizing Feeder Constraints...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>{isConsumer ? "Re-Execute Matching Engine" : "Scan Demand Orderbook"}</span>
              </>
            )}
          </button>
        </div>

        {/* Right 2/3: Ranked Match Results */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              {isConsumer ? "Ranked Compatibility Matches" : "Ranked Incoming Consumer Demands"}
              <span className="text-xs font-mono font-normal text-slate-400">
                ({isConsumer ? CONSUMER_RANKED_MATCHES.length : PROSUMER_RANKED_DEMANDS.length} verified counterparts)
              </span>
            </h2>
            <span className="text-[11px] text-slate-400">
              Sorted by Multi-Factor Score
            </span>
          </div>

          {/* Animated Loader when engine runs */}
          {isMatching ? (
            <div className="p-16 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <div className="relative h-12 w-12 flex items-center justify-center">
                <span className="absolute h-full w-full rounded-full border-2 border-emerald-500/30 animate-ping"></span>
                <Zap className="h-6 w-6 text-emerald-400 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">
                Evaluating Ahmedabad Microgrid Constraints...
              </h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Calculating line loss distance across SG Highway and CG Road feeders, verifiable reputation scores, and time overlap.
              </p>
            </div>
          ) : isConsumer ? (
            /* Consumer View: Prosumer Matches */
            <div className="space-y-4">
              {CONSUMER_RANKED_MATCHES.map((item) => {
                const isExpanded = expandedExplanation === item.listingId;

                return (
                  <motion.div
                    key={item.listingId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      item.rank === 1
                        ? "bg-slate-900/95 border-emerald-500/40 shadow-lg shadow-emerald-500/10"
                        : "bg-slate-900 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {/* Main Match Header Card */}
                    <div className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-10 w-10 rounded-xl flex items-center justify-center font-mono font-black text-sm shrink-0 ${
                              item.rank === 1
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 glow-emerald"
                                : "bg-slate-800 text-slate-300 border border-slate-700"
                            }`}
                          >
                            #{item.rank}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-slate-100">{item.listing.title}</h3>
                              {item.rank === 1 && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  Top Pick
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>Seller: <strong className="text-slate-200">{item.listing.prosumerName}</strong></span>
                              <span>•</span>
                              <span>{item.listing.location.address}</span>
                            </p>
                          </div>
                        </div>

                        {/* Match Score Gauge */}
                        <div className="text-right shrink-0">
                          <div className="text-2xl font-black font-mono text-emerald-400">
                            {item.compositeMatchScore}%
                          </div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                            Match Score
                          </span>
                        </div>
                      </div>

                      {/* Quick Metric Bar */}
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800">
                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block">Unit Tariff</span>
                          <span className="text-sm font-mono font-bold text-emerald-400">
                            {formatINR(item.listing.pricePerKwh)}/kWh
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block">Distance</span>
                          <span className="text-sm font-mono font-bold text-slate-200">
                            {formatDistance(item.listing.distanceKm)}
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block">Reliability</span>
                          <span className="text-sm font-mono font-bold text-slate-200">
                            {item.listing.sellerReliabilityScore}% Trust
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block">Grid Feeder</span>
                          <span className="text-xs font-mono font-bold text-indigo-400 truncate block">
                            {item.listing.gridSubstationId}
                          </span>
                        </div>
                      </div>

                      {/* Expandable Explanation Button */}
                      <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-800">
                        <button
                          onClick={() => toggleExplanation(item.listingId)}
                          className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition-colors"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                          <span>Why this match? (5 Factor Breakdown)</span>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>

                        <Link
                          href={`/trades`}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-colors"
                        >
                          <span>Select & Lock Trade</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>

                    {/* Expandable Transparent Factor Explanation Panel */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="bg-slate-950/80 border-t border-slate-800 px-5 py-4 space-y-3"
                        >
                          <div className="text-xs text-slate-300 font-medium">
                            {item.summary}
                          </div>

                          <div className="space-y-2 pt-2">
                            {item.factors.map((factor, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800/60 text-xs"
                              >
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-slate-200">{factor.factor}</span>
                                    <span className="text-[10px] font-mono text-slate-400">Weight: {factor.weight}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-0.5">{factor.detail}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-500/20 text-xs text-indigo-300 mt-2">
                            <strong>Trade-off Insight:</strong> {item.tradeOffInsight}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* Prosumer View: Incoming Demands */
            <div className="space-y-4">
              {PROSUMER_RANKED_DEMANDS.map((item) => {
                const isExpanded = expandedExplanation === item.requirementId;

                return (
                  <motion.div
                    key={item.requirementId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-2xl border bg-slate-900/95 border-amber-500/40 shadow-lg shadow-amber-500/10 overflow-hidden"
                  >
                    <div className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl flex items-center justify-center font-mono font-black text-sm shrink-0 bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            #{item.rank}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-slate-100">{item.consumer.title}</h3>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                High Budget EV Demand
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>Buyer: <strong className="text-slate-200">{item.consumer.consumerName}</strong></span>
                              <span>•</span>
                              <span>{item.consumer.location.address}</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-2xl font-black font-mono text-amber-400">
                            {item.compositeMatchScore}%
                          </div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                            Demand Score
                          </span>
                        </div>
                      </div>

                      {/* Quick Metric Bar */}
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800">
                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block">Buyer Max Budget</span>
                          <span className="text-sm font-mono font-bold text-emerald-400">
                            {formatINR(item.consumer.maxPricePerKwh)}/kWh
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block">Requested Energy</span>
                          <span className="text-sm font-mono font-bold text-slate-200">
                            {formatKWh(item.consumer.energyRequiredKwh)}
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block">Buyer Reliability</span>
                          <span className="text-sm font-mono font-bold text-slate-200">
                            {item.consumer.minSellerReliability}% Rating
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block">Grid Feeder</span>
                          <span className="text-xs font-mono font-bold text-indigo-400 truncate block">
                            {item.consumer.gridSubstationId} (Aligned)
                          </span>
                        </div>
                      </div>

                      {/* Expandable Explanation Button */}
                      <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-800">
                        <button
                          onClick={() => toggleExplanation(item.requirementId)}
                          className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition-colors"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                          <span>Why this buyer? (Factor Breakdown)</span>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>

                        <Link
                          href={`/trades`}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors"
                        >
                          <span>Accept & Issue Trade Offer</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="bg-slate-950/80 border-t border-slate-800 px-5 py-4 space-y-3"
                        >
                          <div className="text-xs text-slate-300 font-medium">
                            {item.summary}
                          </div>

                          <div className="space-y-2 pt-2">
                            {item.factors.map((factor, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800/60 text-xs"
                              >
                                <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-slate-200">{factor.factor}</span>
                                    <span className="text-[10px] font-mono text-slate-400">Weight: {factor.weight}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-0.5">{factor.detail}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/20 text-xs text-amber-300 mt-2">
                            <strong>Trade-off Insight:</strong> {item.tradeOffInsight}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
