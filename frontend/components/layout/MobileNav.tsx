"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  MapPin,
  Sliders,
  Wallet,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MOBILE_NAV = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Market", href: "/marketplace", icon: Store },
  { name: "Map", href: "/map", icon: MapPin },
  { name: "Match", href: "/matching", icon: Sliders },
  { name: "Trades", href: "/trades", icon: ArrowLeftRight },
  { name: "Wallet", href: "/wallet", icon: Wallet },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#080d1a]/95 backdrop-blur border-t border-slate-800 z-40 px-2 flex items-center justify-around">
      {MOBILE_NAV.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
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
