"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function AdminDisputesPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="text-xs text-purple-400 hover:text-purple-300 font-semibold inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Admin Terminal
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          Grid Dispute Resolution & Escrow Audit
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Arbitration tribunal for delivery non-compliance, smart meter discrepancy & SLA reconciliation
        </p>
      </div>

      <div className="p-8 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-100">Zero Active Microgrid Disputes</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          All peer transactions are protected by escrow locks and bilateral cryptographic signatures. In later milestones, automatic SLA arbitrations will appear here.
        </p>
        <div className="pt-2">
          <Link
            href="/trades"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            <span>Inspect Verified Trade Records</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
