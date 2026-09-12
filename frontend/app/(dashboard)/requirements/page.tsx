"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { formatINR, formatKWh } from "@/lib/utils";
import { Sliders, Sparkles, MapPin, Clock, BatteryCharging, ArrowRight } from "lucide-react";

export default function RequirementsPage() {
  const { user, role } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Sliders className="h-5 w-5 text-emerald-400" />
            My Energy Requirements
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Configure demand parameters, max buying rates, and spatial proximity for Ahmedabad microgrid
          </p>
        </div>
        <Link
          href="/matching"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-emerald-500/20"
        >
          <Sparkles className="h-4 w-4" />
          <span>Run Smart Matcher</span>
        </Link>
      </div>

      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <BatteryCharging className="h-3.5 w-3.5" />
            Active Requirement
          </span>
          <span className="text-xs font-mono text-slate-400">ID: req-001</span>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-100">
            EV Daytime Charging Top-Up
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Target Neighborhood: Navrangpura, Ahmedabad • Substation Feeder: AHMEDABAD_SUB_ZONE_1
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Energy Needed</span>
            <span className="text-base font-mono font-bold text-slate-100">{formatKWh(25.0)}</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Max Ceiling Price</span>
            <span className="text-base font-mono font-bold text-emerald-400">{formatINR(6.50)}/kWh</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Required Window</span>
            <span className="text-xs font-mono font-bold text-slate-200 mt-1 block">11:00 - 15:00</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Proximity Radius</span>
            <span className="text-base font-mono font-bold text-slate-100">15.0 km</span>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <Link
            href="/matching"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-all"
          >
            <span>Match with Solar Prosumers</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
