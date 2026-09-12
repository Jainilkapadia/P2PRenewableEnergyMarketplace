"use client";

import React from "react";
import { Bell, CheckCircle2, ShieldCheck, Zap, Sun, Clock } from "lucide-react";

export default function NotificationsPage() {
  const NOTIFICATIONS = [
    {
      id: "n-1",
      title: "Ed25519 Trade Signature Confirmed",
      desc: "Receipt cryptographically signed and stored in immutable audit chain.",
      time: "15 mins ago",
      icon: ShieldCheck,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    },
    {
      id: "n-2",
      title: "Solar Surplus Broadcast Active",
      desc: "Your Ahmedabad microgrid node is visible to local consumers in a 15 km radius.",
      time: "2 hours ago",
      icon: Sun,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    },
    {
      id: "n-3",
      title: "Grid Substation Feeder Sync",
      desc: "Feeder AHMEDABAD_SUB_ZONE_1 frequency synchronized at 50.02 Hz.",
      time: "Yesterday",
      icon: Zap,
      color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
          <Bell className="h-5 w-5 text-emerald-400" />
          Grid Notifications
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Real-time trade events, cryptographic verification confirmations & grid alerts
        </p>
      </div>

      <div className="space-y-3">
        {NOTIFICATIONS.map((n) => {
          const Icon = n.icon;
          return (
            <div
              key={n.id}
              className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start gap-3.5"
            >
              <div className={`h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 ${n.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-200">{n.title}</h3>
                  <span className="text-[11px] font-mono text-slate-500 shrink-0">{n.time}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{n.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
