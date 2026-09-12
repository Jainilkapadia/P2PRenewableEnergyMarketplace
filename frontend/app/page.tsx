"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Zap,
  ArrowRight,
  ShieldCheck,
  Sliders,
  MapPin,
  Sparkles,
  Lock,
  Layers,
  Award,
  CheckCircle2,
  Sun,
  Activity,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200 bg-grid-pattern">
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800/80 bg-[#080d1a]/80 backdrop-blur sticky top-0 z-30 px-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 glow-emerald">
            <Zap className="h-4 w-4 fill-emerald-400" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-slate-100 flex items-center gap-1.5">
              VoltP2P
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Grid
              </span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Renewable Energy Marketplace</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-xs text-slate-300 hover:text-slate-100 font-medium px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Live Terminal
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 glow-emerald"
          >
            <span>Enter Marketplace</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 py-12 md:py-20 flex flex-col items-center text-center">
        {/* Core Product Story Pill */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-emerald-500/30 text-xs font-mono text-emerald-400 mb-6 shadow-lg shadow-emerald-500/10"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Energy → Trade → Trust → Proof</span>
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-100 max-w-3xl leading-[1.15]"
        >
          Hyper-Local Peer-to-Peer{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300">
            Renewable Energy
          </span>{" "}
          Trading.
        </motion.h1>

        {/* Hero Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 text-base md:text-lg text-slate-400 max-w-2xl leading-relaxed"
        >
          Connect rooftop-solar prosumers directly with local clean-power consumers in Ahmedabad. Powered by PostGIS spatial constraint matching, Ed25519 digital signatures, and verifiable reputation.
        </motion.p>

        {/* Hero CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto"
        >
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-500/25 glow-emerald"
          >
            <span>Launch Live Hackathon Demo</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/map"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <MapPin className="h-4 w-4 text-indigo-400" />
            <span>Explore Ahmedabad Grid Map</span>
          </Link>
        </motion.div>

        {/* Live Marketplace Telemetry Ticker */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-14 w-full grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl text-left"
        >
          <div className="p-2 border-r border-slate-800/80 last:border-0">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Clean Power Traded</span>
            <span className="text-xl font-bold font-mono text-slate-100">1,845.5 kWh</span>
            <span className="text-[10px] text-emerald-400 mt-0.5 block">48 verified deliveries</span>
          </div>

          <div className="p-2 border-r border-slate-800/80 last:border-0">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Mean Peer Tariff</span>
            <span className="text-xl font-bold font-mono text-emerald-400">₹5.80 / kWh</span>
            <span className="text-[10px] text-emerald-400/80 mt-0.5 block">23.7% vs utility rate</span>
          </div>

          <div className="p-2 border-r border-slate-800/80 last:border-0">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Grid Feeder Cluster</span>
            <span className="text-xl font-bold font-mono text-indigo-400 truncate block">AHMEDABAD_SUB_1</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Bodakdev & Navrangpura</span>
          </div>

          <div className="p-2">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Mean Peer Reliability</span>
            <span className="text-xl font-bold font-mono text-slate-100">98.5% Trust</span>
            <span className="text-[10px] text-emerald-400 mt-0.5 block">Cryptographically proved</span>
          </div>
        </motion.div>

        {/* 4 Pillars Section */}
        <div className="mt-16 w-full text-left space-y-4">
          <h2 className="text-xl font-bold text-slate-100 text-center">
            Engineered for Real Physical & Financial Integrity
          </h2>
          <p className="text-xs text-slate-400 text-center max-w-xl mx-auto">
            Not a generic dashboard. A complete decentralized energy matching and verification protocol.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Sliders className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">1. Constraint Matching</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Matches buyers and sellers using real spatial distance, price boundaries, time overlap, and substation feeder alignment.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">2. Transparent Explainability</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Zero AI black-box deception. Every match displays the exact 5-factor mathematical weighting breakdown.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">3. Ed25519 Signatures</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Both buyer and seller cryptographically sign canonical trade hashes. Includes live judge tamper-testing sandbox.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Award className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">4. Verifiable Trust Score</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Bayesian Laplace smoothed reputation calculated strictly from signed receipts, eliminating fake reviews.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-800/80 text-center text-xs text-slate-500 font-mono">
        VoltP2P Renewable Energy Trading Marketplace • HackOut&apos;26 Prototype • Ahmedabad Microgrid Node
      </footer>
    </div>
  );
}
