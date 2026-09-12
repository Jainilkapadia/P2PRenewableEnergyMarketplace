"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatINR, formatKWh, shortenHash } from "@/lib/utils";
import { usePerspective } from "@/lib/perspective-context";
import { TradeRecord } from "@/lib/demo-data";
import {
  ArrowLeftRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Lock,
  Layers,
  FileCode,
  ArrowRight,
  PenTool,
} from "lucide-react";

export default function TradesPage() {
  const { perspective, activeUser, isConsumer, isProsumer } = usePerspective();
  const [selectedTradeId, setSelectedTradeId] = useState<string>("001");

  const selectedTrade = activeUser.recentTrades.find((t) => t.id === selectedTradeId) || activeUser.recentTrades[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Active P2P Trades
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              Dual-Signature Ledger
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Cryptographically committed energy delivery contracts on Ahmedabad Substation
          </p>
        </div>

        <Link
          href="/matching"
          className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-colors self-start sm:self-auto"
        >
          {isConsumer ? "+ Initiate New Trade" : "+ Browse Incoming Demands"}
        </Link>
      </div>

      {/* Active Trade Lifecycle Spotlight (Trade #001) */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs text-slate-400 uppercase font-mono">
              Active Trade #{selectedTradeId} • {isConsumer ? "Buyer Role (Priya)" : "Seller Role (Aarav)"}
            </span>
            <h2 className="text-lg font-bold text-slate-100 mt-0.5">
              Trade #9b1deb4d — 25.0 kWh Clean Solar Delivery
            </h2>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 self-start sm:self-auto">
            STATUS: PENDING DUAL SIGNATURES
          </span>
        </div>

        {/* 5-Step Visual Timeline */}
        <div className="py-2">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                <span>1. Matched</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">94.2% match on AHMEDABAD_SUB_ZONE_1</p>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                <span>2. Escrow Held</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">₹145.00 locked in wallet</p>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                <span>3. Buyer Signed</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Priya key <code className="font-mono text-emerald-400">#3d4017...</code>
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs animate-pulse">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Clock className="h-4 w-4" />
                <span>4. Seller Signing</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {isProsumer ? "Action required: sign receipt with your key" : "Awaiting Aarav counter-signature"}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs opacity-60">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold">
                <ShieldCheck className="h-4 w-4" />
                <span>5. Settled</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Final audit proof</p>
            </div>
          </div>
        </div>

        {/* Quick Trade Specs & Verification Link */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <span>
              Buyer: <strong className="text-slate-200">Priya Patel (Navrangpura)</strong>
            </span>
            <span>
              Seller: <strong className="text-slate-200">Aarav Sharma (Bodakdev)</strong>
            </span>
            <span>
              Feeder: <strong className="text-indigo-400 font-mono">AHMEDABAD_SUB_ZONE_1</strong>
            </span>
            <span>
              Hash: <code className="font-mono text-emerald-400 font-bold">8f4a1029c7e3...</code>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isProsumer && (
              <Link
                href="/verification"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors"
              >
                <PenTool className="h-3.5 w-3.5" />
                <span>Sign as Aarav Sharma</span>
              </Link>
            )}

            <Link
              href="/verification"
              className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              <span>Inspect Cryptographic Signatures</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Trades Table */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-emerald-400" />
            Peer Transaction Ledger — {activeUser.name} ({activeUser.roleLabel})
          </h3>
          <span className="text-xs text-slate-400 font-mono">{activeUser.substation}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-slate-400 uppercase font-mono border-b border-slate-800">
              <tr>
                <th className="pb-3">Trade ID</th>
                <th className="pb-3">Counterparty</th>
                <th className="pb-3">Clean Energy</th>
                <th className="pb-3">Unit Tariff</th>
                <th className="pb-3">Total Value</th>
                <th className="pb-3">Feeder Zone</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-slate-200">
              {activeUser.recentTrades.map((trade: TradeRecord) => (
                <tr key={trade.id} className="hover:bg-slate-800/40">
                  <td className="py-3 font-bold text-slate-100">#{trade.id}</td>
                  <td className="py-3 font-sans font-medium text-slate-200">
                    {trade.partnerName}
                    <span className="block text-[10px] text-slate-400">{trade.partnerRole}</span>
                  </td>
                  <td className="py-3 font-bold text-emerald-400">{formatKWh(trade.energyKwh)}</td>
                  <td className="py-3">{formatINR(trade.unitPrice)}/kWh</td>
                  <td className="py-3 font-bold">{formatINR(trade.totalAmount)}</td>
                  <td className="py-3 text-indigo-400">{trade.substation}</td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                        trade.status === "settled"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {trade.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 text-right font-sans">
                    <Link
                      href="/verification"
                      className="text-emerald-400 hover:underline inline-flex items-center gap-1 text-[11px]"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verify Receipt
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
