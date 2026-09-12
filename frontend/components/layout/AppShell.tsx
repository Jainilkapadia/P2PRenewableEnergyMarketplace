"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { useAuth } from "@/lib/auth-context";
import { ShieldAlert, ArrowLeft, LogIn } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isAdminRoute = pathname.startsWith("/admin");
  const isForbiddenAdmin = isAdminRoute && role !== "admin";

  return (
    <div className="flex min-h-screen bg-[#080d1a] text-slate-100">
      {/* Sidebar for Desktop */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Topbar />
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {isForbiddenAdmin ? (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
              <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-500/10">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-100 mb-2">
                Restricted Grid Authority Area
              </h2>
              <p className="text-sm text-slate-400 max-w-md mb-6">
                The <span className="font-mono text-purple-400 font-semibold">{pathname}</span> route is restricted to authorized Discom Grid Administrators. Your current authenticated role is <span className="font-mono text-emerald-400 font-semibold uppercase">{role}</span>.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Return to My Dashboard</span>
                </button>
                <button
                  onClick={() => router.push("/login")}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-semibold transition-all"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Log In as Grid Admin</span>
                </button>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}
