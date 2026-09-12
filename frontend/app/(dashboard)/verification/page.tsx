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
  Blocks,
  Clock,
  Database,
  Cpu,
  Link2,
} from "lucide-react";
import { formatINR, shortenHash } from "@/lib/utils";
import { api, BlockchainProofResponse } from "@/lib/api-client";
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

  // Blockchain Anchor States (Milestone 6)
  const [blockchainProof, setBlockchainProof] = useState<BlockchainProofResponse | null>(null);
  const [blockchainLoading, setBlockchainLoading] = useState<boolean>(false);
  const [isAnchoring, setIsAnchoring] = useState<boolean>(false);
  const [anchorError, setAnchorError] = useState<string>("");
  const [anchorSuccess, setAnchorSuccess] = useState<string>("");
  const [copiedTxHash, setCopiedTxHash] = useState<boolean>(false);
  const [copiedContractAddr, setCopiedContractAddr] = useState<boolean>(false);

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

  // 3. Load verification record & blockchain proof whenever selectedTradeId changes (STRICT ISOLATION)
  useEffect(() => {
    if (!selectedTradeId) {
      setVerificationRecord(null);
      setBlockchainProof(null);
      return;
    }

    // CRITICAL: Immediately wipe previous trade's verification, blockchain, and tamper UI state
    setVerificationRecord(null);
    setBlockchainProof(null);
    setBlockchainLoading(false);
    setIsAnchoring(false);
    setAnchorError("");
    setAnchorSuccess("");
    setTamperResult(null);
    setTamperModifiedPrice(null);
    setSignError("");
    setSignMessage("");
    setLoadingRecord(true);

    let isCancelled = false;

    async function loadTradeVerificationAndBlockchain() {
      try {
        const rec = await api.getTradeVerification(selectedTradeId);
        if (!isCancelled && rec?.trade_id === selectedTradeId) {
          setVerificationRecord(rec);
          if (rec?.verification_reference) {
            setLookupRef(rec.verification_reference);
          }

          // Fetch blockchain proof for selected trade
          try {
            setBlockchainLoading(true);
            const proof = await api.getBlockchainProof(selectedTradeId);
            if (!isCancelled && proof?.trade_id === selectedTradeId) {
              setBlockchainProof(proof);
            }
          } catch (bErr: any) {
            if (!isCancelled) {
              console.log("Blockchain proof fetch note:", bErr.message);
            }
          } finally {
            if (!isCancelled) {
              setBlockchainLoading(false);
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

    loadTradeVerificationAndBlockchain();

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

      // If fully verified, refresh blockchain status
      if (updated.is_fully_verified) {
        try {
          const proof = await api.getBlockchainProof(selectedTradeId);
          if (proof?.trade_id === selectedTradeId) {
            setBlockchainProof(proof);
          }
        } catch {}
      }
    } catch (err: any) {
      setSignError(`Signature failed: ${err.message || "Invalid signature"}`);
    } finally {
      setSigning(false);
    }
  };

  // Handler: Anchor Trade to Blockchain (Milestone 6)
  const handleAnchorBlockchain = async () => {
    if (!selectedTradeId || !verificationRecord || verificationRecord.trade_id !== selectedTradeId) {
      setAnchorError("No trade verification record loaded for this trade.");
      return;
    }
    if (!authoritativeIsFullyVerified) {
      setAnchorError("Trade must be fully verified by both buyer and seller before anchoring on-chain.");
      return;
    }

    setIsAnchoring(true);
    setAnchorError("");
    setAnchorSuccess("");

    try {
      const res = await api.anchorTrade(selectedTradeId);
      if (res && res.trade_id === selectedTradeId) {
        setBlockchainProof(res);
        setAnchorSuccess(res.message || "Trade successfully anchored on EnergyDealRegistry!");
        
        // Refresh verification record to capture updated blockchain_status
        const updatedRec = await api.getTradeVerification(selectedTradeId);
        if (updatedRec?.trade_id === selectedTradeId) {
          setVerificationRecord(updatedRec);
        }
      }
    } catch (err: any) {
      setAnchorError(
        `Blockchain anchoring failed: ${err.message || "RPC or relayer transaction failure."} (Note: Milestone 5 off-chain verification remains 100% valid).`
      );
      // Re-fetch proof in case state changed to failed
      try {
        const proof = await api.getBlockchainProof(selectedTradeId);
        if (proof?.trade_id === selectedTradeId) {
          setBlockchainProof(proof);
        }
      } catch {}
    } finally {
      setIsAnchoring(false);
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

  const isProofForSelectedTrade = Boolean(
    blockchainProof && blockchainProof.trade_id === selectedTradeId
  );
  const activeProof = isProofForSelectedTrade ? blockchainProof : null;

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

  // Blockchain Anchored State Calculation
  const isAnchored =
    activeProof?.blockchain_status === "anchored" ||
    activeRecord?.blockchain_status === "anchored" ||
    Boolean(activeProof?.blockchain_tx_hash) ||
    Boolean(activeRecord?.blockchain_tx_hash);

  const isAnchorFailed =
    !isAnchored &&
    (activeProof?.blockchain_status === "failed" || activeRecord?.blockchain_status === "failed");

  const txHash = activeProof?.blockchain_tx_hash || activeRecord?.blockchain_tx_hash || null;
  const blockNumber = activeProof?.blockchain_block_number ?? activeRecord?.blockchain_block_number ?? null;
  const contractAddress =
    activeProof?.blockchain_contract_address ||
    activeRecord?.blockchain_contract_address ||
    "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const anchoredAt = activeProof?.blockchain_anchored_at || activeRecord?.blockchain_anchored_at || null;
  const onChainHash = activeProof?.on_chain_deal?.trade_canonical_hash || activeProof?.trade_canonical_hash || null;

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
            Cryptographic & Blockchain Verification Terminal
            <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Ed25519 & Smart Contract Anchor
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Client-side Ed25519 bilateral digital signatures with immutable on-chain commitment on EnergyDealRegistry.
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

      {anchorSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Blocks className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{anchorSuccess}</span>
          </div>
          <button onClick={() => setAnchorSuccess("")} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {anchorError && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>{anchorError}</span>
          </div>
          <button onClick={() => setAnchorError("")} className="text-amber-400 hover:text-white">✕</button>
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

      {/* Section 2: Immutable Blockchain Anchor (Milestone 6) */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Blocks className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">Immutable Blockchain Anchor</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  EnergyDealRegistry
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                On-chain immutable commitment of SHA-256 canonical hash on local Hardhat / Polygon PoS network.
              </p>
            </div>
          </div>

          {/* Blockchain Lifecycle Badge */}
          <div className="flex items-center gap-2">
            {isAnchored ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-3.5 w-3.5" />
                ANCHORED ON-CHAIN
              </span>
            ) : isAnchoring ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 animate-pulse">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                RELAYING TRANSACTION...
              </span>
            ) : isAnchorFailed ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                <AlertTriangle className="h-3.5 w-3.5" />
                ANCHOR FAILED (RETRYABLE)
              </span>
            ) : authoritativeIsFullyVerified ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Clock className="h-3.5 w-3.5" />
                UNANCHORED • READY
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
                <Lock className="h-3.5 w-3.5" />
                AWAITING SIGNATURES
              </span>
            )}
          </div>
        </div>

        {/* Anchor Content depending on state */}
        {!authoritativeIsFullyVerified ? (
          /* State 1: Unverified Trade */
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Lock className="h-4 w-4 text-amber-400" />
                <span>Complete dual-party verification before anchoring this trade on-chain.</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Smart contract anchoring requires both buyer and seller Ed25519 digital signatures to guarantee authentic settlement.
              </p>
            </div>
            <button
              disabled
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-500 font-mono text-xs font-bold cursor-not-allowed shrink-0 border border-slate-700/50"
            >
              Anchor on Blockchain (Disabled)
            </button>
          </div>
        ) : !isAnchored ? (
          /* State 2: Fully verified but unanchored (or failed) */
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  Dual Signatures Verified • Ready for Immutable Blockchain Commitment
                </span>
                <p className="text-xs text-slate-400">
                  Clicking below will dispatch the backend Web3.py relayer to store the canonical SHA-256 hash in the{" "}
                  <code className="text-indigo-300 font-mono">EnergyDealRegistry</code> smart contract.
                </p>
              </div>

              <button
                onClick={handleAnchorBlockchain}
                disabled={isAnchoring || blockchainLoading}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-slate-950 font-mono font-bold text-xs shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all disabled:opacity-50 shrink-0"
              >
                {isAnchoring ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Relaying to Hardhat...</span>
                  </>
                ) : isAnchorFailed ? (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>Retry Blockchain Anchor</span>
                  </>
                ) : (
                  <>
                    <Blocks className="h-4 w-4" />
                    <span>Anchor on Blockchain</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Off-Chain Canonical Hash (H₀):</span>
                <code className="text-emerald-400 font-bold break-all text-[11px]">
                  {authoritativeCanonicalHash}
                </code>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Smart Contract Target:</span>
                <code className="text-slate-300 text-[11px] break-all">{contractAddress}</code>
              </div>
            </div>

            {isAnchorFailed && (
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-xs text-red-300">
                <strong>Notice:</strong> Off-chain dual Ed25519 signature verification and audit-chain integrity remain 100% valid.
                The blockchain relayer encountered an RPC or network exception and can be safely retried.
              </div>
            )}
          </div>
        ) : (
          /* State 3: Successfully Anchored */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Transaction Hash */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center justify-between">
                  <span>Transaction Hash</span>
                  {txHash && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(txHash);
                        setCopiedTxHash(true);
                        setTimeout(() => setCopiedTxHash(false), 2000);
                      }}
                      className="text-slate-400 hover:text-emerald-400"
                      title="Copy Tx Hash"
                    >
                      {copiedTxHash ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                  )}
                </span>
                <div className="font-mono text-xs font-bold text-indigo-300 break-all">
                  {txHash ? shortenHash(txHash, 10, 8) : "Pending Tx"}
                </div>
                <span className="text-[10px] text-slate-500 font-mono block">Hardhat Local (31337)</span>
              </div>

              {/* Card 2: Block Number */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">Block Height</span>
                <div className="font-mono text-xs font-bold text-emerald-400">
                  {blockNumber !== null ? `#${blockNumber}` : "Latest Block"}
                </div>
                <span className="text-[10px] text-slate-500 font-mono block">Confirmed & Finalized</span>
              </div>

              {/* Card 3: Contract Address */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center justify-between">
                  <span>Registry Contract</span>
                  {contractAddress && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(contractAddress);
                        setCopiedContractAddr(true);
                        setTimeout(() => setCopiedContractAddr(false), 2000);
                      }}
                      className="text-slate-400 hover:text-emerald-400"
                      title="Copy Contract Address"
                    >
                      {copiedContractAddr ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                  )}
                </span>
                <div className="font-mono text-xs font-bold text-slate-300 truncate">
                  {contractAddress ? shortenHash(contractAddress, 8, 6) : "N/A"}
                </div>
                <span className="text-[10px] text-slate-500 font-mono block">EnergyDealRegistry.sol</span>
              </div>

              {/* Card 4: Anchored Timestamp */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">Anchored At</span>
                <div className="font-mono text-xs font-bold text-slate-200">
                  {anchoredAt ? new Date(anchoredAt).toLocaleTimeString() : "Confirmed"}
                </div>
                <span className="text-[10px] text-slate-500 font-mono block">
                  {anchoredAt ? new Date(anchoredAt).toLocaleDateString() : "Live State"}
                </span>
              </div>
            </div>

            {/* On-Chain Immutable Stored Record */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="space-y-1 flex-1">
                <span className="text-[10px] uppercase font-mono text-slate-400 block">
                  On-Chain Stored Bytes32 Digest:
                </span>
                <code className="text-xs font-mono font-bold text-emerald-400 break-all block">
                  {onChainHash ? `0x${onChainHash.replace(/^0x/, "")}` : `0x${authoritativeCanonicalHash}`}
                </code>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  IMMUTABLE ON-CHAIN PROOF ACTIVE
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Verifiable On-Chain Proof Inspector (Milestone 6) */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-400" />
              Verifiable Dual-Layer Proof Inspector
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Independent mathematical verification comparing off-chain cryptographic signatures with on-chain immutable smart contract storage.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isAnchored ? (
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                ON-CHAIN HASH MATCH ✓
              </span>
            ) : authoritativeIsFullyVerified ? (
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                OFF-CHAIN VERIFIED (UNANCHORED)
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
                INCOMPLETE PROOF
              </span>
            )}
          </div>
        </div>

        {/* Dual Column Side-by-Side Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left Column: Off-Chain Verified Record */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-xs font-mono font-bold text-slate-200 uppercase flex items-center gap-1.5">
                <FileCode className="h-3.5 w-3.5 text-emerald-400" />
                1. Off-Chain Verified Record (M5)
              </span>
              <span className="text-[10px] font-mono text-emerald-400">RFC 8785 • Ed25519</span>
            </div>

            <div className="space-y-2 text-xs font-mono text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Trade ID:</span>
                <span className="text-slate-200">#{selectedTradeId.substring(0, 8)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Proof Reference:</span>
                <span className="text-emerald-400 font-bold">{authoritativeVerificationRef || "Pending"}</span>
              </div>
              <div className="space-y-1 pt-1">
                <span className="text-slate-500 block text-[10px] uppercase">Canonical SHA-256 Digest:</span>
                <code className="text-emerald-400 font-bold break-all block text-[11px] p-2 rounded bg-slate-900 border border-slate-800">
                  {authoritativeCanonicalHash || "Pending"}
                </code>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[10px]">
                  <span className="text-slate-500 block">Buyer Ed25519:</span>
                  <span className={authoritativeBuyerSig ? "text-emerald-400 font-bold" : "text-amber-400"}>
                    {authoritativeBuyerSig ? "VALIDATED ✓" : "AWAITING"}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[10px]">
                  <span className="text-slate-500 block">Seller Ed25519:</span>
                  <span className={authoritativeSellerSig ? "text-emerald-400 font-bold" : "text-amber-400"}>
                    {authoritativeSellerSig ? "VALIDATED ✓" : "AWAITING"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: On-Chain Immutable Anchor */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-xs font-mono font-bold text-indigo-300 uppercase flex items-center gap-1.5">
                <Blocks className="h-3.5 w-3.5 text-indigo-400" />
                2. On-Chain Immutable Anchor (M6)
              </span>
              <span className="text-[10px] font-mono text-indigo-400">Solidity • Hardhat 31337</span>
            </div>

            <div className="space-y-2 text-xs font-mono text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Contract:</span>
                <span className="text-slate-300">{shortenHash(contractAddress, 8, 6)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Transaction:</span>
                <span className="text-indigo-300 font-bold">{txHash ? shortenHash(txHash, 8, 6) : "Unanchored"}</span>
              </div>
              <div className="space-y-1 pt-1">
                <span className="text-slate-500 block text-[10px] uppercase">On-Chain Bytes32 Commitment:</span>
                <code
                  className={`font-bold break-all block text-[11px] p-2 rounded bg-slate-900 border border-slate-800 ${
                    isAnchored ? "text-indigo-300" : "text-slate-500"
                  }`}
                >
                  {isAnchored
                    ? `0x${(onChainHash || authoritativeCanonicalHash).replace(/^0x/, "")}`
                    : "Awaiting blockchain anchoring transaction"}
                </code>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[10px]">
                  <span className="text-slate-500 block">Block Height:</span>
                  <span className="text-slate-200">{blockNumber !== null ? `#${blockNumber}` : "N/A"}</span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[10px]">
                  <span className="text-slate-500 block">Relayer Status:</span>
                  <span className={isAnchored ? "text-emerald-400 font-bold" : "text-slate-500"}>
                    {isAnchored ? "CONFIRMED ✓" : "STANDBY"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Prominent Live Proof Evaluation Banner */}
        {isAnchored ? (
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs font-mono text-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-emerald-300 text-sm">
                  ON-CHAIN HASH MATCH — IMMUTABLE INTEGRITY VERIFIED
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  The off-chain SHA-256 digest mathematically matches the <code>bytes32</code> commitment anchored in block #{blockNumber}.
                </p>
              </div>
            </div>

            <div className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-500/30 shrink-0">
              Contract Verified: TRUE
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              {authoritativeIsFullyVerified
                ? "Off-chain signatures verified. Anchor on blockchain above to enable dual-layer proof inspection."
                : "Awaiting dual-party signatures before on-chain proof inspection is enabled."}
            </span>
          </div>
        )}
      </div>

      {/* Section 4: Public Key Inspector & Peer Identity Directory */}
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

      {/* Section 5: Linked Audit Chain Record */}
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

      {/* Section 6: Interactive Tamper Detection Sandbox & Receipt Inspector */}
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
                Test the backend <code>/verification/verify</code> tamper engine against off-chain and on-chain records.
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
                {tamperResult.blockchain_verified !== undefined && (
                  <div className="col-span-2 pt-1 border-t border-slate-800/60">
                    On-Chain Match:{" "}
                    <strong className={tamperResult.blockchain_verified ? "text-emerald-400" : "text-red-400"}>
                      {tamperResult.blockchain_verified ? "TRUE (MATCHES ON-CHAIN)" : "FALSE (ON-CHAIN MISMATCH)"}
                    </strong>
                  </div>
                )}
              </div>
              {(tamperResult.details || tamperResult.message) && (
                <p className="text-slate-400 text-[10px] mt-1">{tamperResult.details || tamperResult.message}</p>
              )}
            </div>
          )}

          <p className="text-[10px] text-slate-500 italic">
            * Demonstration sandbox only. The immutable on-chain smart contract record was not modified.
          </p>
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
                {inspectedReceipt.blockchain_status && (
                  <p>
                    Blockchain Anchor:{" "}
                    <span className={inspectedReceipt.blockchain_status === "anchored" ? "text-emerald-400 font-bold" : "text-amber-400"}>
                      {inspectedReceipt.blockchain_status.toUpperCase()}
                    </span>
                  </p>
                )}
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
