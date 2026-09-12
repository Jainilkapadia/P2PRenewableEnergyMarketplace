"use client";

import React, { useEffect, useRef, useState } from "react";
import { Map as MapLibreInstance, Marker, NavigationControl, LngLatBounds } from "maplibre-gl";
import {
  AHMEDABAD_CENTER,
  ProsumerListing,
} from "@/lib/demo-data";
import { usePerspective } from "@/lib/perspective-context";
import { Maximize2, Zap, RefreshCw } from "lucide-react";

interface MapLibreMapProps {
  listings: ProsumerListing[];
  selectedProsumer: ProsumerListing | null;
  onSelectProsumer: (listing: ProsumerListing) => void;
  isLoading?: boolean;
}

export default function MapLibreMap({
  listings = [],
  selectedProsumer,
  onSelectProsumer,
  isLoading = false,
}: MapLibreMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<MapLibreInstance | null>(null);
  const markersRef = useRef<{ [id: string]: Marker }>({});
  const { perspective, activeUser } = usePerspective();
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current) return;

    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    // Initialize MapLibre with OpenStreetMap raster tiles (free, reliable, no API key required)
    const map = new MapLibreInstance({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          "osm-tiles": {
            type: "raster",
            tiles: [
              "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: "osm-tiles-layer",
            type: "raster",
            source: "osm-tiles",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [AHMEDABAD_CENTER.lng, AHMEDABAD_CENTER.lat],
      zoom: AHMEDABAD_CENTER.zoom,
      pitch: 20,
    });

    mapInstance.current = map;

    // Navigation Controls
    map.addControl(new NavigationControl({ showCompass: true }), "top-right");

    map.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      map.remove();
      mapInstance.current = null;
      setMapLoaded(false);
    };
  }, [perspective]);

  // Render and update markers whenever map loads, listings change, or active user changes
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapLoaded) return;

    // 1. Remove existing markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    // 2. Add Perspective-Aware User Anchor Marker
    const userAnchorEl = document.createElement("div");
    userAnchorEl.className = "flex flex-col items-center cursor-pointer group z-10";

    if (perspective === "consumer") {
      userAnchorEl.innerHTML = `
        <div class="h-9 w-9 rounded-full bg-blue-500/25 border-2 border-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/40 animate-pulse">
          <div class="h-4 w-4 rounded-full bg-blue-400 flex items-center justify-center">
            <span class="h-1.5 w-1.5 rounded-full bg-white"></span>
          </div>
        </div>
        <div class="mt-1 px-2.5 py-0.5 rounded bg-slate-900/95 border border-blue-500/60 text-[10px] font-mono text-blue-300 whitespace-nowrap shadow-xl">
          You: ${activeUser.name} (${activeUser.location.neighborhood})
        </div>
      `;
    } else {
      userAnchorEl.innerHTML = `
        <div class="h-9 w-9 rounded-full bg-amber-500/25 border-2 border-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/40 animate-pulse">
          <div class="h-4 w-4 rounded-full bg-amber-400 flex items-center justify-center">
            <span class="h-1.5 w-1.5 rounded-full bg-white"></span>
          </div>
        </div>
        <div class="mt-1 px-2.5 py-0.5 rounded bg-slate-900/95 border border-amber-500/60 text-[10px] font-mono text-amber-300 whitespace-nowrap shadow-xl">
          You: ${activeUser.name} (${activeUser.location.neighborhood})
        </div>
      `;
    }

    const anchorMarker = new Marker({ element: userAnchorEl })
      .setLngLat([activeUser.location.lng, activeUser.location.lat])
      .addTo(map);

    markersRef.current["__user_anchor__"] = anchorMarker;

    // 3. Add Dynamic Prosumer Listing Markers from API
    listings.forEach((listing) => {
      // In prosumer perspective, if this listing is the active user's own listing, user anchor already shows it
      if (perspective === "prosumer" && listing.prosumerId === activeUser.id) {
        return;
      }

      const isSelected = selectedProsumer?.id === listing.id;

      const markerEl = document.createElement("div");
      markerEl.className = `flex flex-col items-center cursor-pointer group transition-all duration-200 ${
        isSelected ? "scale-110 z-30" : "hover:scale-105 z-20"
      }`;
      markerEl.id = `marker-${listing.id}`;

      const borderClass = isSelected
        ? "border-emerald-400 bg-emerald-950/90 text-emerald-200 ring-2 ring-emerald-500/50 glow-emerald"
        : "border-emerald-600/80 bg-slate-900/95 text-slate-100 hover:border-emerald-400 hover:bg-slate-800";

      const pinColor = isSelected ? "bg-emerald-400" : "bg-emerald-500";

      markerEl.innerHTML = `
        <div class="px-2.5 py-1.5 rounded-xl border-2 shadow-2xl flex items-center gap-1.5 text-xs font-mono font-bold transition-all ${borderClass}">
          <span class="h-2 w-2 rounded-full ${pinColor} ${isSelected ? 'animate-ping' : ''}"></span>
          <span>₹${listing.pricePerKwh.toFixed(2)}/kWh</span>
          <span class="text-[10px] text-slate-400 font-normal">(${listing.energyRemainingKwh}kWh)</span>
        </div>
        <div class="w-0.5 h-2.5 ${pinColor}"></div>
        <div class="h-1.5 w-1.5 rounded-full ${pinColor} shadow"></div>
      `;

      markerEl.addEventListener("click", () => {
        onSelectProsumer(listing);
      });

      const marker = new Marker({ element: markerEl })
        .setLngLat([listing.location.lng, listing.location.lat])
        .addTo(map);

      markersRef.current[listing.id] = marker;
    });

    // 4. Auto-Fit Bounds to include User Anchor and All Dynamic Listings
    if (listings.length > 0) {
      const bounds = new LngLatBounds();
      bounds.extend([activeUser.location.lng, activeUser.location.lat]);
      listings.forEach((l) => {
        bounds.extend([l.location.lng, l.location.lat]);
      });

      // Fit with comfortable padding for UI drawers
      map.fitBounds(bounds, {
        padding: { top: 70, bottom: 70, left: 70, right: 350 },
        maxZoom: 13.8,
        duration: 800,
      });
    }
  }, [mapLoaded, listings, perspective, activeUser, onSelectProsumer, selectedProsumer?.id]);

  // Fly to selected prosumer when selection changes externally
  useEffect(() => {
    if (!mapInstance.current || !selectedProsumer) return;

    mapInstance.current.flyTo({
      center: [selectedProsumer.location.lng, selectedProsumer.location.lat],
      zoom: 13.8,
      pitch: 35,
      essential: true,
      duration: 1000,
    });
  }, [selectedProsumer]);

  // Reset / Fit All Helper Button
  const handleResetBounds = () => {
    const map = mapInstance.current;
    if (!map || listings.length === 0) return;

    const bounds = new LngLatBounds();
    bounds.extend([activeUser.location.lng, activeUser.location.lat]);
    listings.forEach((l) => {
      bounds.extend([l.location.lng, l.location.lat]);
    });

    map.fitBounds(bounds, {
      padding: { top: 70, bottom: 70, left: 70, right: 350 },
      maxZoom: 13.8,
      duration: 800,
    });
  };

  return (
    <div className="relative w-full h-full min-h-[500px] rounded-2xl overflow-hidden border border-slate-800 bg-[#080d1a]">
      {/* Map Canvas Container */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Floating Fit All Control */}
      <button
        onClick={handleResetBounds}
        title="Fit All Prosumer Nodes in View"
        className="absolute bottom-6 left-4 z-10 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-slate-100 text-xs font-mono flex items-center gap-1.5 shadow-xl backdrop-blur transition-all"
      >
        <Maximize2 className="h-3.5 w-3.5 text-emerald-400" />
        <span>Fit Ahmedabad Grid</span>
      </button>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center">
          <div className="px-4 py-2 rounded-xl bg-slate-900/90 border border-emerald-500/30 shadow-2xl flex items-center gap-2 text-xs font-mono text-emerald-400">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-400" />
            <span>Synchronizing live Ahmedabad listings...</span>
          </div>
        </div>
      )}

      {/* Empty State Overlay */}
      {!isLoading && listings.length === 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 px-5 py-3 rounded-xl bg-slate-900/95 border border-slate-700 text-center shadow-2xl">
          <p className="text-xs text-slate-300 font-mono">No active energy listings found in this grid zone.</p>
          <p className="text-[11px] text-slate-500 mt-1">Check your filters or connect additional microgrid nodes.</p>
        </div>
      )}
    </div>
  );
}
