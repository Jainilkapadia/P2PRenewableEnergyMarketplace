"use client";

import React from "react";
import { formatKWh } from "@/lib/utils";
import { usePerspective } from "@/lib/perspective-context";
import {
  Award,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  TrendingUp,
  Info,
  HelpCircle,
} from "lucide-react";

export default function ReliabilityPage() {
  const { perspective, activeUser, isConsumer, isProsumer } = usePerspective();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
          Transaction Reliability Score
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Mathematically Provable
          </span>
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Reputation calculated directly from dual-signed cryptographic transaction receipts in Ahmedabad rather than subjective star ratings.
        </p>
      </div>

      {/* Hero Reliability Showcase */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs text-slate-400 uppercase font-mono">
              Peer Evaluation Subject • Active Perspective
            </span>
            <h2 className="text-xl font-bold text-slate-100 mt-0.5">
              {activeUser.name} — {activeUser.location.neighborhood} ({activeUser.roleLabel})
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Distribution Feeder: <span className="text-indigo-400">{activeUser.substation}</span>
            </p>
          </div>

          <div className="text-right">
            <div className="text-3xl font-black font-mono text-emerald-400">
              {activeUser.reliabilityScore}%
            </div>
            <span className="text-xs font-bold text-slate-200">
              {activeUser.reliabilityLabel}
            </span>
          </div>
        </div>

        {/* 4 Quantitative Metric Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Successful Trades</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
              {activeUser.completedTradesCount} / {activeUser.totalTradesCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {((activeUser.completedTradesCount / activeUser.totalTradesCount) * 100).toFixed(1)}% raw completion rate
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{isConsumer ? "Settled Energy" : "Delivered Energy"}</span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-slate-100">
              {formatKWh(activeUser.completedEnergyKwh)}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Verified clean kilowatt-hours</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Cancellations</span>
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-amber-400">
              {activeUser.cancellationsCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Post-match unilateral drop</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Disputes at Fault</span>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
              {activeUser.disputesCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Flawless arbitration history</div>
          </div>
        </div>

        {/* Calculation Formula Transparency Card */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <HelpCircle className="h-4 w-4 text-emerald-400" />
            <span>Mathematical Derivation (Bayesian Smoothing on Verified Receipts)</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            To prevent cold-start gaming where a participant with 1 trade displays 100%, the platform calculates verified score using historical dual-signed receipts:
          </p>
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-emerald-300">
            Provable Score ({activeUser.name}) = (({activeUser.completedTradesCount} completed − {activeUser.cancellationsCount} dropped) / {activeUser.totalTradesCount} total) = <strong>{activeUser.reliabilityScore}%</strong>
          </div>
        </div>
      </div>

      {/* New User Cold Start Notice */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
        <Info className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200 block font-semibold">Cold Start Policy for New Ahmedabad Prosumers & Consumers:</strong>
          <span>
            Users with fewer than 3 completed transactions are explicitly marked as <code className="text-indigo-300 font-mono">NEW PARTICIPANT (Unrated)</code>. We never fabricate artificial trust scores or allow self-generated reviews.
          </span>
        </div>
      </div>
    </div>
  );
}
