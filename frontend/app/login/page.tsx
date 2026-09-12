"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth, UserRole } from "@/lib/auth-context";
import {
  Zap,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
  Sun,
  Layers,
  ShieldAlert,
} from "lucide-react";

const DEMO_ACCOUNTS: Record<string, { email: string; pass: string }> = {
  consumer: { email: "priya.consumer@eco.io", pass: "password123" },
  prosumer: { email: "aarav.prosumer@solar.io", pass: "password123" },
  dual: { email: "rohan.dual@greenenergy.in", pass: "password123" },
  admin: { email: "admin@p2penergy.gov.in", pass: "password123" },
};

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const role = await login(email, password);
      if (role === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Invalid email or password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemo = async (roleKey: string) => {
    const creds = DEMO_ACCOUNTS[roleKey];
    if (!creds) return;
    setEmail(creds.email);
    setPassword(creds.pass);
    setError(null);
    setIsSubmitting(true);
    try {
      const role = await login(creds.email, creds.pass);
      if (role === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign in with demo account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header / Brand */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-3 group">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 glow-emerald transition-transform group-hover:scale-105">
            <Zap className="h-5 w-5 fill-emerald-400" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
            VoltP2P
            <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Auth
            </span>
          </span>
        </Link>
        <h2 className="text-xl font-bold tracking-tight text-slate-200">
          Sign in to your Grid Terminal
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Decentralized P2P renewable energy exchange & settlement
        </p>
      </div>

      {/* Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-2xl"
        >
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Grid Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. priya.consumer@eco.io"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 font-mono transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Password
                </label>
                <span className="text-[11px] text-slate-500">Seed: password123</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 font-mono transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-emerald-500/20 glow-emerald mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Terminal</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="mt-6 pt-6 border-t border-slate-800/80">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              Quick One-Click Demo Logins
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo("consumer")}
                disabled={isSubmitting}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/40 text-left transition-all group"
              >
                <div className="h-6 w-6 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-105 shrink-0">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-200 truncate">Consumer</p>
                  <p className="text-[10px] text-slate-400 truncate">Priya (EV)</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("prosumer")}
                disabled={isSubmitting}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/40 text-left transition-all group"
              >
                <div className="h-6 w-6 rounded bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-105 shrink-0">
                  <Sun className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-200 truncate">Prosumer</p>
                  <p className="text-[10px] text-slate-400 truncate">Aarav (Solar)</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("dual")}
                disabled={isSubmitting}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/40 text-left transition-all group"
              >
                <div className="h-6 w-6 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-105 shrink-0">
                  <Layers className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-200 truncate">Dual Trader</p>
                  <p className="text-[10px] text-slate-400 truncate">Rohan (Buy/Sell)</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("admin")}
                disabled={isSubmitting}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-purple-500/40 text-left transition-all group"
              >
                <div className="h-6 w-6 rounded bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-105 shrink-0">
                  <ShieldAlert className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-200 truncate">Grid Admin</p>
                  <p className="text-[10px] text-slate-400 truncate">Torrent NOC</p>
                </div>
              </button>
            </div>
          </div>

          {/* Registration Link */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              New node in Ahmedabad grid?{" "}
              <Link
                href="/register"
                className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors inline-flex items-center gap-1"
              >
                Register Node <ArrowRight className="h-3 w-3" />
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Security note footer */}
      <div className="mt-8 text-center text-[11px] text-slate-500 font-mono flex items-center justify-center gap-2">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
        <span>JWT Bearer + Ed25519 Cryptographic Verification Active</span>
      </div>
    </div>
  );
}
