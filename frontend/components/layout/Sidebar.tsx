"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Store,
  MapPin,
  Sliders,
  ArrowLeftRight,
  ShieldCheck,
  Award,
  Wallet,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Zap,
  Sun,
  Layers,
  Users,
  AlertTriangle,
  HeartPulse,
  Bell,
  ListPlus,
  FileCheck2,
  LogOut,
} from "lucide-react";
import { useAuth, UserRole } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const CONSUMER_NAV: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Marketplace", href: "/marketplace", icon: Store },
  { name: "Nearby Map", href: "/map", icon: MapPin },
  { name: "My Requirements", href: "/requirements", icon: Sliders },
  { name: "My Trades", href: "/trades", icon: ArrowLeftRight },
  { name: "Wallet", href: "/wallet", icon: Wallet },
  { name: "Reliability", href: "/reliability", icon: Award },
  { name: "Notifications", href: "/notifications", icon: Bell },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

const PROSUMER_NAV: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Marketplace", href: "/marketplace", icon: Store },
  { name: "Nearby Map", href: "/map", icon: MapPin },
  { name: "My Listings", href: "/listings", icon: ListPlus },
  { name: "My Trades", href: "/trades", icon: ArrowLeftRight },
  { name: "Wallet", href: "/wallet", icon: Wallet },
  { name: "Reliability", href: "/reliability", icon: Award },
  { name: "Notifications", href: "/notifications", icon: Bell },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

const DUAL_NAV: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Marketplace", href: "/marketplace", icon: Store },
  { name: "Nearby Map", href: "/map", icon: MapPin },
  { name: "My Listings", href: "/listings", icon: ListPlus },
  { name: "My Requirements", href: "/requirements", icon: Sliders },
  { name: "My Trades", href: "/trades", icon: ArrowLeftRight },
  { name: "Wallet", href: "/wallet", icon: Wallet },
  { name: "Reliability", href: "/reliability", icon: Award },
  { name: "Notifications", href: "/notifications", icon: Bell },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

const ADMIN_NAV: NavItem[] = [
  { name: "Grid Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Users Registry", href: "/admin/users", icon: Users },
  { name: "Live Listings", href: "/marketplace", icon: Store },
  { name: "Grid Trades", href: "/trades", icon: ArrowLeftRight },
  { name: "Verification", href: "/verification", icon: ShieldCheck },
  { name: "Reliability Engine", href: "/reliability", icon: Award },
  { name: "Disputes", href: "/admin/disputes", icon: AlertTriangle },
  { name: "Grid Analytics", href: "/analytics", icon: BarChart3 },
  { name: "System Health", href: "/admin/health", icon: HeartPulse },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user, role, profile, logout } = useAuth();

  const getNavItems = (): NavItem[] => {
    switch (role) {
      case "prosumer":
        return PROSUMER_NAV;
      case "dual":
        return DUAL_NAV;
      case "admin":
        return ADMIN_NAV;
      case "consumer":
      default:
        return CONSUMER_NAV;
    }
  };

  const navItems = getNavItems();

  const getRoleBadge = () => {
    switch (role) {
      case "prosumer":
        return { label: "Prosumer", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
      case "dual":
        return { label: "Dual Trader", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" };
      case "admin":
        return { label: "Grid Admin", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" };
      case "consumer":
      default:
        return { label: "Consumer", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
    }
  };

  const roleBadge = getRoleBadge();

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="hidden md:flex flex-col border-r border-slate-800/80 bg-[#0b1120] select-none z-30 h-screen sticky top-0"
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
        <Link href={role === "admin" ? "/admin" : "/dashboard"} className="flex items-center gap-2.5 overflow-hidden">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 glow-emerald">
            <Zap className="h-4 w-4 fill-emerald-400" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="flex flex-col whitespace-nowrap"
              >
                <span className="font-semibold text-sm tracking-tight text-slate-100 flex items-center gap-1.5">
                  VoltP2P
                  <span className={cn("text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border", roleBadge.color)}>
                    {roleBadge.label}
                  </span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">Ahmedabad Node</span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname === item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group relative",
                isActive
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              )}
              title={collapsed ? item.name : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform group-hover:scale-110",
                  isActive ? "text-emerald-400" : "text-slate-400"
                )}
              />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="truncate whitespace-nowrap"
                  >
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>

              {isActive && (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-emerald-400 rounded-r-full"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Node Feeder Status & Quick Logout */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
        <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "justify-between")}>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {!collapsed && (
              <span className="text-[11px] font-mono text-slate-400 truncate">
                {profile?.substation || "AHMEDABAD_SUB_ZONE_1"}
              </span>
            )}
          </div>
          {!collapsed && (
            <span className="text-[10px] text-emerald-400 font-mono font-medium">99.8% Sync</span>
          )}
        </div>

        {!collapsed && (
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 hover:border-rose-500/40 hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 text-[11px] transition-all"
          >
            <LogOut className="h-3 w-3" />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </motion.aside>
  );
}
