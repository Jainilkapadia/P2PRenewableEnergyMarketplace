"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Store,
  MapPin,
  Sliders,
  Wallet,
  ArrowLeftRight,
  Users,
  ShieldCheck,
  ListPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const { role } = useAuth();

  const getMobileNav = () => {
    if (role === "admin") {
      return [
        { name: "Admin", href: "/admin", icon: LayoutDashboard },
        { name: "Users", href: "/admin/users", icon: Users },
        { name: "Market", href: "/marketplace", icon: Store },
        { name: "Trades", href: "/trades", icon: ArrowLeftRight },
        { name: "Verify", href: "/verification", icon: ShieldCheck },
      ];
    }
    if (role === "prosumer") {
      return [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Listings", href: "/listings", icon: ListPlus },
        { name: "Market", href: "/marketplace", icon: Store },
        { name: "Map", href: "/map", icon: MapPin },
        { name: "Wallet", href: "/wallet", icon: Wallet },
      ];
    }
    if (role === "dual") {
      return [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Listings", href: "/listings", icon: ListPlus },
        { name: "Require", href: "/requirements", icon: Sliders },
        { name: "Map", href: "/map", icon: MapPin },
        { name: "Wallet", href: "/wallet", icon: Wallet },
      ];
    }
    return [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Market", href: "/marketplace", icon: Store },
      { name: "Map", href: "/map", icon: MapPin },
      { name: "Require", href: "/requirements", icon: Sliders },
      { name: "Wallet", href: "/wallet", icon: Wallet },
    ];
  };

  const navItems = getMobileNav();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#080d1a]/95 backdrop-blur border-t border-slate-800 z-40 px-2 flex items-center justify-around">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-medium transition-colors",
              isActive ? "text-emerald-400 font-semibold" : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
