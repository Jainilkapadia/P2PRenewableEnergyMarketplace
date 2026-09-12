"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatINR, formatKWh, shortenHash } from "@/lib/utils";
import { usePerspective } from "@/lib/perspective-context";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
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
  RefreshCw,
} from "lucide-react";

export default function TradesPage() {
  const { perspective, activeUser, isConsumer, isProsumer } = usePerspective();
  const { user } = useAuth();
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTradeId, setSelectedTradeId] = useState<string>("");

  useEffect(() => {
    async function loadTrades() {
      setLoading(true);
      try {
        const res = await api.getMyTrades();
        if (res && res.length > 0) {
          // Deduplicate by trade ID
          const unique = res.filter(
            (t: any, index: number, self: any[]) => index === self.findIndex((x) => x.id === t.id)
          );
          setTrades(unique);
          if (!selectedTradeId || !unique.some((t: any) => t.id === selectedTradeId)) {
            setSelectedTradeId(unique[0].id);
          }
        } else {
          setTrades([]);
        }
      } catch (err) {
        console.warn("Could not load backend trades:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTrades();
  }, [perspective, user]);

  const selectedTrade = trades.find((t) => t.id === selectedTradeId) || trades[0];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "fully_verified":
        return {
          label: "COMPLETE DIGITAL SIGNATURE",
          classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        };
      case "buyer_signed":
        return {
          label: "BUYER SIGNED",
          classes: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        };
      case "seller_signed":
        return {
          label: "SELLER SIGNED",
          classes: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        };
      case "pending_signatures":
      case "matched":
        return {
          label: "PENDING SIGNATURES",
          classes: "bg-slate-800 text-slate-300 border-slate-700",
        };
      default:
        return {
          label: (status || "UNKNOWN").replace("_", " ").toUpperCase(),
          classes: "bg-slate-800 text-slate-400 border-slate-700",
        };
    }
  };

  const isSelectedBuyerSigned =
    selectedTrade?.status === "buyer_signed" ||
    selectedTrade?.status === "fully_verified" ||
    selectedTrade?.buyer_signed;

  const isSelectedSellerSigned =
    selectedTrade?.status === "seller_signed" ||
    selectedTrade?.status === "fully_verified" ||
    selectedTrade?.seller_signed;

  const isSelectedFullyVerified = selectedTrade?.status === "fully_verified" || selectedTrade?.is_fully_verified;

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

      {/* Active Trade Lifecycle Spotlight */}
      {selectedTrade ? (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
            <div>
              <span className="text-xs text-slate-400 uppercase font-mono">
                Trade #{selectedTrade.id.substring(0, 8)} •{" "}
                {selectedTrade.buyer_id === user?.id
                  ? `Buyer: ${selectedTrade.buyer_name || "You"}`
                  : `Seller: ${selectedTrade.seller_name || "You"}`}
              </span>
              <h2 className="text-lg font-bold text-slate-100 mt-0.5">
                Trade #{selectedTrade.id.substring(0, 8)} —{" "}
                {formatKWh(selectedTrade.energy_amount_kwh ?? selectedTrade.energyKwh ?? 0)} Clean Solar Delivery
              </h2>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold border self-start sm:self-auto ${
                getStatusBadge(selectedTrade.status).classes
              }`}
            >
              STATUS: {getStatusBadge(selectedTrade.status).label}
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
                <p className="text-[11px] text-slate-400 mt-1">Constraint matched on Ahmedabad Grid</p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>2. Escrow Held</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {formatINR(selectedTrade.total_amount ?? selectedTrade.totalAmount ?? 0)} held in escrow
                </p>
              </div>

              <div
                className={`p-3 rounded-xl border text-xs ${
                  isSelectedBuyerSigned
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  {isSelectedBuyerSigned ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  <span>3. Buyer Signed</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isSelectedBuyerSigned ? "Buyer Ed25519 signature verified" : "Awaiting Buyer digital signature"}
                </p>
              </div>

              <div
                className={`p-3 rounded-xl border text-xs ${
                  isSelectedSellerSigned
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : isSelectedBuyerSigned
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse"
                    : "bg-slate-950 border-slate-800 text-slate-500"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  {isSelectedSellerSigned ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  <span>4. Seller Signed</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isSelectedSellerSigned ? "Seller Ed25519 signature verified" : "Awaiting Seller digital signature"}
                </p>
              </div>

              <div
                className={`p-3 rounded-xl border text-xs ${
                  isSelectedFullyVerified
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold"
                    : "bg-slate-950 border-slate-800 text-slate-500 opacity-60"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="h-4 w-4" />
                  <span>5. Settled & Verified</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isSelectedFullyVerified ? "Cryptographic proof anchored" : "Pending dual signatures"}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Trade Specs & Verification Link */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-800 text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                Buyer: <strong className="text-slate-200">{selectedTrade.buyer_name || "Buyer"}</strong>
              </span>
              <span>
                Seller: <strong className="text-slate-200">{selectedTrade.seller_name || "Seller"}</strong>
              </span>
              <span>
                Feeder: <strong className="text-indigo-400 font-mono">AHMEDABAD_SUB_ZONE_1</strong>
              </span>
              {selectedTrade.trade_canonical_hash && (
                <span>
                  Hash:{" "}
                  <code className="font-mono text-emerald-400 font-bold">
                    {shortenHash(selectedTrade.trade_canonical_hash)}
                  </code>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={`/verification?trade_id=${selectedTrade.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-colors"
              >
                <PenTool className="h-3.5 w-3.5" />
                <span>{isSelectedFullyVerified ? "Inspect Proof" : "Enter Signing Terminal"}</span>
              </Link>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
          <span>Loading ledger trades...</span>
        </div>
      ) : (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs space-y-2">
          <p className="font-semibold text-slate-300">No active trades initiated yet.</p>
          <p>Initiate a trade via Smart Matching to test bilateral Ed25519 signing.</p>
          <Link
            href="/matching"
            className="inline-block mt-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs"
          >
            Find Matches
          </Link>
        </div>
      )}

      {/* Trades Table */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-emerald-400" />
            Peer Transaction Ledger — {user?.full_name || activeUser.name} ({activeUser.roleLabel})
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
              {trades.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500 font-sans">
                    No trades found for this account.
                  </td>
                </tr>
              ) : (
                trades.map((trade: any) => {
                  const isUserBuyer = trade.buyer_id === user?.id;
                  const counterpartyName = isUserBuyer ? trade.seller_name : trade.buyer_name;
                  const counterpartyRole = isUserBuyer ? "Prosumer (Seller)" : "Consumer (Buyer)";
                  const badge = getStatusBadge(trade.status);

                  return (
                    <tr
                      key={trade.id}
                      onClick={() => setSelectedTradeId(trade.id)}
                      className={`cursor-pointer transition-colors ${
                        selectedTradeId === trade.id ? "bg-slate-800/60" : "hover:bg-slate-800/30"
                      }`}
                    >
                      <td className="py-3 font-bold text-slate-100">#{trade.id.substring(0, 8)}</td>
                      <td className="py-3 font-sans font-medium text-slate-200">
                        {counterpartyName || "Counterparty"}
                        <span className="block text-[10px] text-slate-400">{counterpartyRole}</span>
                      </td>
                      <td className="py-3 font-bold text-emerald-400">
                        {formatKWh(trade.energy_amount_kwh ?? trade.energyKwh ?? 0)}
                      </td>
                      <td className="py-3">
                        {formatINR(trade.unit_price ?? trade.unitPrice ?? 0)}/kWh
                      </td>
                      <td className="py-3 font-bold">
                        {formatINR(trade.total_amount ?? trade.totalAmount ?? 0)}
                      </td>
                      <td className="py-3 text-indigo-400">AHMEDABAD_SUB_ZONE_1</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${badge.classes}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 text-right font-sans">
                        <Link
                          href={`/verification?trade_id=${trade.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-emerald-400 hover:underline inline-flex items-center gap-1 text-[11px] font-semibold"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {trade.status === "fully_verified" ? "Verify Receipt" : "Inspect / Sign"}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
