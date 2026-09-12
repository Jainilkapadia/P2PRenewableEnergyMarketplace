"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Users, ShieldCheck, CheckCircle2, MapPin, ArrowLeft, RefreshCw } from "lucide-react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin"
            className="text-xs text-purple-400 hover:text-purple-300 font-semibold inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Admin Terminal
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-400" />
            Grid Node Registry Directory
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            All registered prosumer, consumer, and dual energy nodes in the Ahmedabad jurisdiction
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:border-slate-700"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="pb-3 font-medium">Node ID</th>
                <th className="pb-3 font-medium">Name & Organization</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">Substation Feeder</th>
                <th className="pb-3 font-medium">Crypto Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 font-mono text-[11px] text-slate-500">
                    {u.id.slice(0, 8)}...
                  </td>
                  <td className="py-3 font-semibold text-slate-200">
                    {u.full_name}
                  </td>
                  <td className="py-3 font-mono text-[11px] text-slate-400">
                    {u.email}
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                        u.role === "admin"
                          ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          : u.role === "prosumer"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : u.role === "dual"
                          ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-[11px] text-slate-300">
                    {u.grid_substation_id || "AHMEDABAD_SUB_ZONE_1"}
                  </td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Ed25519 Verified
                    </span>
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
