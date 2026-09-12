"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatINR, formatKWh } from "@/lib/utils";
import {
  ListPlus,
  Sun,
  PlusCircle,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Trash2,
  Clock,
  BatteryCharging,
  AlertCircle,
  X,
  Radio,
  Zap,
} from "lucide-react";

export default function ListingsPage() {
  const { user, role } = useAuth();
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [energyAvailableKwh, setEnergyAvailableKwh] = useState<number>(30.0);
  const [pricePerKwh, setPricePerKwh] = useState<number>(5.80);
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableTo, setAvailableTo] = useState("");
  const [sourceType, setSourceType] = useState("solar_rooftop");
  const [gridSubstationId, setGridSubstationId] = useState("AHMEDABAD_SUB_ZONE_1");
  const [latitude, setLatitude] = useState<number>(23.0384);
  const [longitude, setLongitude] = useState<number>(72.5122);

  const isProsumerOrDual = role === "prosumer" || role === "dual" || role === "admin";

  const fetchListings = async () => {
    setIsLoading(true);
    try {
      if (isProsumerOrDual) {
        const data = await api.getMyListings();
        setListings(data);
      } else {
        const data = await api.getListings();
        setListings(data);
      }
    } catch (err: any) {
      console.error("Failed to load listings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Set default availability window: from now + 1 hour to now + 6 hours
    const now = new Date();
    const from = new Date(now.getTime() + 60 * 60 * 1000);
    const to = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    
    // Format to YYYY-MM-DDTHH:mm for datetime-local input
    const toLocalISO = (d: Date) => {
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offset).toISOString().slice(0, 16);
    };
    
    setAvailableFrom(toLocalISO(from));
    setAvailableTo(toLocalISO(to));

    if (user?.latitude && user?.longitude) {
      setLatitude(user.latitude);
      setLongitude(user.longitude);
    }
    if (user?.grid_substation_id) {
      setGridSubstationId(user.grid_substation_id);
    }

    fetchListings();
  }, [user, role]);

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (!title.trim()) {
        throw new Error("Please enter a listing title.");
      }
      if (energyAvailableKwh <= 0) {
        throw new Error("Energy available must be greater than 0 kWh.");
      }
      if (pricePerKwh <= 0) {
        throw new Error("Price per kWh must be greater than 0.");
      }
      if (!availableFrom || !availableTo) {
        throw new Error("Please select both start and end availability times.");
      }
      if (new Date(availableTo) <= new Date(availableFrom)) {
        throw new Error("Available To time must be strictly after Available From time.");
      }

      await api.createListing({
        title: title.trim(),
        energy_available_kwh: Number(energyAvailableKwh),
        price_per_kwh: Number(pricePerKwh),
        available_from: new Date(availableFrom).toISOString(),
        available_to: new Date(availableTo).toISOString(),
        source_type: sourceType,
        grid_substation_id: gridSubstationId,
        latitude: Number(latitude),
        longitude: Number(longitude),
      });

      setActionSuccess("Energy listing published successfully to PostGIS orderbook!");
      setIsModalOpen(false);
      setTitle("");
      await fetchListings();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setFormError(err.message || "Failed to create energy listing.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelListing = async (listingId: string) => {
    if (!confirm("Are you sure you want to cancel this energy listing?")) return;
    try {
      await api.deleteListing(listingId);
      setActionSuccess("Listing cancelled successfully.");
      await fetchListings();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || "Failed to cancel listing.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <ListPlus className="h-5 w-5 text-amber-400" />
            {isProsumerOrDual ? "My Solar Energy Listings" : "Marketplace Energy Listings"}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {isProsumerOrDual
              ? "Publish and manage decentralized renewable supply broadcasts on the Ahmedabad microgrid"
              : "Browse active renewable energy supply published by verified prosumers across Ahmedabad"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isProsumerOrDual && (
            <button
              onClick={() => {
                setFormError(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create Energy Listing</span>
            </button>
          )}
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all border border-slate-700"
          >
            <Sun className="h-4 w-4 text-amber-400" />
            <span>Marketplace Orderbook</span>
          </Link>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Listings Grid */}
      {isLoading ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs">
          Loading energy listings from database...
        </div>
      ) : listings.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
          <Sun className="h-10 w-10 text-amber-400/60 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-200">No Listings Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {isProsumerOrDual
              ? "You haven't broadcasted any solar surplus yet. Click 'Create Energy Listing' to publish surplus generation."
              : "No active prosumer listings are currently registered on this feeder."}
          </p>
          {isProsumerOrDual && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Publish First Listing</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listings.map((item) => {
            const isOwner = user?.id === item.prosumer_id;
            const isActive = item.status === "active";

            return (
              <div
                key={item.id}
                className={`p-5 rounded-2xl bg-slate-900/90 border transition-all space-y-3 ${
                  isActive ? "border-slate-800" : "border-slate-800/40 opacity-70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Sun className="h-3 w-3" />
                    {item.source_type?.replace("_", " ") || "Solar Rooftop"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono flex items-center gap-1 px-2 py-0.5 rounded-full ${
                        isActive
                          ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                          : "text-slate-400 bg-slate-800"
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {item.status?.toUpperCase()}
                    </span>
                    {isOwner && isActive && (
                      <button
                        onClick={() => handleCancelListing(item.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Cancel Listing"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-100">{item.title}</h3>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-amber-400" />
                      {item.latitude && item.longitude
                        ? `Lat: ${Number(item.latitude).toFixed(4)}, Lon: ${Number(item.longitude).toFixed(4)}`
                        : "Ahmedabad Node"}
                    </span>
                    <span className="font-mono text-indigo-400 text-[11px]">
                      {item.grid_substation_id}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Available / Total</span>
                    <span className="text-sm font-mono font-bold text-amber-400">
                      {formatKWh(item.energy_remaining_kwh ?? item.energy_available_kwh)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 block">
                      of {formatKWh(item.energy_available_kwh)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Offer Rate</span>
                    <span className="text-sm font-mono font-bold text-slate-100">
                      {formatINR(item.price_per_kwh)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">per kWh</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Window</span>
                    <span className="text-[11px] font-mono font-bold text-slate-300 block truncate mt-0.5">
                      {item.available_from ? new Date(item.available_from).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"} -{" "}
                      {item.available_to ? new Date(item.available_to).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      {item.available_from ? new Date(item.available_from).toLocaleDateString() : ""}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Link
                    href={`/map?listing=${item.id}`}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold inline-flex items-center gap-1"
                  >
                    View Node on Map <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Dialog for Creating Energy Listing */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sun className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-bold text-slate-100">Create Energy Listing</h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateListing} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Listing Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Rooftop Solar Afternoon Surplus"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Energy Available (kWh) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={energyAvailableKwh}
                    onChange={(e) => setEnergyAvailableKwh(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Unit Price (₹ / kWh) *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.5"
                    required
                    value={pricePerKwh}
                    onChange={(e) => setPricePerKwh(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Available From *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={availableFrom}
                    onChange={(e) => setAvailableFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Available To *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={availableTo}
                    onChange={(e) => setAvailableTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Renewable Generation Source
                  </label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                  >
                    <option value="solar_rooftop">Solar Rooftop</option>
                    <option value="solar_battery">Solar + Battery Storage</option>
                    <option value="microgrid_solar">Microgrid Solar Array</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Grid Substation Feeder
                  </label>
                  <select
                    value={gridSubstationId}
                    onChange={(e) => setGridSubstationId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="AHMEDABAD_SUB_ZONE_1">AHMEDABAD_SUB_ZONE_1 (Bodakdev / Navrangpura)</option>
                    <option value="AHMEDABAD_SUB_ZONE_2">AHMEDABAD_SUB_ZONE_2 (Science City / Sola)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <MapPin className="h-3.5 w-3.5 text-amber-400" />
                  <span>PostGIS Geographic Node Coordinates (Ahmedabad)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Latitude</span>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      value={latitude}
                      onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Longitude</span>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      value={longitude}
                      onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Sun className="h-4 w-4" />
                  <span>{isSubmitting ? "Publishing..." : "Publish Listing"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
