"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { usePerspective } from "@/lib/perspective-context";
import { AHMEDABAD_LISTINGS, ProsumerListing } from "@/lib/demo-data";
import { formatINR, formatKWh, formatDistance, calculateDistanceKm } from "@/lib/utils";
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Clock,
  Award,
  Zap,
  Sun,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Battery,
  UserCheck,
  PlusCircle,
} from "lucide-react";

export default function MarketplacePage() {
  const { perspective, activeUser, isConsumer, isProsumer } = usePerspective();
  const [searchQuery, setSearchQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState(7.5);
  const [maxDistance, setMaxDistance] = useState(15.0);
  const [minReliability, setMinReliability] = useState(80.0);
  const [selectedSubstation, setSelectedSubstation] = useState<string>("ALL");
  const [selectedSource, setSelectedSource] = useState<string>("ALL");

  const listingsWithDynamicDistance = useMemo(() => {
    return AHMEDABAD_LISTINGS.map((item) => {
      const dist = calculateDistanceKm(
        activeUser.location.lat,
        activeUser.location.lng,
        item.location.lat,
        item.location.lng
      );
      return {
        ...item,
        distanceKm: dist,
        isOwnListing: item.prosumerId === activeUser.id,
      };
    });
  }, [activeUser]);

  const filteredListings = useMemo(() => {
    return listingsWithDynamicDistance.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.prosumerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.neighborhood.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPrice = item.pricePerKwh <= maxPrice;
      const matchesDistance = item.distanceKm <= maxDistance;
      const matchesReliability = item.sellerReliabilityScore >= minReliability;
      const matchesSubstation =
        selectedSubstation === "ALL" || item.gridSubstationId === selectedSubstation;
      const matchesSource =
        selectedSource === "ALL" || item.sourceType === selectedSource;

      return (
        matchesSearch &&
        matchesPrice &&
        matchesDistance &&
        matchesReliability &&
        matchesSubstation &&
        matchesSource
      );
    });
  }, [listingsWithDynamicDistance, searchQuery, maxPrice, maxDistance, minReliability, selectedSubstation, selectedSource]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Renewable Energy Marketplace
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live Ahmedabad P2P Orderbook
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {isConsumer ? (
              <>
                Viewing available prosumer offers from your anchor at{" "}
                <span className="text-slate-200 font-semibold">{activeUser.location.neighborhood}</span> on{" "}
                <span className="font-mono text-indigo-400">{activeUser.substation}</span>.
              </>
            ) : (
              <>
                Viewing market orders as Prosumer{" "}
                <span className="text-slate-200 font-semibold">{activeUser.name}</span> ({activeUser.location.neighborhood}) on{" "}
                <span className="font-mono text-indigo-400">{activeUser.substation}</span>.
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isConsumer ? (
            <Link
              href="/matching"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 glow-emerald"
            >
              <Sparkles className="h-4 w-4" />
              <span>Launch Constraint Matcher</span>
            </Link>
          ) : (
            <Link
              href="/matching"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 glow-amber"
            >
              <Sparkles className="h-4 w-4" />
              <span>Inspect Buyer Demands</span>
            </Link>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
        {/* Search Input and Quick Counts */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by prosumer name, neighborhood, or solar array type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={selectedSubstation}
              onChange={(e) => setSelectedSubstation(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Ahmedabad Feeders</option>
              <option value="AHMEDABAD_SUB_ZONE_1">AHMEDABAD_SUB_ZONE_1 (Bodakdev / Navrangpura / Prahlad Nagar)</option>
              <option value="AHMEDABAD_SUB_ZONE_2">AHMEDABAD_SUB_ZONE_2 (Science City / Sola)</option>
            </select>

            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Source Types</option>
              <option value="solar_rooftop">Rooftop Solar</option>
              <option value="solar_battery">Solar + Battery</option>
              <option value="microgrid_solar">Microgrid Array</option>
            </select>
          </div>
        </div>

        {/* Sliders for Price, Distance & Reliability */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-800/80">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>Max Unit Tariff</span>
              <span className="font-mono font-bold text-emerald-400">{formatINR(maxPrice)}/kWh</span>
            </div>
            <input
              type="range"
              min="4.0"
              max="10.0"
              step="0.1"
              value={maxPrice}
              onChange={(e) => setMaxPrice(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>Max Distance Radius</span>
              <span className="font-mono font-bold text-indigo-400">{maxDistance.toFixed(0)} km</span>
            </div>
            <input
              type="range"
              min="2"
              max="25"
              step="1"
              value={maxDistance}
              onChange={(e) => setMaxDistance(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>Min Seller Reliability</span>
              <span className="font-mono font-bold text-amber-400">{minReliability.toFixed(0)}%</span>
            </div>
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
        </div>
      </div>

      {/* Listings Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>
            Showing <strong>{filteredListings.length}</strong> clean energy offers in Ahmedabad
          </span>
          <Link href="/map" className="text-emerald-400 hover:underline flex items-center gap-1 font-medium">
            <MapPin className="h-3.5 w-3.5" />
            Switch to Interactive Map View
          </Link>
        </div>

        {filteredListings.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
            <Zap className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-300">No Listings Match Current Filter</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Try adjusting your maximum price or expanding your geographic radius.
            </p>
            <button
              onClick={() => {
                setMaxPrice(7.5);
                setMaxDistance(15.0);
                setMinReliability(80.0);
                setSelectedSubstation("ALL");
                setSelectedSource("ALL");
                setSearchQuery("");
              }}
              className="mt-4 px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredListings.map((listing) => (
              <motion.div
                key={listing.id}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.15 }}
                className={`p-5 rounded-2xl bg-slate-900 border transition-all flex flex-col justify-between group shadow-sm hover:shadow-xl hover:shadow-black/40 ${
                  listing.isOwnListing
                    ? "border-amber-500/40 ring-1 ring-amber-500/20"
                    : "border-slate-800 hover:border-slate-700/80"
                }`}
              >
                <div>
                  {/* Top Tags */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {listing.sourceType === "solar_rooftop" ? (
                          <Sun className="h-3 w-3 text-amber-400" />
                        ) : listing.sourceType === "solar_battery" ? (
                          <Battery className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Zap className="h-3 w-3 text-indigo-400" />
                        )}
                        {listing.sourceLabel}
                      </span>
                      {listing.isOwnListing && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Your Active Listing
                        </span>
                      )}
                    </div>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck className="h-3 w-3" />
                      {listing.sellerReliabilityScore}% Trust
                    </span>
                  </div>

                  {/* Title & Prosumer */}
                  <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-300 transition-colors line-clamp-1">
                    {listing.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <span className="text-slate-200 font-medium">
                      {listing.isOwnListing ? `${listing.prosumerName} (You)` : listing.prosumerName}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-indigo-400">{listing.gridSubstationId}</span>
                  </p>

                  {/* Energy & Price Key Numbers */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Available Capacity</span>
                      <span className="text-lg font-bold font-mono text-slate-100">
                        {formatKWh(listing.energyRemainingKwh)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-sans">Unit Tariff</span>
                      <span className="text-lg font-bold font-mono text-emerald-400">
                        {formatINR(listing.pricePerKwh)}
                        <span className="text-[10px] text-slate-400 font-normal"> / kWh</span>
                      </span>
                    </div>
                  </div>

                  {/* Meta Details */}
                  <div className="mt-3 space-y-1 text-[11px] text-slate-400">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-emerald-400" />
                        {listing.location.address}
                      </span>
                      <span className="font-mono font-medium text-slate-200">
                        {listing.isOwnListing ? "Local Origin" : formatDistance(listing.distanceKm)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-amber-400" />
                        {listing.availableHours}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-medium">
                        {listing.completedTrades} verified deliveries
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <Link
                    href={`/map?prosumer=${listing.id}`}
                    className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Locate on Map
                  </Link>

                  {listing.isOwnListing ? (
                    <Link
                      href={`/dashboard`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors shrink-0"
                    >
                      <span>Manage Node</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : (
                    <Link
                      href={`/matching`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-colors shrink-0"
                    >
                      <span>Instant Match</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
