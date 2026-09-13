"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, UserRole } from "@/lib/auth-context";
import { usePerspective } from "@/lib/perspective-context";
import { formatINR } from "@/lib/utils";
import { api, AppNotification } from "@/lib/api-client";
import {
  Wallet,
  Bell,
  KeyRound,
  Sun,
  Zap,
  Layers,
  ShieldAlert,
  LogOut,
  ChevronDown,
  User,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  CheckCheck,
  Clock,
  Blocks,
  FileCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Topbar() {
  const router = useRouter();
  const { user, role, profile, logout } = useAuth();
  const { perspective, isDual, togglePerspective } = usePerspective();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Notification state (Milestone 10)
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotifMenu, setShowNotifMenu] = useState<boolean>(false);
  const [recentNotifs, setRecentNotifs] = useState<AppNotification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState<boolean>(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  const getRoleTheme = (r: UserRole) => {
    switch (r) {
      case "prosumer":
        return {
          icon: Sun,
          label: "Prosumer (Solar)",
          badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
          dotColor: "bg-amber-400",
        };
      case "dual":
        return {
          icon: Layers,
          label: "Dual (Buy/Sell)",
          badgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
          dotColor: "bg-indigo-400",
        };
      case "admin":
        return {
          icon: ShieldAlert,
          label: "Grid Admin",
          badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30",
          dotColor: "bg-purple-400",
        };
      case "consumer":
      default:
        return {
          icon: Zap,
          label: "Consumer (EV)",
          badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
          dotColor: "bg-emerald-400",
        };
    }
  };

  const theme = getRoleTheme(role);
  const RoleIcon = theme.icon;

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.getUnreadNotificationCount();
      if (typeof res?.unread_count === "number") {
        setUnreadCount(res.unread_count);
      }
    } catch {
      // Silently ignore network errors during background polling
    }
  }, []);

  // Fetch latest notifications for dropdown
  const fetchRecentNotifications = useCallback(async () => {
    setLoadingNotifs(true);
    try {
      const list = await api.getNotifications({ limit: 4 });
      if (Array.isArray(list)) {
        setRecentNotifs(list);
      }
    } catch {
      setRecentNotifs([]);
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  // Polling interval ~15 seconds and refresh on focus/user change
  useEffect(() => {
    fetchUnreadCount();

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 15000);

    const handleFocus = () => {
      fetchUnreadCount();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchUnreadCount, user]);

  const handleToggleNotifMenu = () => {
    if (!showNotifMenu) {
      fetchRecentNotifications();
      fetchUnreadCount();
    }
    setShowNotifMenu(!showNotifMenu);
    setShowProfileMenu(false);
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.markAllNotificationsAsRead();
      setUnreadCount(0);
      setRecentNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    setShowNotifMenu(false);
    if (!notif.is_read) {
      try {
        await api.markNotificationAsRead(notif.id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {}
    }

    if (notif.reference_id) {
      if (
        notif.type.includes("trade") ||
        notif.type.includes("signed") ||
        notif.type.includes("verification") ||
        notif.type.includes("blockchain")
      ) {
        router.push(`/verification?trade_id=${notif.reference_id}`);
        return;
      }
      if (notif.type === "listing_created") {
        router.push("/listings");
        return;
      }
      if (notif.type === "requirement_created") {
        router.push("/requirements");
        return;
      }
    }
    router.push("/notifications");
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.floor(diffHours / 24)}d ago`;
    } catch {
      return "Recently";
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Left: Role Indicator & Dual Mode Switcher */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border", theme.badgeClass)}>
            <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", theme.dotColor)} />
            <RoleIcon className="h-3.5 w-3.5" />
            <span>{theme.label}</span>
          </div>

          {/* Dual Role Perspective Toggle */}
          {isDual && (
            <button
              onClick={togglePerspective}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-indigo-500/50 text-slate-300 hover:text-indigo-300 text-xs font-medium transition-colors"
              title="Switch Perspective between Buying and Selling modes"
            >
              <span>Mode:</span>
              <span className="font-bold text-indigo-400 capitalize">{perspective}</span>
              <span className="text-[10px] text-slate-500">(Click to switch)</span>
            </button>
          )}
        </div>

        {/* Substation Feeder Metadata */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-500 pl-2 border-l border-slate-800">
          <span>Feeder: {user?.grid_substation_id || profile?.substation || "AHMEDABAD_SUB_ZONE_1"}</span>
        </div>
      </div>

      {/* Right: Wallet Balance, Notifications & Authenticated Profile Menu */}
      <div className="flex items-center gap-3">
        {/* Wallet Balance Chip */}
        <Link
          href="/wallet"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all group"
        >
          <div className="h-6 w-6 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Wallet className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-slate-400 font-medium leading-none">Available</span>
            <span className="text-xs font-mono font-semibold text-slate-100 group-hover:text-emerald-300 transition-colors">
              {formatINR(profile?.walletBalance || 0)}
            </span>
          </div>
          {(profile?.escrowBalance || 0) > 0 && (
            <span className="hidden sm:inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 ml-1">
              {formatINR(profile?.escrowBalance || 0)} Escrow
            </span>
          )}
        </Link>

        {/* Notification Bell with Dynamic Unread Badge & Dropdown */}
        <div className="relative" ref={notifDropdownRef}>
          <button
            onClick={handleToggleNotifMenu}
            className={cn(
              "relative p-2 rounded-lg bg-slate-900 border transition-all",
              showNotifMenu
                ? "border-emerald-500/60 text-slate-100 bg-slate-850"
                : "border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            )}
            title="Grid Notifications"
            aria-label="Grid Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-slate-950 font-mono font-black text-[10px] flex items-center justify-center border-2 border-slate-950 shadow-md">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Preview */}
          {showNotifMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowNotifMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-0 z-40 overflow-hidden">
                {/* Dropdown Header */}
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                      Grid Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors font-medium"
                    >
                      <CheckCheck className="h-3 w-3" />
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Notifications Preview List */}
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
                  {loadingNotifs ? (
                    <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                      <div className="h-3 bg-slate-800 rounded animate-pulse w-3/4 mx-auto" />
                      <div className="h-3 bg-slate-800 rounded animate-pulse w-1/2 mx-auto" />
                    </div>
                  ) : recentNotifs.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      <CheckCircle2 className="h-6 w-6 text-slate-600 mx-auto mb-1.5" />
                      <p>No new grid notifications</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">All trade signatures and anchors are synced.</p>
                    </div>
                  ) : (
                    recentNotifs.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={cn(
                          "w-full text-left p-3 hover:bg-slate-850/80 transition-colors flex items-start gap-2.5",
                          !n.is_read && "bg-slate-900/90 border-l-2 border-emerald-400"
                        )}
                      >
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full mt-1.5 shrink-0",
                            !n.is_read ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-slate-700"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className={cn("text-xs truncate font-medium", !n.is_read ? "text-slate-100 font-semibold" : "text-slate-300")}>
                              {n.title}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 shrink-0">
                              {formatRelativeTime(n.created_at)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                            {n.message}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Dropdown Footer */}
                <div className="p-2 border-t border-slate-800 bg-slate-950/70 text-center">
                  <Link
                    href="/notifications"
                    onClick={() => setShowNotifMenu(false)}
                    className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 py-1 transition-colors w-full"
                  >
                    <span>View all notifications</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Profile Details & Logout Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifMenu(false);
            }}
            className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
          >
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-medium text-slate-100">
                {user?.full_name || profile?.name}
              </span>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center justify-end gap-1">
                <KeyRound className="h-2.5 w-2.5" />
                Ed25519 Active
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-200">
              {(user?.full_name || profile?.name || "U").charAt(0)}
            </div>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>

          {/* Profile Modal / Dropdown */}
          {showProfileMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowProfileMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3 z-40 space-y-3">
                <div className="border-b border-slate-800 pb-2">
                  <p className="text-xs font-semibold text-slate-100">{user?.full_name || profile?.name}</p>
                  <p className="text-[11px] font-mono text-slate-400 truncate">{user?.email || "authenticated@grid.in"}</p>
                  <span className={cn("inline-block mt-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded border", theme.badgeClass)}>
                    {role} Role
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Substation:</span>
                    <span className="font-mono text-[11px] text-slate-200">{user?.grid_substation_id || profile?.substation || "ZONE_1"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Node Status:</span>
                    <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                      <ShieldCheck className="h-3 w-3" />
                      Active
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
