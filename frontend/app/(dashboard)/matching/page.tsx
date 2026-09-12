"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { usePerspective } from "@/lib/perspective-context";
import { api } from "@/lib/api-client";
import {
  CONSUMER_RANKED_MATCHES,
  PROSUMER_RANKED_DEMANDS,
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
  Layers,
  RefreshCw
} from "lucide-react";

function MatchingContent() {
  const { perspective, activeUser, isConsumer, isProsumer } = usePerspective();
  const searchParams = useSearchParams();
  const initialRequirementId = searchParams.get("requirementId");

  // User's requirements list
  const [myRequirements, setMyRequirements] = useState<any[]>([]);
  const [selectedRequirementId, setSelectedRequirementId] = useState<string>(initialRequirementId || "");

  // Consumer Form State
  const [energyRequired, setEnergyRequired] = useState(25.0);
  const [maxPrice, setMaxPrice] = useState(7.0);
  const [maxRadius, setMaxRadius] = useState(15.0);
  const [minReliability, setMinReliability] = useState(85.0);
  const [substationId, setSubstationId] = useState("AHMEDABAD_SUB_ZONE_1");
  const [preferredSubOnly, setPreferredSubOnly] = useState(false);

  // Prosumer Form State (surplus broadcast parameters)
  const [surplusAvailable, setSurplusAvailable] = useState(35.0);
  const [sellingPrice, setSellingPrice] = useState(5.8);

  // Matching Engine State
  const [isMatching, setIsMatching] = useState(false);
  const [liveMatches, setLiveMatches] = useState<any[] | null>(null);
  const [matchStatusMessage, setMatchStatusMessage] = useState<string | null>(null);
  const [expandedExplanation, setExpandedExplanation] = useState<string | null>(null);
  const [initiatingMatchId, setInitiatingMatchId] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const router = useRouter();

  // Load existing requirements
  useEffect(() => {
    async function loadRequirements() {
      try {
        const reqs = await api.getMyRequirements();
        setMyRequirements(reqs);
        if (!selectedRequirementId && reqs.length > 0) {
          const first = reqs[0];
          setSelectedRequirementId(first.id);
          setEnergyRequired(first.energy_required_kwh);
          setMaxPrice(first.max_price_per_kwh);
          setMaxRadius(first.max_radius_km);
          setMinReliability(first.min_seller_reliability);
          setSubstationId(first.grid_substation_id);
          setPreferredSubOnly(first.preferred_substation_only);
        }
      } catch {
        // Silently fallback if offline
      }
    }
    loadRequirements();
  }, []);

  // When a requirement is selected from dropdown
  const handleSelectRequirement = (reqId: string) => {
    setSelectedRequirementId(reqId);
    const found = myRequirements.find((r) => r.id === reqId);
    if (found) {
      setEnergyRequired(found.energy_required_kwh);
      setMaxPrice(found.max_price_per_kwh);
      setMaxRadius(found.max_radius_km);
      setMinReliability(found.min_seller_reliability);
      setSubstationId(found.grid_substation_id);
      setPreferredSubOnly(found.preferred_substation_only);
    }
  };

  const handleRunMatcher = async () => {
    setIsMatching(true);
    setMatchStatusMessage(null);

    try {
      if (selectedRequirementId) {
        // Try calling real backend for this requirement
        const response = await api.getMatchesForRequirement(selectedRequirementId);
        if (response && response.matches) {
          setLiveMatches(response.matches);
          setMatchStatusMessage(`Found ${response.total_matches_returned} eligible prosumer matches via PostGIS solver.`);
          if (response.matches.length > 0) {
            setExpandedExplanation(response.matches[0].listing_id);
          }
          setIsMatching(false);
          return;
        }
      } else {
        // Ad-hoc query
        const now = new Date();
        const from = new Date(now.getTime() + 60 * 60 * 1000);
        const to = new Date(now.getTime() + 6 * 60 * 60 * 1000);

        const response = await api.findMatches({
          energy_required_kwh: energyRequired,
          max_price_per_kwh: maxPrice,
          required_from: from.toISOString(),
          required_to: to.toISOString(),
          latitude: activeUser.location.lat,
          longitude: activeUser.location.lng,
          max_radius_km: maxRadius,
          min_seller_reliability: minReliability,
          grid_substation_id: substationId,
          preferred_substation_only: preferredSubOnly
        });
        if (response && response.matches) {
          setLiveMatches(response.matches);
          setMatchStatusMessage(`Found ${response.total_matches_returned} eligible prosumer matches.`);
          if (response.matches.length > 0) {
            setExpandedExplanation(response.matches[0].listing_id);
          }
          setIsMatching(false);
          return;
        }
      }
    } catch {
      // Fallback gracefully to demo ranked matches
    }

    setTimeout(() => {
      setLiveMatches(null);
      setExpandedExplanation(
        isConsumer ? CONSUMER_RANKED_MATCHES[0]?.listingId : PROSUMER_RANKED_DEMANDS[0]?.requirementId
      );
      setIsMatching(false);
    }, 600);
  };

  // Trigger matching on mount if requirementId was passed in URL
  useEffect(() => {
    if (initialRequirementId) {
      handleRunMatcher();
    }
  }, [initialRequirementId]);

  const toggleExplanation = (id: string) => {
    setExpandedExplanation((prev) => (prev === id ? null : id));
  };

  const handleInitiateTrade = async (item: any) => {
    // Prevent duplicate rapid clicks
    if (initiatingMatchId) return;

    const listingId = item.listing_id || item.listingId;
    if (!listingId) {
      setTradeError("Listing ID is missing from selected match.");
      return;
    }

    setTradeError(null);
    setInitiatingMatchId(listingId);

    try {
      const availKwh = Number(item.energy_available_kwh ?? item.listing?.energyAvailableKwh ?? 0);
      const reqKwh = Number(energyRequired) || 10.0;
      const energyAmount = availKwh > 0 ? Math.min(reqKwh, availKwh) : reqKwh;
      const unitPrice = Number(item.price_per_kwh ?? item.listing?.pricePerKwh ?? maxPrice ?? 5.8);
      const matchScore = Number(item.composite_match_score ?? item.compositeMatchScore ?? 95.0);

      const explanationObj = item.explanation || {
        summary: item.summary || "Smart match engine selected counterpart",
        factors: item.factors || [],
        trade_off_insight: item.trade_off_insight || item.tradeOffInsight || null,
      };

      const payload = {
        listing_id: listingId,
        requirement_id: selectedRequirementId || undefined,
        energy_amount_kwh: energyAmount,
        unit_price: unitPrice,
        match_score: matchScore,
        match_explanation: explanationObj,
      };

      const newTrade = await api.initiateTrade(payload);

      if (newTrade && newTrade.id) {
        // Successful initiation: navigate directly to trades with deep-link parameter
        router.push(`/trades?trade_id=${newTrade.id}`);
      } else {
        throw new Error("Trade initiation succeeded but no trade ID was returned.");
      }
    } catch (err: any) {
      console.error("Trade initiation failed:", err);
      const message = err?.message || "Failed to initiate trade. Please check your wallet balance and try again.";
      setTradeError(message);
      setInitiatingMatchId(null);
    }
  };

  const handleAcceptDemandOffer = async (item: any) => {
    if (initiatingMatchId) return;
    const reqId = item.requirementId || "demand-offer";
    setInitiatingMatchId(reqId);
    setTradeError(null);

    try {
      const myListings = await api.getMyListings();
      const activeListing = myListings && myListings.length > 0 ? myListings.find((l: any) => l.status === "active") || myListings[0] : null;

      if (!activeListing) {
        throw new Error("No active listing found on your account to fulfill this demand. Please create an energy listing first.");
      }

      const payload = {
        listing_id: activeListing.id,
        requirement_id: item.requirementId,
        energy_amount_kwh: Number(item.consumer?.energyRequiredKwh) || 15.0,
        unit_price: Number(item.consumer?.maxPricePerKwh) || Number(activeListing.price_per_kwh) || 5.8,
        match_score: Number(item.compositeMatchScore) || 94.2,
        match_explanation: {
          summary: item.summary || "Prosumer accepted incoming consumer demand",
          factors: item.factors || [],
        },
      };

      const newTrade = await api.initiateTrade(payload);
      if (newTrade && newTrade.id) {
        router.push(`/trades?trade_id=${newTrade.id}`);
      } else {
        throw new Error("Trade initiation succeeded but no trade ID was returned.");
      }
    } catch (err: any) {
      console.error("Trade offer initiation failed:", err);
      setTradeError(err?.message || "Failed to issue trade offer. Please check your active listings.");
      setInitiatingMatchId(null);
    }
  };

  const activeConsumerMatches = liveMatches || CONSUMER_RANKED_MATCHES;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Smart Constraint Matching Engine
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              5-Factor Multi-Objective Scorer
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {isConsumer
              ? "Deterministic constraint solver ranking active solar prosumers with mathematical match explanations."
              : "Inbound demand matching engine scoring consumer bids against your Bodakdev rooftop solar surplus profile."}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Engine: PostGIS + Exact 35/20/25/10/10 Weights
        </div>
      </div>

      {matchStatusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{matchStatusMessage}</span>
        </div>
      )}

      {tradeError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{tradeError}</span>
          </div>
          <button
            onClick={() => setTradeError(null)}
            className="text-rose-400 hover:text-rose-300 text-xs underline shrink-0 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Left Requirement / Supply Form (1/3), Right Ranked Matches (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Parameters Form Card */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 h-fit shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-emerald-400" />
              {isConsumer ? "Requirement Constraints" : "Prosumer Supply Parameters"}
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {activeUser.name} ({activeUser.roleLabel})
            </span>
          </div>

          {isConsumer ? (
            /* Consumer Form */
            <div className="space-y-4 text-xs">
              {myRequirements.length > 0 && (
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Select Registered Requirement</label>
                  <select
                    value={selectedRequirementId}
                    onChange={(e) => handleSelectRequirement(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Custom Parameters (Ad-Hoc)</option>
                    {myRequirements.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title} ({r.energy_required_kwh} kWh @ ₹{r.max_price_per_kwh}/kWh)
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                  <span className="text-indigo-400 font-mono">{substationId}</span>
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
                <span>{isConsumer ? "Execute Smart Matching" : "Scan Demand Orderbook"}</span>
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
                ({isConsumer ? activeConsumerMatches.length : PROSUMER_RANKED_DEMANDS.length} verified counterparts)
              </span>
            </h2>
            <span className="text-[11px] text-slate-400">
              Sorted by Multi-Factor Composite Score
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
                Evaluating PostGIS & Feeder Constraints...
              </h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Calculating line loss distance across Bodakdev and Navrangpura feeders, verifiable reputation scores, and time overlap.
              </p>
            </div>
          ) : isConsumer ? (
            /* Consumer View: Prosumer Matches */
            <div className="space-y-4">
              {activeConsumerMatches.map((item: any) => {
                const listingId = item.listing_id || item.listingId;
                const title = item.listing_title || item.listing?.title;
                const prosumerName = item.prosumer_name || item.listing?.prosumerName;
                const price = item.price_per_kwh || item.listing?.pricePerKwh;
                const distanceKm = item.distance_km ?? item.listing?.distanceKm ?? 0;
                const reliability = item.seller_reliability_score ?? item.listing?.sellerReliabilityScore ?? 100;
                const gridSub = item.grid_substation_id || item.listing?.gridSubstationId;
                const matchScore = item.composite_match_score ?? item.compositeMatchScore;
                const rank = item.rank;
                const explanation = item.explanation || {
                  summary: item.summary,
                  factors: item.factors,
                  trade_off_insight: item.tradeOffInsight
                };

                const isExpanded = expandedExplanation === listingId;

                return (
                  <motion.div
                    key={listingId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      rank === 1
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
                              rank === 1
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 glow-emerald"
                                : "bg-slate-800 text-slate-300 border border-slate-700"
                            }`}
                          >
                            #{rank}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-slate-100">{title}</h3>
                              {rank === 1 && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  Top Pick
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>Seller: <strong className="text-slate-200">{prosumerName}</strong></span>
                              <span>•</span>
                              <span>Ahmedabad Microgrid Node</span>
                            </p>
                          </div>
                        </div>

                        {/* Match Score Gauge */}
                        <div className="text-right shrink-0">
                          <div className="text-2xl font-black font-mono text-emerald-400">
                            {matchScore}%
                          </div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                            Composite Match Score
                          </span>
                        </div>
                      </div>

                      {/* Quick Metric Bar */}
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800">
                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block">Unit Tariff</span>
                          <span className="text-sm font-mono font-bold text-emerald-400">
                            {formatINR(price)}/kWh
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block">Distance</span>
                          <span className="text-sm font-mono font-bold text-slate-200">
                            {formatDistance(distanceKm)}
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block">Reliability</span>
                          <span className="text-sm font-mono font-bold text-slate-200">
                            {reliability}% Trust
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block">Grid Feeder</span>
                          <span className="text-xs font-mono font-bold text-indigo-400 truncate block">
                            {gridSub}
                          </span>
                        </div>
                      </div>

                      {/* Expandable Explanation Button */}
                      <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-800">
                        <button
                          onClick={() => toggleExplanation(listingId)}
                          className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition-colors"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                          <span>Why this match? (5 Factor Breakdown)</span>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>

                        <button
                          onClick={() => handleInitiateTrade(item)}
                          disabled={initiatingMatchId === listingId}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs transition-colors"
                        >
                          {initiatingMatchId === listingId ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              <span>Locking Escrow...</span>
                            </>
                          ) : (
                            <>
                              <span>Select & Lock Trade</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Factor Explanation Panel */}
                    <AnimatePresence>
                      {isExpanded && explanation && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="bg-slate-950/80 border-t border-slate-800 px-5 py-4 space-y-3"
                        >
                          <div className="text-xs text-slate-300 font-medium">
                            {explanation.summary}
                          </div>

                          <div className="space-y-2 pt-2">
                            {explanation.factors?.map((factor: any, idx: number) => {
                              const impactColor =
                                factor.impact === "POSITIVE"
                                  ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                                  : factor.impact === "BONUS"
                                  ? "text-indigo-400 border-indigo-500/30 bg-indigo-500/10"
                                  : factor.impact === "WARNING"
                                  ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                                  : "text-slate-400 border-slate-700 bg-slate-800/40";

                              return (
                                <div
                                  key={idx}
                                  className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800/60 text-xs"
                                >
                                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-200">{factor.factor}</span>
                                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${impactColor}`}>
                                          {factor.impact}
                                        </span>
                                      </div>
                                      <span className="text-[10px] font-mono text-slate-400">Weight: {factor.weight}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-0.5">{factor.detail}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {explanation.trade_off_insight && (
                            <div className="p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-500/20 text-xs text-indigo-300 mt-2">
                              <strong>Trade-off Insight:</strong> {explanation.trade_off_insight}
                            </div>
                          )}
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

                        <button
                          onClick={() => handleAcceptDemandOffer(item)}
                          disabled={initiatingMatchId === item.requirementId}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs transition-colors"
                        >
                          {initiatingMatchId === item.requirementId ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              <span>Issuing Offer...</span>
                            </>
                          ) : (
                            <>
                              <span>Accept & Issue Trade Offer</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </>
                          )}
                        </button>
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

export default function MatchingPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-400 text-xs">Loading Matching Engine...</div>}>
      <MatchingContent />
    </Suspense>
  );
}

