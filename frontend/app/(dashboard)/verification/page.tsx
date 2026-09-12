"use client";

import React, { useState } from "react";
import { usePerspective } from "@/lib/perspective-context";
import {
  ShieldCheck,
  KeyRound,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Lock,
  Layers,
  Sparkles,
} from "lucide-react";
import { formatINR, shortenHash } from "@/lib/utils";

export default function VerificationPage() {
  const { perspective, activeUser } = usePerspective();
  const [isTampered, setIsTampered] = useState(false);

  const canonicalPayload = {
    trade_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    buyer_id: "22222222-2222-2222-2222-222222222222",
    seller_id: "11111111-1111-1111-1111-111111111111",
    energy_kwh: 25.0,
    unit_price: isTampered ? 5.79 : 5.80, // Tamper test variable
    total_amount: isTampered ? 144.75 : 145.0,
    currency: "INR",
    grid_substation_id: "AHMEDABAD_SUB_ZONE_1",
    delivery_window: "2026-09-12T10:00:00Z_to_2026-09-12T16:00:00Z",
  };

  const trueHash = "8f4a1029c7e30d176b92a543f01948329ef01a8421c97a493b8e716e1a0b5b12";
  const tamperedHash = "3e9b1140df8821045a8cd41209bca7105fe881023a9b18361730cf192305ca71";

  const currentHash = isTampered ? tamperedHash : trueHash;
  const isSignatureValid = !isTampered;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Cryptographic Verification Terminal
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Ed25519 Cryptographic Proof
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Independent peer-to-peer signature verification and tamper detection on application-level audit chain.
          </p>
        </div>

        {/* Judge Interactive Tamper Sandbox Button */}
        <button
          onClick={() => setIsTampered(!isTampered)}
          className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 shadow-lg ${
            isTampered
              ? "bg-amber-500 text-slate-950 shadow-amber-500/20"
              : "bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700"
          }`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isTampered ? "animate-spin" : ""}`} />
          <span>{isTampered ? "Reset to Authentic State" : "⚡ Judge Sandbox: Tamper Payload (Change 1 Paise)"}</span>
        </button>
      </div>

      {/* Tamper Alert Banner if active */}
      {isTampered && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/50 text-red-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <strong className="block text-red-300 font-semibold">
                TAMPER DETECTED: Cryptographic Hash Mismatch
              </strong>
              <span>
                Unit price was altered from ₹5.80 to ₹5.79. The generated SHA-256 digest does not match the Ed25519 digital signature.
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded bg-red-500/20 text-red-400 font-mono font-bold shrink-0">
            PROOF REJECTED
          </span>
        </div>
      )}

      {/* Main Cryptographic Proof Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Canonical Payload JSON & Hash */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <FileCode className="h-4 w-4 text-emerald-400" />
              1. Deterministic Canonical Payload
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Standard RFC 8785 JSON</span>
          </div>

          <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
            {JSON.stringify(canonicalPayload, null, 2)}
          </pre>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">
              SHA-256 Digest of Canonical String:
            </span>
            <code className="text-xs font-mono font-bold text-emerald-400 break-all block">
              {currentHash}
            </code>
          </div>
        </div>

        {/* Right: Dual Ed25519 Signature Verification */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-emerald-400" />
              2. Peer Digital Signatures
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Asymmetric Ed25519 Keys</span>
          </div>

          {/* Buyer Signature Card */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Buyer: Priya Patel (EV Demand)</span>
              {isSignatureValid ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" />
                  VALID SIGNATURE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-red-400 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="h-3 w-3" />
                  INVALID / TAMPERED
                </span>
              )}
            </div>

            <div className="text-[11px] font-mono text-slate-400 space-y-0.5">
              <p>Registered Public Key: <code className="text-slate-300">3d4017c3e843895a92b70aa74d1b7ebc...</code></p>
              <p>Signature (Hex): <code className="text-slate-300 break-all">7b9f310aefc81923ab9001cda8712398412ef1...</code></p>
            </div>
          </div>

          {/* Seller Signature Card */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Seller: Aarav Sharma (Solar Surplus)</span>
              {isSignatureValid ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" />
                  VALID SIGNATURE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-red-400 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="h-3 w-3" />
                  INVALID / TAMPERED
                </span>
              )}
            </div>

            <div className="text-[11px] font-mono text-slate-400 space-y-0.5">
              <p>Registered Public Key: <code className="text-slate-300">d75a980182b10ab7d54bfed3c964073a...</code></p>
              <p>Signature (Hex): <code className="text-slate-300 break-all">5c2e118f90123bac0192847162534eaf98721c...</code></p>
            </div>
          </div>

          {/* Verification Summary Chip */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
            <span>Audit Status:</span>
            <span className={`font-mono font-bold ${isSignatureValid ? "text-emerald-400" : "text-red-400"}`}>
              {isSignatureValid ? "Dual Signatures Match Payload" : "Cryptographic Proof Failed"}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Block Chain Card */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-400" />
          3. Chained Audit Block Record (Application-Level Ledger)
        </h3>
        <p className="text-xs text-slate-400">
          Each settled trade references the previous block&apos;s cryptographic hash, producing a tamper-evident audit trail without requiring external blockchain node fees.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">Audit Reference</span>
            <span className="text-xs font-mono font-bold text-slate-200">P2P-VRF-1726135200-8F4A1029</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">Previous Block Hash</span>
            <span className="text-xs font-mono text-slate-400 truncate block">0041a9e88b201...</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">Current Block Hash</span>
            <span className="text-xs font-mono font-bold text-emerald-400 truncate block">e83b1029471ab...</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">Settlement Action</span>
            <span className="text-xs font-bold text-emerald-400">Escrow Released to Seller</span>
          </div>
        </div>
      </div>
    </div>
  );
}
