"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  Bell, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  Sun, 
  Clock, 
  ArrowLeftRight, 
  PenTool, 
  Blocks, 
  AlertTriangle,
  RotateCw,
  Check,
  ArrowRight,
  Inbox
} from "lucide-react";
import { api, AppNotification } from "@/lib/api-client";

function getNotificationIconAndStyle(type: string) {
  switch (type) {
    case "listing_created":
      return {
        icon: Sun,
        color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
        badge: "Listing",
      };
    case "requirement_created":
      return {
        icon: Zap,
        color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
        badge: "Requirement",
      };
    case "trade_initiated":
      return {
        icon: ArrowLeftRight,
        color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
        badge: "Trade Match",
      };
    case "buyer_signed":
    case "seller_signed":
    case "signature_verified":
      return {
        icon: PenTool,
        color: "text-purple-400 bg-purple-500/10 border-purple-500/30",
        badge: "Ed25519 Sign",
      };
    case "trade_verified":
      return {
        icon: ShieldCheck,
        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
        badge: "Audit Verified",
      };
    case "blockchain_anchored":
      return {
        icon: Blocks,
        color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
        badge: "On-Chain Anchor",
      };
    case "blockchain_anchor_failed":
      return {
        icon: AlertTriangle,
        color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
        badge: "Anchor Notice",
      };
    default:
      return {
        icon: Bell,
        color: "text-slate-400 bg-slate-800 border-slate-700",
        badge: "System",
      };
  }
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return dateString;
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      setMarkingId(notificationId);
      await api.markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    } catch (err: any) {
      console.error("Failed to mark notification as read", err);
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAll(true);
      await api.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err: any) {
      console.error("Failed to mark all as read", err);
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <Bell className="h-6 w-6 text-emerald-400" />
            Grid Notifications
            {unreadCount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {unreadCount} new
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Persistent Ahmedabad grid events, cryptographic verification confirmations & blockchain audits
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => loadNotifications()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white transition disabled:opacity-50"
            title="Refresh notifications"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {markingAll ? "Marking..." : "Mark all as read"}
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadNotifications()}
            className="text-xs underline hover:text-white shrink-0"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && notifications.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse flex items-start gap-4"
            >
              <div className="h-10 w-10 rounded-lg bg-slate-800 shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-slate-800 rounded w-1/3" />
                <div className="h-3 bg-slate-800/60 rounded w-4/5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && notifications.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">No Notifications Yet</h3>
          <p className="text-sm text-slate-400 max-w-sm mt-1">
            When you publish listings, register requirements, or sign trades, real-time audit notifications will appear here.
          </p>
        </div>
      )}

      {/* Notification List */}
      {!loading && notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map((n) => {
            const { icon: Icon, color, badge } = getNotificationIconAndStyle(n.type);
            const isTradeRelated =
              n.type.includes("trade") ||
              n.type.includes("signed") ||
              n.type.includes("signature") ||
              n.type.includes("anchor");

            return (
              <div
                key={n.id}
                className={`p-4 rounded-xl transition border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  !n.is_read
                    ? "bg-slate-900 border-emerald-500/30 shadow-sm shadow-emerald-500/5"
                    : "bg-slate-900/50 border-slate-800/80 hover:border-slate-700"
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-100">
                        {n.title}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                        {badge}
                      </span>
                      {!n.is_read && (
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(n.created_at)}
                      </span>
                      {n.reference_id && (
                        <span className="text-slate-500 truncate max-w-[180px]">
                          Ref: #{n.reference_id.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {isTradeRelated && n.reference_id && (
                    <Link
                      href={`/verification?trade_id=${n.reference_id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition border border-slate-700/80"
                    >
                      <span>Audit View</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}

                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(n.id)}
                      disabled={markingId === n.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition border border-emerald-500/20 disabled:opacity-50"
                      title="Mark as read"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{markingId === n.id ? "Saving..." : "Mark Read"}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

