"use client";

import React, { useState } from "react";
import { formatINR } from "@/lib/utils";
import { usePerspective } from "@/lib/perspective-context";
import { WalletTransactionItem } from "@/lib/demo-data";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Lock,
  RefreshCw,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Info,
} from "lucide-react";

export default function WalletPage() {
  const { perspective, activeUser, isConsumer, isProsumer } = usePerspective();
  const [availableBalance, setAvailableBalance] = useState<number>(activeUser.walletBalance);
  const [escrowBalance, setEscrowBalance] = useState<number>(activeUser.escrowBalance);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(2000);

  // Keep synced when perspective changes
  React.useEffect(() => {
    setAvailableBalance(activeUser.walletBalance);
    setEscrowBalance(activeUser.escrowBalance);
  }, [activeUser]);

  const handleDeposit = () => {
    setAvailableBalance((prev: number) => prev + depositAmount);
    setShowDepositModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Internal Settlement Wallet
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              INR Prototype Ledger
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Wallet context for <span className="text-slate-200 font-semibold">{activeUser.name}</span> ({activeUser.roleLabel}) • Ahmedabad Grid Node
          </p>
        </div>

        <button
          onClick={() => setShowDepositModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-colors self-start sm:self-auto shadow-lg shadow-emerald-500/20"
        >
          <Plus className="h-4 w-4" />
          <span>+ Add Demo Credits (₹)</span>
        </button>
      </div>

      {/* Balances Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Available Balance</span>
            <Wallet className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-3xl font-black font-mono text-slate-100">
            {formatINR(availableBalance)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Unencumbered funds ready for trade locking or withdrawal.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Escrow Balance (Locked)</span>
            <Lock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3 text-3xl font-black font-mono text-amber-400">
            {formatINR(escrowBalance)}
          </div>
          <p className="mt-1 text-xs text-amber-400/80 font-medium">
            {escrowBalance > 0
              ? `Protected in active trade #${activeUser.recentTrades[0]?.id ?? "001"} awaiting delivery.`
              : "No funds currently locked in escrow."}
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Account Value</span>
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-3 text-3xl font-black font-mono text-slate-100">
            {formatINR(availableBalance + escrowBalance)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Cumulative wallet liquidity (Available + Escrow).
          </p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100">
            Double-Entry Transaction History — {activeUser.name}
          </h3>
          <span className="text-[11px] font-mono text-slate-400">Settlement Currency: INR (₹)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-slate-400 uppercase font-mono border-b border-slate-800">
              <tr>
                <th className="pb-3">Type</th>
                <th className="pb-3">Description</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-slate-200">
              {activeUser.walletTransactions.map((tx: WalletTransactionItem) => (
                <tr key={tx.id} className="hover:bg-slate-800/40">
                  <td className="py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                        tx.type === "deposit"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : tx.type === "escrow_hold"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      }`}
                    >
                      {tx.type.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 font-sans text-slate-200">{tx.description}</td>
                  <td className="py-3 text-slate-400">{tx.date}</td>
                  <td className="py-3">
                    <span className="text-emerald-400 flex items-center gap-1 font-sans">
                      <CheckCircle2 className="h-3 w-3" />
                      {tx.status}
                    </span>
                  </td>
                  <td
                    className={`py-3 text-right font-bold ${
                      tx.type === "escrow_hold" ? "text-amber-400" : "text-emerald-400"
                    }`}
                  >
                    {tx.type === "escrow_hold" ? "-" : "+"}
                    {formatINR(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Non-Banking Notice */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
        <Info className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200 block font-semibold">Hackathon Prototype Notice:</strong>
          <span>
            This internal wallet operates as a zero-external-dependency double-entry simulated ledger for peer energy trades. In production, this can connect directly to India UPI Autopay / Open Banking BBPS APIs.
          </span>
        </div>
      </div>

      {/* Deposit Simulation Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100">Add Simulated Demo Credits</h3>
            <p className="text-xs text-slate-400">
              Instantly credit your wallet to test escrow hold and dual-signature trade settlement.
            </p>

            <div className="grid grid-cols-3 gap-2">
              {[1000, 2000, 5000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setDepositAmount(amt)}
                  className={`py-2 rounded-lg font-mono text-xs font-bold border transition-colors ${
                    depositAmount === amt
                      ? "bg-emerald-500 text-slate-950 border-emerald-400"
                      : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {formatINR(amt)}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowDepositModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDeposit}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-600"
              >
                Confirm Deposit of {formatINR(depositAmount)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
