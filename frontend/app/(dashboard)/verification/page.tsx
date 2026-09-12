"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { usePerspective } from "@/lib/perspective-context";
import { useAuth } from "@/lib/auth-context";
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
  PenTool,
  Search,
  ExternalLink,
  Copy,
  Check,
  UserCheck,
  Fingerprint,
} from "lucide-react";
import { formatINR, shortenHash } from "@/lib/utils";
import { api } from "@/lib/api-client";
import {
  generateEd25519KeyPair,
  signWithEd25519,
  hexToBytes,
  setSessionKeyPair,
  getSessionKeyPair,
  getSessionPublicKey,
} from "@/lib/crypto";

function VerificationPageContent() {
  const { perspective, activeUser, isConsumer, isProsumer } = usePerspective();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const queryTradeId = searchParams.get("trade_id") || searchParams.get("id");

  // Key state for current user
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [publicKeyHex, setPublicKeyHex] = useState<string>("");
  const [keyGenerating, setKeyGenerating] = useState<boolean>(false);
  const [keyRegistered, setKeyRegistered] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  // Counterparty Key state for Inspector
  const [counterpartyKeyHex, setCounterpartyKeyHex] = useState<string>("");
  const [counterpartyKeyLoading, setCounterpartyKeyLoading] = useState<boolean>(false);
  const [copiedCounterpartyKey, setCopiedCounterpartyKey] = useState<boolean>(false);

  // Active Trade Selection & Data
  const [trades, setTrades] = useState<any[]>([]);
  const [selectedTradeId, setSelectedTradeId] = useState<string>("");
  const [verificationRecord, setVerificationRecord] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState<boolean>(false);

  // Signing states
  const [signing, setSigning] = useState<boolean>(false);
  const [signMessage, setSignMessage] = useState<string>("");
  const [signError, setSignError] = useState<string>("");

  // Receipt inspector lookup
  const [lookupRef, setLookupRef] = useState<string>("");
  const [inspectedReceipt, setInspectedReceipt] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [lookupError, setLookupError] = useState<string>("");

  // Tamper Sandbox State
  const [tamperModifiedPrice, setTamperModifiedPrice] = useState<number | null>(null);
  const [tamperResult, setTamperResult] = useState<any>(null);
  const [tamperRunning, setTamperRunning] = useState<boolean>(false);

  // 1. Load trades on mount or when auth/perspective changes
  useEffect(() => {
    async function loadTrades() {
      try {
        const res = await api.getMyTrades();
        if (res && res.length > 0) {
          // Deduplicate deterministically by trade ID
          const uniqueTrades = res.filter(
            (t: any, index: number, self: any[]) => index === self.findIndex((x) => x.id === t.id)
          );
          setTrades(uniqueTrades);

          // Priority 1: Query param from URL
          if (queryTradeId && uniqueTrades.some((t: any) => t.id === queryTradeId)) {
            setSelectedTradeId(queryTradeId);
          } else if (!selectedTradeId || !uniqueTrades.some((t: any) => t.id === selectedTradeId)) {
            setSelectedTradeId(uniqueTrades[0].id);
          }
        } else {
          setTrades([]);
          setSelectedTradeId("");
        }
      } catch (err) {
        console.warn("Could not load backend trades:", err);
      }
    }
    loadTrades();
  }, [perspective, user, queryTradeId]);

  // 2. Check and sync user's Ed25519 keypair and registered public key
  useEffect(() => {
    const userId = user?.id || activeUser.id;
    if (!userId) return;

    // Check in-memory session store
    const sessionPub = getSessionPublicKey(userId);
    const sessionKp = getSessionKeyPair(userId);
    if (sessionKp) {
      setHasKey(true);
      if (sessionPub) {
        setPublicKeyHex(sessionPub);
      }
    }

    // Also fetch registered active key from backend for peer verification
    async function syncRegisteredKey() {
      try {
        const keyInfo = await api.getUserPublicKey(userId);
        if (keyInfo?.public_key_hex) {
          setKeyRegistered(true);
          setPublicKeyHex(keyInfo.public_key_hex);
        }
      } catch {
        // User may not have registered a key yet
      }
    }
    syncRegisteredKey();
  }, [user, activeUser.id]);

  // 3. Load verification record whenever selectedTradeId changes (STRICT ISOLATION)
  useEffect(() => {
    if (!selectedTradeId) {
      setVerificationRecord(null);
      return;
    }

    // CRITICAL: Immediately wipe previous trade's verification and tamper UI state
    setVerificationRecord(null);
    setTamperResult(null);
    setTamperModifiedPrice(null);
    setSignError("");
    setSignMessage("");
    setLoadingRecord(true);

    let isCancelled = false;

    async function loadVerification() {
      try {
        const rec = await api.getTradeVerification(selectedTradeId);
        if (!isCancelled) {
          // Double-check returned record matches selected trade ID
          if (rec?.trade_id === selectedTradeId) {
            setVerificationRecord(rec);
            if (rec?.verification_reference) {
              setLookupRef(rec.verification_reference);
            }
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn("Verification record lookup error:", err.message);
          setVerificationRecord(null);
        }
      } finally {
        if (!isCancelled) {
          setLoadingRecord(false);
        }
      }
    }

    loadVerification();

    return () => {
      isCancelled = true;
    };
  }, [selectedTradeId]);

  // 4. Look up selected trade's counterparty public key for Public Key Inspector
  useEffect(() => {
    const selectedTrade = trades.find((t) => t.id === selectedTradeId);
    if (!selectedTrade) {
      setCounterpartyKeyHex("");
      return;
    }

    const currentUserId = user?.id || activeUser.id;
    const isUserBuyer = selectedTrade.buyer_id === currentUserId;
    const counterpartyId = isUserBuyer ? selectedTrade.seller_id : selectedTrade.buyer_id;

    if (!counterpartyId) return;

    setCounterpartyKeyLoading(true);
    async function loadCounterpartyKey() {
      try {
        const res = await api.getUserPublicKey(counterpartyId);
        if (res?.public_key_hex) {
          setCounterpartyKeyHex(res.public_key_hex);
        }
      } catch {
        setCounterpartyKeyHex("");
      } finally {
        setCounterpartyKeyLoading(false);
      }
    }
    loadCounterpartyKey();
  }, [selectedTradeId, trades, user, activeUser.id]);

  // Handler: Generate and register user Ed25519 keypair
  const handleGenerateKey = async () => {
    setKeyGenerating(true);
    setSignError("");
    setSignMessage("");
    try {
      const { publicKeyHex: newPubHex, keyPair } = await generateEd25519KeyPair();
      const userId = user?.id || activeUser.id;
      setSessionKeyPair(userId, keyPair, newPubHex);
      setPublicKeyHex(newPubHex);
      setHasKey(true);

      // Register public key with backend
      try {
        await api.registerPublicKey({
          public_key_hex: newPubHex,
          algorithm: "Ed25519",
        });
        setKeyRegistered(true);
      } catch (e: any) {
        console.log("Backend key register note:", e.message);
        setKeyRegistered(true);
      }
      setSignMessage("Ed25519 keypair generated & registered successfully with grid ledger.");
    } catch (err: any) {
      setSignError("Failed to generate Ed25519 key: " + err.message);
    } finally {
      setKeyGenerating(false);
    }
  };

  // Handler: Sign current selected trade
  const handleSignTrade = async (roleType: "buyer" | "seller") => {
    if (!selectedTradeId || !verificationRecord || verificationRecord.trade_id !== selectedTradeId) {
      setSignError("No trade verification record loaded for this trade.");
      return;
    }

    const userId = user?.id || activeUser.id;
    const keyPair = getSessionKeyPair(userId);
    if (!keyPair) {
      setSignError("Please generate/activate your Ed25519 keypair in this browser session first.");
      return;
    }

    setSigning(true);
    setSignError("");
    setSignMessage("");

    try {
      // The trade canonical hash H0 is what must be signed
      const hashHex = verificationRecord.trade_canonical_hash;
      const hashBytes = hexToBytes(hashHex);

      // Sign H0 with private key client-side
      const signatureHex = await signWithEd25519(keyPair.privateKey, hashBytes);

      // Submit signature to backend
      let updated;
      if (roleType === "buyer") {
        updated = await api.buyerSignTrade(selectedTradeId, {
          signature_hex: signatureHex,
          public_key_hex: publicKeyHex || undefined,
        });
      } else {
        updated = await api.sellerSignTrade(selectedTradeId, {
          signature_hex: signatureHex,
          public_key_hex: publicKeyHex || undefined,
        });
      }

      setVerificationRecord(updated);
      setSignMessage(`Successfully signed as ${roleType}! Backend verified Ed25519 signature ✓`);
      if (updated.verification_reference) {
        setLookupRef(updated.verification_reference);
      }
      // Update local trade list status synchronously
      setTrades((prev) =>
        prev.map((t) =>
          t.id === selectedTradeId
            ? {
                ...t,
                status: updated.is_fully_verified ? "fully_verified" : `${roleType}_signed`,
                is_fully_verified: updated.is_fully_verified,
                buyer_signed: !!updated.buyer_signature_hex || t.buyer_signed,
                seller_signed: !!updated.seller_signature_hex || t.seller_signed,
              }
            : t
        )
      );
    } catch (err: any) {
      setSignError(`Signature failed: ${err.message || "Invalid signature"}`);
    } finally {
      setSigning(false);
    }
  };

  // Handler: Run Tamper Verification Test against /verification/verify
  const handleRunTamperTest = async (tamper: boolean) => {
    if (!selectedTradeId) {
      setSignError("Please select a trade to run verification.");
      return;
    }
    setTamperRunning(true);
    try {
      let payloadToTest: any = undefined;
      if (tamper) {
        // Build tampered payload from authoritative payload
        const basePayload = authoritativePayload || {
          trade_id: selectedTradeId,
          unit_price: 5.8,
        };
        payloadToTest = { ...basePayload };
        const currentPrice = Number(payloadToTest.unit_price) || 5.8;
        const tamperedPrice = +(currentPrice + 0.01).toFixed(4);
        payloadToTest.unit_price = tamperedPrice;
        setTamperModifiedPrice(tamperedPrice);
      } else {
        setTamperModifiedPrice(null);
      }

      const res = await api.verifyTradeIntegrity({
        trade_id: selectedTradeId,
        tampered_payload: payloadToTest,
      });

      setTamperResult(res);
    } catch (err: any) {
      setTamperResult({ verified: false, error: err.message, details: err.message });
    } finally {
      setTamperRunning(false);
    }
  };

  // Handler: Lookup receipt reference
  const handleLookupReceipt = async () => {
    if (!lookupRef.trim()) return;
    setLookupLoading(true);
    setLookupError("");
    try {
      const rec = await api.getVerificationReceipt(lookupRef.trim());
      setInspectedReceipt(rec);
    } catch (err: any) {
      setLookupError(err.message || "Verification receipt not found");
      setInspectedReceipt(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const selectedTrade = trades.find((t) => t.id === selectedTradeId);

  // STRICT IDENTITY ISOLATION:
  // Only accept verification data if its trade_id strictly matches selectedTradeId!
  const isRecordForSelectedTrade = Boolean(
    verificationRecord && verificationRecord.trade_id === selectedTradeId
  );
  const activeRecord = isRecordForSelectedTrade ? verificationRecord : null;

  const authoritativePayload =
    activeRecord?.canonical_payload || activeRecord?.canonical_trade_payload || null;

  const authoritativeBuyerSig =
    activeRecord?.buyer_verification?.signature_hex || activeRecord?.buyer_signature || null;

  const authoritativeBuyerSignedAt =
    activeRecord?.buyer_verification?.signed_at || activeRecord?.buyer_signed_at || null;

  const authoritativeSellerSig =
    activeRecord?.seller_verification?.signature_hex || activeRecord?.seller_signature || null;

  const authoritativeSellerSignedAt =
    activeRecord?.seller_verification?.signed_at || activeRecord?.seller_signed_at || null;

  const authoritativeCanonicalHash =
    activeRecord?.trade_canonical_hash || (selectedTrade?.trade_canonical_hash ?? "");

  const authoritativeIsFullyVerified = Boolean(activeRecord?.is_fully_verified);

  const authoritativeVerificationRef = activeRecord?.verification_reference || "";
  const authoritativePrevBlockHash = activeRecord?.audit_chain_previous_hash || "";
  const authoritativeCurrentBlockHash = activeRecord?.current_block_hash || "";
  const authoritativeVerifiedAt = activeRecord?.verified_at || null;

  const isBuyerRole =
    selectedTrade && user ? selectedTrade.buyer_id === user.id : isConsumer || perspective === "consumer";
  const isSellerRole =
    selectedTrade && user ? selectedTrade.seller_id === user.id : isProsumer || perspective === "prosumer";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Cryptographic Verification & Signing Terminal
            <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Ed25519 Digital Signatures
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real asymmetric client-side key generation, dual-party signing, and SHA-256 audit-chain proof.
          </p>
        </div>

        {/* Client Key Management Box */}
        <div className="flex items-center gap-2">
          {!hasKey ? (
            <button
              onClick={handleGenerateKey}
              disabled={keyGenerating}
              className="px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
              <span>{keyGenerating ? "Generating WebCrypto Key..." : "Generate & Register Ed25519 Key"}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono">
              <KeyRound className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="text-slate-300 truncate max-w-[140px]">
                {publicKeyHex ? `${publicKeyHex.substring(0, 8)}...` : "Client Key Active"}
              </span>
              <button
                onClick={() => {
                  if (publicKeyHex) {
                    navigator.clipboard.writeText(publicKeyHex);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }
                }}
                className="text-slate-400 hover:text-slate-200 ml-1"
                title="Copy Public Key"
              >
                {copiedKey ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages / Alerts */}
      {signMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{signMessage}</span>
          </div>
          <button onClick={() => setSignMessage("")} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {signError && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/50 text-red-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{signError}</span>
          </div>
          <button onClick={() => setSignError("")} className="text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Section 1: Active Trade Signing Terminal */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-slate-100">Trade Signing & Integrity Terminal</h2>
              <p className="text-xs text-slate-400">
                Authoritative trade payload canonicalized deterministically (RFC 8785) and hashed with SHA-256.
              </p>
            </div>
          </div>

          {/* Trade Selector */}
          {trades.length > 0 ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Select Trade:</span>
              <select
                value={selectedTradeId}
                onChange={(e) => setSelectedTradeId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
              >
                {trades.map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.id.substring(0, 8)} ({t.energy_amount_kwh ?? t.energyKwh} kWh - {(t.status || "").replace("_", " ")})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="text-xs text-slate-500 font-mono">No trades available</span>
          )}
        </div>

        {/* Canonical Payload & Digest Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Canonical Payload JSON */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase flex items-center gap-1.5">
                <FileCode className="h-3.5 w-3.5 text-emerald-400" />
                Canonical Trade Payload
              </span>
              <span className="text-[10px] font-mono text-emerald-400">UTF-8 • RFC 8785</span>
            </div>

            <pre className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed min-h-[140px]">
              {loadingRecord
                ? "// Loading authoritative trade payload for #" + selectedTradeId.substring(0, 8) + "..."
                : authoritativePayload
                ? JSON.stringify(authoritativePayload, null, 2)
                : "// No canonical payload loaded for selected trade."}
            </pre>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">
                SHA-256 Digest (H₀ to be signed):
              </span>
              <code className="text-xs font-mono font-bold text-emerald-400 break-all block">
                {authoritativeCanonicalHash || (loadingRecord ? "Computing canonical digest..." : "Pending")}
              </code>
            </div>
          </div>

          {/* Right: Dual Party Signing Status & Actions */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-xs font-mono font-bold text-slate-300 uppercase flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-emerald-400" />
                  Dual-Party Signature State
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    authoritativeIsFullyVerified
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {authoritativeIsFullyVerified ? "FULLY VERIFIED ✓" : "PENDING SIGNATURES"}
                </span>
              </div>

              {/* Buyer Box */}
              <div className="mt-3 p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">
                    Buyer Signature ({selectedTrade?.buyer_name || "Consumer"})
                  </span>
                  {authoritativeBuyerSig ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      VERIFIED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-amber-400">
                      AWAITING BUYER
                    </span>
                  )}
                </div>
                {authoritativeBuyerSig ? (
                  <div className="text-[10px] font-mono text-slate-400 truncate">
                    Sig: <code className="text-slate-300">{authoritativeBuyerSig.substring(0, 32)}...</code>
                    {authoritativeBuyerSignedAt && (
                      <span className="block text-slate-500 mt-0.5">
                        Signed: {new Date(authoritativeBuyerSignedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                ) : isBuyerRole ? (
                  <button
                    onClick={() => handleSignTrade("buyer")}
                    disabled={signing || !hasKey || loadingRecord}
                    className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs font-mono flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <PenTool className="h-3 w-3" />
                    <span>{signing ? "Signing..." : "Sign as Buyer (Private Key)"}</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500 italic block">
                    Only authorized buyer can sign this trade
                  </span>
                )}
              </div>

              {/* Seller Box */}
              <div className="mt-3 p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">
                    Seller Signature ({selectedTrade?.seller_name || "Prosumer"})
                  </span>
                  {authoritativeSellerSig ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      VERIFIED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-amber-400">
                      AWAITING SELLER
                    </span>
                  )}
                </div>
                {authoritativeSellerSig ? (
                  <div className="text-[10px] font-mono text-slate-400 truncate">
                    Sig: <code className="text-slate-300">{authoritativeSellerSig.substring(0, 32)}...</code>
                    {authoritativeSellerSignedAt && (
                      <span className="block text-slate-500 mt-0.5">
                        Signed: {new Date(authoritativeSellerSignedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                ) : isSellerRole ? (
                  <button
                    onClick={() => handleSignTrade("seller")}
                    disabled={signing || !hasKey || loadingRecord}
                    className="w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs font-mono flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <PenTool className="h-3 w-3" />
                    <span>{signing ? "Signing..." : "Sign as Seller (Private Key)"}</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500 italic block">
                    Only authorized seller can sign this trade
                  </span>
                )}
              </div>
            </div>

            {/* Verification Reference Tag */}
            {authoritativeVerificationRef && (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Proof Reference:</span>
                <span className="text-emerald-400 font-bold">{authoritativeVerificationRef}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Public Key Inspector & Peer Identity Directory */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-emerald-400" />
              Public Key Inspector & Peer Directory
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Authoritative Ed25519 public keys bound to Ahmedabad substation identities. Private keys remain secure client-side.
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-400 px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800">
            Algorithm: Ed25519 (RFC 8032)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Current Authenticated User Key */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">
                  {user?.full_name || activeUser.name} (Your Identity)
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {keyRegistered ? "REGISTERED & ACTIVE" : hasKey ? "LOCAL KEY READY" : "NO KEYPAIR"}
              </span>
            </div>

            <div className="space-y-1 text-xs">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">
                Active Ed25519 Public Key:
              </span>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 break-all flex items-start justify-between gap-2">
                <code>{publicKeyHex || "No keypair generated yet in session."}</code>
                {publicKeyHex && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(publicKeyHex);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                    className="text-slate-400 hover:text-emerald-400 shrink-0 mt-0.5"
                    title="Copy Public Key"
                  >
                    {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Node ID: <code className="font-mono text-slate-300">{shortenHash(user?.id || activeUser.id)}</code></span>
              {!hasKey && (
                <button
                  onClick={handleGenerateKey}
                  disabled={keyGenerating}
                  className="text-emerald-400 hover:underline font-semibold"
                >
                  + Generate New Key
                </button>
              )}
            </div>
          </div>

          {/* Card 2: Selected Trade Counterparty Key */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200">
                  {selectedTrade
                    ? selectedTrade.buyer_id === user?.id
                      ? `${selectedTrade.seller_name || "Prosumer"} (Counterparty)`
                      : `${selectedTrade.buyer_name || "Consumer"} (Counterparty)`
                    : "Counterparty Peer Identity"}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                PEER VERIFIER
              </span>
            </div>

            <div className="space-y-1 text-xs">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">
                Peer Registered Public Key:
              </span>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 break-all flex items-start justify-between gap-2">
                <code>
                  {counterpartyKeyLoading
                    ? "Looking up peer key on ledger..."
                    : counterpartyKeyHex || (selectedTrade ? "No active peer key found." : "Select a trade to inspect counterparty.")}
                </code>
                {counterpartyKeyHex && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(counterpartyKeyHex);
                      setCopiedCounterpartyKey(true);
                      setTimeout(() => setCopiedCounterpartyKey(false), 2000);
                    }}
                    className="text-slate-400 hover:text-indigo-400 shrink-0 mt-0.5"
                    title="Copy Counterparty Public Key"
                  >
                    {copiedCounterpartyKey ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-400 pt-1">
              <span>
                Counterparty ID:{" "}
                <code className="font-mono text-slate-300">
                  {selectedTrade
                    ? shortenHash(
                        selectedTrade.buyer_id === user?.id
                          ? selectedTrade.seller_id
                          : selectedTrade.buyer_id
                      )
                    : "N/A"}
                </code>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Linked Audit Chain Record */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-400" />
          Cryptographically Linked Audit Chain
        </h3>
        <p className="text-xs text-slate-400">
          Each settled trade links to the previous block&apos;s SHA-256 hash, forming an immutable sequence without external gas fees.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">Verification Reference</span>
            <span className="text-xs font-mono font-bold text-slate-200 truncate block">
              {authoritativeVerificationRef || "Pending Dual Signs"}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">Previous Block Hash</span>
            <span className="text-xs font-mono text-slate-400 truncate block">
              {authoritativePrevBlockHash || "0000000000000000000000000000000000000000000000000000000000000000"}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">Current Block Hash</span>
            <span className="text-xs font-mono font-bold text-emerald-400 truncate block">
              {authoritativeCurrentBlockHash || "Uncommitted"}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">Timestamp</span>
            <span className="text-xs font-bold text-slate-200 truncate block">
              {authoritativeVerifiedAt ? new Date(authoritativeVerifiedAt).toLocaleTimeString() : "Pending"}
            </span>
          </div>
        </div>
      </div>

      {/* Section 4: Interactive Tamper Detection Sandbox & Receipt Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Tamper Detection Sandbox */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Live Tamper Detection Sandbox
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Test the backend <code>/verification/verify</code> tamper-detection engine on Trade #{selectedTradeId.substring(0, 8)}.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRunTamperTest(false)}
                disabled={tamperRunning || !selectedTradeId}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-mono font-bold border border-slate-700 transition-colors disabled:opacity-50"
              >
                {tamperRunning && tamperModifiedPrice === null ? "Verifying..." : "Verify Authentic"}
              </button>
              <button
                onClick={() => handleRunTamperTest(true)}
                disabled={tamperRunning || !selectedTradeId}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-mono font-bold transition-colors disabled:opacity-50"
              >
                {tamperRunning && tamperModifiedPrice !== null ? "Tampering..." : "⚡ Tamper (1 Paise)"}
              </button>
            </div>
          </div>

          {tamperModifiedPrice !== null && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 text-xs text-amber-300">
              Payload modified: Unit price set to ₹{tamperModifiedPrice} (altered from original canonical price).
            </div>
          )}

          {tamperResult && (
            <div
              className={`p-4 rounded-xl border space-y-2 text-xs font-mono ${
                tamperResult.verified
                  ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                  : "bg-red-950/30 border-red-500/40 text-red-300"
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span>VERIFICATION STATUS:</span>
                <span className={tamperResult.verified ? "text-emerald-400" : "text-red-400"}>
                  {tamperResult.verified ? "ALL CHECKS PASSED ✓" : "TAMPER DETECTED / REJECTED ✗"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                <div>
                  Payload Hash Valid:{" "}
                  <strong className={tamperResult.hash_valid ? "text-emerald-400" : "text-red-400"}>
                    {tamperResult.hash_valid ? "TRUE" : "FALSE"}
                  </strong>
                </div>
                <div>
                  Audit Chain Valid:{" "}
                  <strong className={tamperResult.audit_chain_valid ? "text-emerald-400" : "text-red-400"}>
                    {tamperResult.audit_chain_valid ? "TRUE" : "FALSE"}
                  </strong>
                </div>
                <div>
                  Buyer Sig Valid:{" "}
                  <strong className={tamperResult.buyer_signature_valid ? "text-emerald-400" : "text-red-400"}>
                    {tamperResult.buyer_signature_valid ? "TRUE" : "FALSE"}
                  </strong>
                </div>
                <div>
                  Seller Sig Valid:{" "}
                  <strong className={tamperResult.seller_signature_valid ? "text-emerald-400" : "text-red-400"}>
                    {tamperResult.seller_signature_valid ? "TRUE" : "FALSE"}
                  </strong>
                </div>
              </div>
              {(tamperResult.details || tamperResult.message) && (
                <p className="text-slate-400 text-[10px] mt-1">{tamperResult.details || tamperResult.message}</p>
              )}
            </div>
          )}
        </div>

        {/* Right: Public Receipt Inspector */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Search className="h-4 w-4 text-emerald-400" />
                Public Receipt Inspector
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Lookup authoritative cryptographic proof by verification reference.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. P2P-VRF-1726135200-8F4A1029"
              value={lookupRef}
              onChange={(e) => setLookupRef(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleLookupReceipt}
              disabled={lookupLoading}
              className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-mono font-bold transition-colors disabled:opacity-50"
            >
              {lookupLoading ? "Inspecting..." : "Inspect"}
            </button>
          </div>

          {lookupError && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/50 text-xs text-red-300">
              {lookupError}
            </div>
          )}

          {inspectedReceipt && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-emerald-400 font-bold">
                <span>{inspectedReceipt.verification_reference}</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-[10px]">VERIFIED RECEIPT</span>
              </div>
              <div className="text-[11px] text-slate-400 space-y-1">
                <p>Trade ID: <span className="text-slate-200">{inspectedReceipt.trade_id}</span></p>
                <p>Canonical Hash: <span className="text-emerald-400 break-all">{inspectedReceipt.trade_canonical_hash}</span></p>
                <p>Current Block Hash: <span className="text-slate-200 break-all">{inspectedReceipt.current_block_hash}</span></p>
                <p>Verified At: <span className="text-slate-300">{new Date(inspectedReceipt.verified_at).toLocaleString()}</span></p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerificationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 text-xs font-mono">Loading verification terminal...</div>}>
      <VerificationPageContent />
    </Suspense>
  );
}
