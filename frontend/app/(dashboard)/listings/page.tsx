"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { formatINR, formatKWh } from "@/lib/utils";
import { ListPlus, Sun, PlusCircle, MapPin, CheckCircle2, ArrowRight } from "lucide-react";

export default function ListingsPage() {
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.getListings()
      .then((data) => setListings(data))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <ListPlus className="h-5 w-5 text-amber-400" />
            My Solar Surplus Listings
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage your decentralized renewable generation broadcasts in Ahmedabad
          </p>
        </div>
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-amber-500/20"
        >
          <Sun className="h-4 w-4" />
          <span>View All Market Listings</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {listings.map((item) => (
          <div key={item.id} className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Sun className="h-3 w-3" />
                {item.source_type?.replace("_", " ") || "Solar Rooftop"}
              </span>
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Active PostGIS Node
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-100">{item.title}</h3>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-amber-400" />
                {item.address_text || "Ahmedabad, GJ"}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800">
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Surplus</span>
                <span className="text-sm font-mono font-bold text-amber-400">
                  {formatKWh(item.energy_available_kwh)}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Offer Rate</span>
                <span className="text-sm font-mono font-bold text-slate-100">
                  {formatINR(item.price_per_kwh)}/kWh
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Time Window</span>
                <span className="text-[11px] font-mono font-bold text-slate-300 block truncate mt-0.5">
                  {item.available_start_time?.slice(0, 5)} - {item.available_end_time?.slice(0, 5)}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Link
                href="/map"
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold inline-flex items-center gap-1"
              >
                View on Map <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
