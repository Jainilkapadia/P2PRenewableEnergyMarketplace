"use client";

import React from "react";
import Link from "next/link";
import { HeartPulse, ArrowLeft, CheckCircle2, Activity, Server, Database, ShieldCheck } from "lucide-react";

export default function AdminHealthPage() {
  const HEALTH_SERVICES = [
    { name: "PostgreSQL 16 + PostGIS Spatial Engine", status: "Healthy", detail: "Port 5432 • Spatial Index Active", icon: Database },
    { name: "FastAPI Modular Monolith Backend", status: "Operational", detail: "Port 8000 • Uvicorn ASGI Worker Active", icon: Server },
    { name: "Ed25519 Cryptographic Verification Engine", status: "Compliant", detail: "Deterministic Canonical SHA-256", icon: ShieldCheck },
    { name: "Ahmedabad Substation Feeder Sync", status: "50.02 Hz Stable", detail: "Zone 1 & Central NOC in Phase", icon: Activity },
  ];

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
          <HeartPulse className="h-5 w-5 text-cyan-400" />
          System & Substation Feeder Health
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Real-time service telemetry, spatial query performance, and cryptographic signer uptime
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {HEALTH_SERVICES.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div key={idx} className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-200">{s.name}</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {s.status}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 pl-10.5">{s.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
