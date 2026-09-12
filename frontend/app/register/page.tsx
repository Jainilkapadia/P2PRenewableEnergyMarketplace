"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import {
  Zap,
  Lock,
  Mail,
  User,
  MapPin,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Sun,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS = [
  {
    id: "consumer",
    title: "Consumer",
    subtitle: "Buy renewable energy from local prosumers",
    icon: Zap,
    color: "emerald",
  },
  {
    id: "prosumer",
    title: "Prosumer",
    subtitle: "Sell rooftop solar & battery surplus energy",
    icon: Sun,
    color: "amber",
  },
  {
    id: "dual",
    title: "Dual Trader",
    subtitle: "Buy and sell renewable energy on the microgrid",
    icon: Layers,
    color: "indigo",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("consumer");
  const [address, setAddress] = useState("Vastrapur, Ahmedabad, Gujarat");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await register({
        full_name: fullName,
        email,
        password,
        role,
        address_text: address,
        latitude: 23.0350,
        longitude: 72.5280,
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed. Email may already be in use.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-3 group">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 glow-emerald transition-transform group-hover:scale-105">
            <Zap className="h-5 w-5 fill-emerald-400" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
            VoltP2P
            <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Registration
            </span>
          </span>
        </Link>
        <h2 className="text-xl font-bold tracking-tight text-slate-200">
          Join the Ahmedabad P2P Energy Grid
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Create your decentralized clean energy node profile
        </p>
      </div>

      {/* Register Form Card */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg relative z-10 px-4">
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
                Full Name / Organization
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ananya Desai"
                  className="w-full pl-10 pr-3.5 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address
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
                  placeholder="e.g. ananya@greenenergy.in"
                  className="w-full pl-10 pr-3.5 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 font-mono transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-10 pr-3.5 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 font-mono transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Ahmedabad Grid Address / Neighborhood
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <MapPin className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Vastrapur, Ahmedabad, GJ"
                  className="w-full pl-10 pr-3.5 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                />
              </div>
            </div>

            {/* Role Selection Cards */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Select Your Grid Participation Role
              </label>
              <div className="space-y-2">
                {ROLE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = role === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setRole(opt.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        isSelected
                          ? "bg-slate-800/90 border-emerald-500/60 ring-1 ring-emerald-500/30"
                          : "bg-slate-950/50 border-slate-800 hover:border-slate-700"
                      )}
                    >
                      <div
                        className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                          isSelected
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-slate-800 text-slate-400"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-100">
                            {opt.title}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {opt.subtitle}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">
                * Admin permissions are restricted and provisioned by the grid authority.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-emerald-500/20 glow-emerald mt-4"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Registering Node...</span>
                </>
              ) : (
                <>
                  <span>Create Account & Join Grid</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors inline-flex items-center gap-1"
              >
                Sign In <ArrowRight className="h-3 w-3" />
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      <div className="mt-8 text-center text-[11px] text-slate-500 font-mono flex items-center justify-center gap-2">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
        <span>Self-Sovereign Identity + Automatic Wallet Provisioning</span>
      </div>
    </div>
  );
}
