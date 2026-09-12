"use client";

import React from "react";
import { formatINR, formatKWh } from "@/lib/utils";
import {
  BarChart3,
  Sun,
  TrendingDown,
  Sparkles,
  TreeDeciduous,
  Activity,
  Layers,
  ArrowUpRight,
} from "lucide-react";

export default function AnalyticsPage() {
  // Simulated 24-hour diurnal solar generation curve (hourly kWh generation)
  const solarHourlyCurve = [
    { hour: "06:00", kwh: 0.2, price: 6.80 },
    { hour: "08:00", kwh: 1.8, price: 6.40 },
    { hour: "10:00", kwh: 4.5, price: 5.90 },
    { hour: "12:00", kwh: 5.8, price: 5.40 }, // Peak generation, lowest price
    { hour: "14:00", kwh: 5.1, price: 5.60 },
    { hour: "16:00", kwh: 2.9, price: 6.20 },
    { hour: "18:00", kwh: 0.6, price: 6.70 },
  ];

  const totalDeliveredKwh = 1845.5;
  const co2AvoidedKg = Math.round(totalDeliveredKwh * 0.42);
  const treesEquivalent = Math.round(co2AvoidedKg / 22); // ~22 kg CO2 absorbed per tree per year

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
          Grid Analytics & Solar Forecast
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Market Intelligence
          </span>
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Local generation forecasting, price arbitrage analytics, and verified ecological impact metrics.
        </p>
      </div>

      {/* 3 Impact Hero Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Clean Energy Traded</span>
            <Sun className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-3xl font-black font-mono text-slate-100">
            {formatKWh(totalDeliveredKwh)}
          </div>
          <p className="mt-1 text-xs text-emerald-400 font-medium">
            Across 48 completed peer trades in Ahmedabad
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Avoided Carbon Emissions</span>
            <TreeDeciduous className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-3xl font-black font-mono text-emerald-400">
            {co2AvoidedKg.toLocaleString()} kg CO₂
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Equivalent to ~{treesEquivalent} mature trees planted in Ahmedabad
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Average Tariff Arbitrage</span>
            <TrendingDown className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-3xl font-black font-mono text-emerald-400">
            23.7% Savings
          </div>
          <p className="mt-1 text-xs text-slate-400">
            P2P Mean ₹5.80 vs Torrent Power Grid ₹7.60
          </p>
        </div>
      </div>

      {/* 24-Hour Solar Surplus AI Forecast Preview */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Diurnal Solar Generation & Dynamic Price Forecast
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Predicted rooftop photovoltaic generation curve with optimal market clearing prices.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 self-start sm:self-auto">
            AI MODEL: 5-PARAMETER RIDGE REGRESSION
          </span>
        </div>

        {/* Visual Bar Graph */}
        <div className="pt-4 pb-2 border-t border-slate-800">
          <div className="grid grid-cols-7 gap-3 items-end h-48 pt-4">
            {solarHourlyCurve.map((point) => (
              <div key={point.hour} className="flex flex-col items-center h-full justify-end group">
                <span className="text-[10px] font-mono text-emerald-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {point.kwh} kW
                </span>
                <div
                  style={{ height: `${(point.kwh / 6.0) * 100}%` }}
                  className="w-full max-w-[36px] rounded-t-lg bg-gradient-to-t from-emerald-600 to-amber-400 hover:brightness-125 transition-all shadow-md"
                />
                <div className="mt-2 text-center">
                  <span className="text-[11px] font-mono font-bold text-slate-300 block">{point.hour}</span>
                  <span className="text-[10px] font-mono text-amber-400 block">{formatINR(point.price)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400"></span>
              Peak Sunlight Hours: 11:00 AM – 2:30 PM
            </span>
            <span className="text-emerald-400 font-mono">
              Optimal Seller Clearing Window
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
