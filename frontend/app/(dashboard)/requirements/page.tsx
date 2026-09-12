"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatINR, formatKWh } from "@/lib/utils";
import {
  Sliders,
  Sparkles,
  MapPin,
  Clock,
  BatteryCharging,
  ArrowRight,
  PlusCircle,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function RequirementsPage() {
  const { user, role } = useAuth();
  const [requirements, setRequirements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [energyRequiredKwh, setEnergyRequiredKwh] = useState<number>(25.0);
  const [maxPricePerKwh, setMaxPricePerKwh] = useState<number>(6.50);
  const [requiredFrom, setRequiredFrom] = useState("");
  const [requiredTo, setRequiredTo] = useState("");
  const [maxRadiusKm, setMaxRadiusKm] = useState<number>(15.0);
  const [minSellerReliability, setMinSellerReliability] = useState<number>(80.0);
  const [gridSubstationId, setGridSubstationId] = useState("AHMEDABAD_SUB_ZONE_1");
  const [preferredSubstationOnly, setPreferredSubstationOnly] = useState<boolean>(false);
  const [latitude, setLatitude] = useState<number>(23.0365);
  const [longitude, setLongitude] = useState<number>(72.5611);

  const isConsumerOrDual = role === "consumer" || role === "dual" || role === "admin";

  const fetchRequirements = async () => {
    setIsLoading(true);
    try {
      if (isConsumerOrDual) {
        const data = await api.getMyRequirements();
        setRequirements(data);
      } else {
        const data = await api.getRequirements();
        setRequirements(data);
      }
    } catch (err: any) {
      console.error("Failed to load requirements:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Set default demand window: from now + 1 hour to now + 5 hours
    const now = new Date();
    const from = new Date(now.getTime() + 60 * 60 * 1000);
    const to = new Date(now.getTime() + 5 * 60 * 60 * 1000);

    const toLocalISO = (d: Date) => {
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offset).toISOString().slice(0, 16);
    };

    setRequiredFrom(toLocalISO(from));
    setRequiredTo(toLocalISO(to));

    if (user?.latitude && user?.longitude) {
      setLatitude(user.latitude);
      setLongitude(user.longitude);
    }
    if (user?.grid_substation_id) {
      setGridSubstationId(user.grid_substation_id);
    }

    fetchRequirements();
  }, [user, role]);

  const handleCreateRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (!title.trim()) {
        throw new Error("Please provide a title for your energy requirement.");
      }
      if (energyRequiredKwh <= 0) {
        throw new Error("Required energy must be greater than 0 kWh.");
      }
      if (maxPricePerKwh <= 0) {
        throw new Error("Maximum price per kWh must be greater than 0.");
      }
      if (!requiredFrom || !requiredTo) {
        throw new Error("Please select both start and end delivery times.");
      }
      if (new Date(requiredTo) <= new Date(requiredFrom)) {
        throw new Error("Delivery End time must be strictly after Delivery Start time.");
      }

      await api.createRequirement({
        title: title.trim(),
        energy_required_kwh: Number(energyRequiredKwh),
        max_price_per_kwh: Number(maxPricePerKwh),
        required_from: new Date(requiredFrom).toISOString(),
        required_to: new Date(requiredTo).toISOString(),
        max_radius_km: Number(maxRadiusKm),
        min_seller_reliability: Number(minSellerReliability),
        grid_substation_id: gridSubstationId,
        preferred_substation_only: preferredSubstationOnly,
        latitude: Number(latitude),
        longitude: Number(longitude),
      });

      setActionSuccess("Energy requirement published successfully!");
      setIsModalOpen(false);
      setTitle("");
      await fetchRequirements();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setFormError(err.message || "Failed to create energy requirement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequirement = async (reqId: string) => {
    if (!confirm("Are you sure you want to cancel this demand requirement?")) return;
    try {
      await api.deleteRequirement(reqId);
      setActionSuccess("Requirement cancelled successfully.");
      await fetchRequirements();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || "Failed to cancel requirement.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Sliders className="h-5 w-5 text-emerald-400" />
            {isConsumerOrDual ? "My Energy Requirements" : "Consumer Demand Requirements"}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {isConsumerOrDual
              ? "Configure demand parameters, price ceilings, and spatial discovery radius for Ahmedabad microgrid"
              : "Active renewable energy demand registered by consumers across Ahmedabad"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isConsumerOrDual && (
            <button
              onClick={() => {
                setFormError(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create Requirement</span>
            </button>
          )}
          <Link
            href="/matching"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all border border-slate-700"
          >
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span>Matching Discovery</span>
          </Link>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Requirements List */}
      {isLoading ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs">
          Loading energy requirements from database...
        </div>
      ) : requirements.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
          <BatteryCharging className="h-10 w-10 text-emerald-400/60 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-200">No Requirements Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {isConsumerOrDual
              ? "You have not registered any energy requirements. Click 'Create Requirement' to broadcast your demand."
              : "No consumer requirements found on this feeder."}
          </p>
          {isConsumerOrDual && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create Demand Requirement</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {requirements.map((req) => {
            const isOwner = user?.id === req.consumer_id;
            const isOpen = req.status === "open";

            return (
              <div
                key={req.id}
                className={`p-6 rounded-2xl bg-slate-900/90 border transition-all space-y-4 ${
                  isOpen ? "border-slate-800" : "border-slate-800/40 opacity-70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <BatteryCharging className="h-3.5 w-3.5" />
                    {req.status?.toUpperCase() || "OPEN"}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-400">ID: {req.id.slice(0, 8)}...</span>
                    {isOwner && isOpen && (
                      <button
                        onClick={() => handleCancelRequirement(req.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Cancel Requirement"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-100">{req.title}</h2>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-emerald-400" />
                      {req.latitude && req.longitude
                        ? `Lat: ${Number(req.latitude).toFixed(4)}, Lon: ${Number(req.longitude).toFixed(4)}`
                        : "Ahmedabad Substation Node"}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-indigo-400">{req.grid_substation_id}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Energy Needed</span>
                    <span className="text-base font-mono font-bold text-slate-100">
                      {formatKWh(req.energy_required_kwh)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Max Ceiling Price</span>
                    <span className="text-base font-mono font-bold text-emerald-400">
                      {formatINR(req.max_price_per_kwh)}
                      <span className="text-xs text-slate-500 font-normal"> / kWh</span>
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Delivery Window</span>
                    <span className="text-xs font-mono font-bold text-slate-200 mt-1 block truncate">
                      {req.required_from ? new Date(req.required_from).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"} -{" "}
                      {req.required_to ? new Date(req.required_to).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Radius & Trust</span>
                    <span className="text-sm font-mono font-bold text-slate-100 block mt-0.5">
                      {req.max_radius_km} km • {req.min_seller_reliability}%
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-end">
                  <Link
                    href={`/matching?requirementId=${req.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-all"
                  >
                    <span>Match with Solar Prosumers</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Dialog for Creating Energy Requirement */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BatteryCharging className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-slate-100">Create Energy Requirement</h2>
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

            <form onSubmit={handleCreateRequirement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Requirement Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., EV Daytime Charging Top-Up"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Energy Needed (kWh) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={energyRequiredKwh}
                    onChange={(e) => setEnergyRequiredKwh(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Max Ceiling Tariff (₹ / kWh) *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.5"
                    required
                    value={maxPricePerKwh}
                    onChange={(e) => setMaxPricePerKwh(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Delivery Start Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={requiredFrom}
                    onChange={(e) => setRequiredFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Delivery End Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={requiredTo}
                    onChange={(e) => setRequiredTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Search Radius (km)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="50"
                    required
                    value={maxRadiusKm}
                    onChange={(e) => setMaxRadiusKm(parseFloat(e.target.value) || 15)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Min Seller Reliability (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="50"
                    max="100"
                    required
                    value={minSellerReliability}
                    onChange={(e) => setMinSellerReliability(parseFloat(e.target.value) || 80)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Substation Grid ID
                  </label>
                  <select
                    value={gridSubstationId}
                    onChange={(e) => setGridSubstationId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    <option value="AHMEDABAD_SUB_ZONE_1">AHMEDABAD_SUB_ZONE_1 (Bodakdev / Navrangpura)</option>
                    <option value="AHMEDABAD_SUB_ZONE_2">AHMEDABAD_SUB_ZONE_2 (Science City / Sola)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="prefSub"
                    checked={preferredSubstationOnly}
                    onChange={(e) => setPreferredSubstationOnly(e.target.checked)}
                    className="h-4 w-4 rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0"
                  />
                  <label htmlFor="prefSub" className="text-xs text-slate-300 cursor-pointer">
                    Strict same-substation only
                  </label>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Consumer PostGIS Spatial Node (Ahmedabad)</span>
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
                  className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <BatteryCharging className="h-4 w-4" />
                  <span>{isSubmitting ? "Creating..." : "Save Requirement"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
