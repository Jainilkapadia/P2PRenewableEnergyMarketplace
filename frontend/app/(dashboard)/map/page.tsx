"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AHMEDABAD_LISTINGS, ProsumerListing } from "@/lib/demo-data";
import { formatINR, formatKWh, formatDistance, calculateDistanceKm } from "@/lib/utils";
import { usePerspective } from "@/lib/perspective-context";
import { api } from "@/lib/api-client";
import {
  MapPin,
  X,
  ShieldCheck,
  Zap,
  Clock,
  Layers,
  ArrowRight,
  Sparkles,
  Sun,
  RefreshCw,
  Radio,
  CheckCircle2,
} from "lucide-react";

// SSR-Safe dynamic import for MapLibre
const MapLibreMap = dynamic(() => import("@/components/map/MapLibreMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 text-xs font-mono">
      <span className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
        Loading Ahmedabad Microgrid Spatial Map...
      </span>
    </div>
  ),
});

import { ActiveTradeFlow } from "@/components/map/MapLibreMap";

function deriveNeighborhoodAndAddress(lat: number, lng: number): { neighborhood: string; address: string } {
  // Bodakdev approx (23.0384, 72.5122)
  if (Math.abs(lat - 23.0384) < 0.02 && Math.abs(lng - 72.5122) < 0.02) {
    return {
      neighborhood: "Bodakdev",
      address: "Sindhu Bhavan Marg, Bodakdev, Ahmedabad",
    };
  }
  // Prahlad Nagar approx (23.0118, 72.5074)
  if (Math.abs(lat - 23.0118) < 0.02 && Math.abs(lng - 72.5074) < 0.02) {
    return {
      neighborhood: "Prahlad Nagar",
      address: "100 Feet Rd, Prahlad Nagar, Ahmedabad",
    };
  }
  // Science City approx (23.0780, 72.5060)
  if (Math.abs(lat - 23.0780) < 0.02 && Math.abs(lng - 72.5060) < 0.02) {
    return {
      neighborhood: "Science City",
      address: "Science City Rd, Sola, Ahmedabad",
    };
  }
  // Navrangpura approx (23.0365, 72.5611)
  if (Math.abs(lat - 23.0365) < 0.02 && Math.abs(lng - 72.5611) < 0.02) {
    return {
      neighborhood: "Navrangpura",
      address: "C.G. Road, Navrangpura, Ahmedabad",
    };
  }
  return {
    neighborhood: "Ahmedabad Node",
    address: `Ahmedabad Microgrid Node (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
  };
}

function MapContent() {
  const { perspective, activeUser } = usePerspective();
  const searchParams = useSearchParams();
  const prosumerQueryId = searchParams.get("prosumer");
  const tradeQueryId = searchParams.get("trade_id") || searchParams.get("trade");

  const [rawListings, setRawListings] = useState<ProsumerListing[]>(AHMEDABAD_LISTINGS);
  const [selectedProsumer, setSelectedProsumer] = useState<ProsumerListing | null>(null);
  const [activeTradeFlow, setActiveTradeFlow] = useState<ActiveTradeFlow | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLiveApi, setIsLiveApi] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>("");

  // Fetch live listings from /api/v1/listings/
  const fetchListings = async () => {
    setIsLoading(true);
    try {
      const data = await api.getListings();
      if (Array.isArray(data) && data.length > 0) {
        const mapped: ProsumerListing[] = data.map((item) => {
          const lat = typeof item.latitude === "number" ? item.latitude : 23.0384;
          const lng = typeof item.longitude === "number" ? item.longitude : 72.5122;
          const { neighborhood, address } = deriveNeighborhoodAndAddress(lat, lng);
          const dist = calculateDistanceKm(activeUser.location.lat, activeUser.location.lng, lat, lng);

          let sourceLabel = "Rooftop Solar";
          if (item.source_type === "solar_battery") sourceLabel = "Solar + Battery";
          else if (item.source_type === "microgrid_solar") sourceLabel = "Microgrid Solar";

          return {
            id: item.id,
            prosumerId: item.prosumer_id || "prosumer-node",
            prosumerName: item.prosumer_name || "Solar Prosumer",
            title: item.title || "Solar Energy Surplus",
            energyAvailableKwh: Number(item.energy_available_kwh || 0),
            energyRemainingKwh: Number(item.energy_remaining_kwh || item.energy_available_kwh || 0),
            pricePerKwh: Number(item.price_per_kwh || 5.8),
            availableHours: "Available next 8-12 hours",
            sourceType: (item.source_type as any) || "solar_rooftop",
            sourceLabel,
            location: {
              lat,
              lng,
              address,
              neighborhood,
            },
            distanceKm: dist,
            gridSubstationId: item.grid_substation_id || "AHMEDABAD_SUB_ZONE_1",
            sellerReliabilityScore: Number(item.seller_reliability_score ?? 98.5),
            completedTrades: 35,
            status: item.status || "active",
          };
        });

        setRawListings(mapped);
        setIsLiveApi(true);
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

        // If a query parameter was provided, select that listing
        if (prosumerQueryId) {
          const matched = mapped.find((l) => l.id === prosumerQueryId);
          if (matched) {
            setSelectedProsumer(matched);
          } else if (mapped.length > 0) {
            setSelectedProsumer(mapped[0]);
          }
        } else if (mapped.length > 0) {
          setSelectedProsumer(mapped[0]);
        }
      } else {
        // Fallback to demo data
        setRawListings(AHMEDABAD_LISTINGS);
        setSelectedProsumer(AHMEDABAD_LISTINGS[0]);
      }
    } catch (err) {
      console.warn("Backend listings API unreachable, using coherent Ahmedabad fallback data:", err);
      setRawListings(AHMEDABAD_LISTINGS);
      setSelectedProsumer(AHMEDABAD_LISTINGS[0]);
      setIsLiveApi(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [prosumerQueryId]);

  // Load trade coordinates and details when tradeQueryId is present
  useEffect(() => {
    if (!tradeQueryId) {
      setActiveTradeFlow(null);
      return;
    }

    let isMounted = true;

    async function loadTradeFlow() {
      try {
        // 1. Fetch authorized trades for current user
        const myTrades = await api.getMyTrades();
        if (!isMounted || !Array.isArray(myTrades)) return;

        const trade = myTrades.find((t: any) => t.id === tradeQueryId);
        if (!trade || !isMounted) return;

        // 2. Fetch users to resolve geographic endpoints
        const users = await api.getUsers();
        if (!isMounted) return;

        const seller = users.find((u: any) => u.id === trade.seller_id);
        const buyer = users.find((u: any) => u.id === trade.buyer_id);

        if (
          seller &&
          buyer &&
          typeof seller.latitude === "number" &&
          typeof seller.longitude === "number" &&
          typeof buyer.latitude === "number" &&
          typeof buyer.longitude === "number"
        ) {
          const flow: ActiveTradeFlow = {
            tradeId: trade.id,
            sellerId: trade.seller_id,
            sellerName: trade.seller_name || seller.full_name || "Seller Node",
            sellerCoords: [seller.longitude, seller.latitude],
            buyerId: trade.buyer_id,
            buyerName: trade.buyer_name || buyer.full_name || "Buyer Node",
            buyerCoords: [buyer.longitude, buyer.latitude],
            energyKwh: trade.energy_amount_kwh,
            unitPrice: trade.unit_price,
            totalAmount: trade.total_amount,
            status: trade.status,
            verificationReference: trade.verification_reference,
            isFullyVerified: trade.is_fully_verified,
            isAnchored: trade.status === "fully_verified" && Boolean(trade.blockchain_tx_hash),
          };

          if (isMounted) {
            setActiveTradeFlow(flow);
          }
        } else {
          // If coordinates are unavailable, do not invent or draw false coordinates
          if (isMounted) {
            setActiveTradeFlow(null);
          }
        }
      } catch (err) {
        console.warn("Could not load trade flow for map:", err);
        if (isMounted) {
          setActiveTradeFlow(null);
        }
      }
    }

    loadTradeFlow();

    return () => {
      isMounted = false;
    };
  }, [tradeQueryId]);

  // Recalculate dynamic distance from active user anchor
  const listings = useMemo(() => {
    return rawListings.map((item) => {
      const dist = calculateDistanceKm(
        activeUser.location.lat,
        activeUser.location.lng,
        item.location.lat,
        item.location.lng
      );
      return {
        ...item,
        distanceKm: dist,
      };
    });
  }, [rawListings, activeUser]);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Nearby Prosumer Map
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Ahmedabad Node ({activeUser.substation})
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time geospatial distribution of solar energy sellers across Ahmedabad (Bodakdev, Navrangpura, Prahlad Nagar, Science City).
          </p>
        </div>

        {/* Live Backend Indicator & Refresh */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono self-start sm:self-auto">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs shadow-sm ${
              isLiveApi
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                : "bg-slate-900 text-slate-300 border-slate-800"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isLiveApi ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}></span>
            <span>{isLiveApi ? `API: ${listings.length} Active Nodes` : "Local Grid Mode"}</span>
          </div>

          <button
            onClick={fetchListings}
            disabled={isLoading}
            title="Refresh Live Listings"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
          </button>

          {/* User Anchor Badge */}
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-200">
            <span
              className={`h-2.5 w-2.5 rounded-full shadow ${
                perspective === "consumer" ? "bg-blue-400" : "bg-amber-400"
              }`}
            ></span>
            <span>Anchor: {activeUser.name} ({activeUser.location.neighborhood})</span>
          </span>
        </div>
      </div>

      {/* Main Map Container with Slide-out Drawer */}
      <div className="relative h-[calc(100vh-210px)] min-h-[540px] w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
        <MapLibreMap
          listings={listings}
          selectedProsumer={selectedProsumer}
          onSelectProsumer={(p) => setSelectedProsumer(p)}
          isLoading={isLoading}
          activeTradeFlow={activeTradeFlow}
        />

        {/* Floating Quick Prosumer Selector Tabs (Top-Left overlay) */}
        <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 max-w-md">
          {listings.map((listing) => {
            const isSelected = selectedProsumer?.id === listing.id;
            return (
              <button
                key={listing.id}
                onClick={() => setSelectedProsumer(listing)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all backdrop-blur-md shadow-lg flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-emerald-500 text-slate-950 border border-emerald-400 shadow-emerald-500/30 scale-105"
                    : "bg-slate-900/90 text-slate-300 border border-slate-700/80 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Sun className={`h-3 w-3 ${isSelected ? "text-slate-950" : "text-amber-400"}`} />
                <span>{listing.location.neighborhood}</span>
                <span className={`text-[10px] font-normal ${isSelected ? "text-slate-900" : "text-slate-400"}`}>
                  ({formatDistance(listing.distanceKm)})
                </span>
              </button>
            );
          })}
        </div>

        {/* Sliding Prosumer Detail Drawer (Right side overlay) */}
        <AnimatePresence>
          {selectedProsumer && (
            <motion.div
              initial={{ x: 380, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 380, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-4 right-4 bottom-4 w-80 md:w-96 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-2xl p-5 flex flex-col justify-between z-20 overflow-y-auto"
            >
              <div>
                {/* Header & Close Button */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {selectedProsumer.sellerReliabilityScore}% Verified Trust
                  </span>

                  <button
                    onClick={() => setSelectedProsumer(null)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Prosumer Title & Node Details */}
                <div className="mt-4">
                  <h3 className="text-base font-bold text-slate-100 leading-snug">
                    {selectedProsumer.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <span className="font-semibold text-slate-200">
                      {selectedProsumer.prosumerName}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-indigo-400">
                      {selectedProsumer.gridSubstationId}
                    </span>
                  </p>
                </div>

                {/* Key Numbers Grid */}
                <div className="mt-4 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-sans">Available Clean Power</span>
                    <span className="text-xl font-bold font-mono text-slate-100 block mt-0.5">
                      {formatKWh(selectedProsumer.energyRemainingKwh)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-sans">Unit Tariff</span>
                    <span className="text-xl font-bold font-mono text-emerald-400 block mt-0.5">
                      {formatINR(selectedProsumer.pricePerKwh)}
                      <span className="text-xs font-normal text-slate-400">/kWh</span>
                    </span>
                  </div>
                </div>

                {/* Technical & Grid Specifications */}
                <div className="mt-4 space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                      Physical Distance
                    </span>
                    <span className="font-mono font-bold">
                      {formatDistance(selectedProsumer.distanceKm)} from {activeUser.location.neighborhood}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-indigo-400" />
                      Substation Feeder
                    </span>
                    <span className="font-mono text-indigo-400 font-bold">
                      {selectedProsumer.gridSubstationId}
                      {selectedProsumer.gridSubstationId === activeUser.substation && " (Same Feeder)"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-400" />
                      Generation Source
                    </span>
                    <span className="capitalize">{selectedProsumer.sourceLabel}</span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      Physical Address
                    </span>
                    <span className="text-right truncate max-w-[180px]" title={selectedProsumer.location.address}>
                      {selectedProsumer.location.address}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      Verified History
                    </span>
                    <span className="text-emerald-400 font-medium">
                      {selectedProsumer.completedTrades} completed trades
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-800 space-y-2">
                <Link
                  href="/matching"
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 glow-emerald"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Trade Offer via Smart Matcher</span>
                </Link>

                <Link
                  href="/marketplace"
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>View All Marketplace Listings</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-[600px] rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 text-xs font-mono">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
            Loading Ahmedabad Microgrid Spatial Map...
          </span>
        </div>
      }
    >
      <MapContent />
    </Suspense>
  );
}
