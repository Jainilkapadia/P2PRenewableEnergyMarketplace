"use client";

import React, { useEffect, useRef, useState } from "react";
import { Map as MapLibreInstance, Marker, NavigationControl, LngLatBounds } from "maplibre-gl";
import {
  AHMEDABAD_CENTER,
  ProsumerListing,
} from "@/lib/demo-data";
import { usePerspective } from "@/lib/perspective-context";
import { Maximize2, Zap, RefreshCw, Blocks, ShieldCheck, ArrowRight } from "lucide-react";

export interface ActiveTradeFlow {
  tradeId: string;
  sellerId: string;
  sellerName: string;
  sellerCoords: [number, number]; // [lng, lat]
  buyerId: string;
  buyerName: string;
  buyerCoords: [number, number]; // [lng, lat]
  energyKwh: number;
  unitPrice: number;
  totalAmount: number;
  status: string;
  verificationReference?: string;
  isFullyVerified?: boolean;
  isAnchored?: boolean;
}

interface MapLibreMapProps {
  listings: ProsumerListing[];
  selectedProsumer: ProsumerListing | null;
  onSelectProsumer: (listing: ProsumerListing) => void;
  isLoading?: boolean;
  activeTradeFlow?: ActiveTradeFlow | null;
}

export default function MapLibreMap({
  listings = [],
  selectedProsumer,
  onSelectProsumer,
  isLoading = false,
  activeTradeFlow,
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

  // Trade endpoint markers ref (separate from listing pins to avoid collisions)
  const tradeMarkersRef = useRef<Marker[]>([]);
  const animFrameIdRef = useRef<number | null>(null);

  // Helper to generate a curved quadratic Bezier path between two coordinates
  const generateCurvedPath = (
    start: [number, number],
    end: [number, number],
    numPoints = 50
  ): [number, number][] => {
    const [startLng, startLat] = start;
    const [endLng, endLat] = end;

    // Midpoint
    const midLng = (startLng + endLng) / 2;
    const midLat = (startLat + endLat) / 2;

    // Perpendicular vector for offset curve
    const dx = endLng - startLng;
    const dy = endLat - startLat;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return [start, end];

    // Curve deflection perpendicular to the line
    const offsetMagnitude = Math.min(Math.max(len * 0.22, 0.005), 0.03);
    const ctrlLng = midLng - (dy / len) * offsetMagnitude;
    const ctrlLat = midLat + (dx / len) * offsetMagnitude;

    const points: [number, number][] = [];
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      // Quadratic Bezier: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
      const lng = (1 - t) * (1 - t) * startLng + 2 * (1 - t) * t * ctrlLng + t * t * endLng;
      const lat = (1 - t) * (1 - t) * startLat + 2 * (1 - t) * t * ctrlLat + t * t * endLat;
      points.push([lng, lat]);
    }
    return points;
  };

  // Trade Flow Line & Particle Animation Effect
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapLoaded) return;

    const SOURCE_ID = "trade-flow-source";
    const PARTICLE_SOURCE_ID = "trade-flow-particle-source";
    const GLOW_LAYER_ID = "trade-flow-glow";
    const LINE_LAYER_ID = "trade-flow-line";
    const PARTICLE_LAYER_ID = "trade-flow-particles";

    // Clean up helper
    const cleanupLayers = () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }

      tradeMarkersRef.current.forEach((m) => m.remove());
      tradeMarkersRef.current = [];

      try {
        if (map.getLayer(PARTICLE_LAYER_ID)) map.removeLayer(PARTICLE_LAYER_ID);
        if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
        if (map.getLayer(GLOW_LAYER_ID)) map.removeLayer(GLOW_LAYER_ID);
        if (map.getSource(PARTICLE_SOURCE_ID)) map.removeSource(PARTICLE_SOURCE_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch (e) {
        // Safe swallow during unmount
      }
    };

    // If no active trade flow, cleanly remove any prior layers and exit
    if (!activeTradeFlow) {
      cleanupLayers();
      return;
    }

    const { sellerCoords, buyerCoords, sellerName, buyerName, energyKwh, unitPrice, status } = activeTradeFlow;

    // Validate coordinates
    if (
      !sellerCoords ||
      !buyerCoords ||
      isNaN(sellerCoords[0]) ||
      isNaN(sellerCoords[1]) ||
      isNaN(buyerCoords[0]) ||
      isNaN(buyerCoords[1])
    ) {
      cleanupLayers();
      return;
    }

    // Clean up previous instances before drawing new trade
    cleanupLayers();

    // 1. Generate curved LineString points
    const curvedCoordinates = generateCurvedPath(sellerCoords, buyerCoords, 60);

    // 2. Add GeoJSON Line Source
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: { tradeId: activeTradeFlow.tradeId },
        geometry: {
          type: "LineString",
          coordinates: curvedCoordinates,
        },
      },
    });

    // 3. Add Glow Base Layer (Soft amber/emerald gradient aura)
    map.addLayer({
      id: GLOW_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#10B981",
        "line-width": 6,
        "line-opacity": 0.25,
        "line-blur": 3,
      },
    });

    // 4. Add Core Line Layer (Crisp dashed energy delivery path)
    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#34D399",
        "line-width": 2.5,
        "line-opacity": 0.85,
        "line-dasharray": [2, 2],
      },
    });

    // 5. Add Particle Point Source & Layer for animated flow
    const particlePositions: [number, number][] = [
      curvedCoordinates[0],
      curvedCoordinates[Math.floor(curvedCoordinates.length * 0.33)],
      curvedCoordinates[Math.floor(curvedCoordinates.length * 0.66)],
    ];

    map.addSource(PARTICLE_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: particlePositions.map((coords, i) => ({
          type: "Feature",
          properties: { id: i },
          geometry: {
            type: "Point",
            coordinates: coords,
          },
        })),
      },
    });

    map.addLayer({
      id: PARTICLE_LAYER_ID,
      type: "circle",
      source: PARTICLE_SOURCE_ID,
      paint: {
        "circle-radius": 4,
        "circle-color": "#F59E0B",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#FEF3C7",
        "circle-opacity": 0.95,
      },
    });

    // 6. Create Distinctive Endpoint HTML Markers
    // Seller Endpoint (Amber / Solar Source)
    const sellerEl = document.createElement("div");
    sellerEl.className = "flex flex-col items-center z-40 cursor-pointer pointer-events-auto";
    sellerEl.innerHTML = `
      <div class="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-mono font-bold text-[10px] shadow-lg flex items-center gap-1">
        <span class="h-1.5 w-1.5 rounded-full bg-slate-950 animate-pulse"></span>
        <span>SELLER: ${sellerName}</span>
      </div>
      <div class="h-3 w-0.5 bg-amber-500"></div>
      <div class="h-2 w-2 rounded-full bg-amber-400 ring-4 ring-amber-500/30"></div>
    `;
    const sellerMarker = new Marker({ element: sellerEl })
      .setLngLat(sellerCoords)
      .addTo(map);

    // Buyer Endpoint (Blue / Consumer Sink)
    const buyerEl = document.createElement("div");
    buyerEl.className = "flex flex-col items-center z-40 cursor-pointer pointer-events-auto";
    buyerEl.innerHTML = `
      <div class="px-2 py-0.5 rounded-md bg-blue-500 text-slate-950 font-mono font-bold text-[10px] shadow-lg flex items-center gap-1">
        <span class="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>
        <span>BUYER: ${buyerName}</span>
      </div>
      <div class="h-3 w-0.5 bg-blue-500"></div>
      <div class="h-2 w-2 rounded-full bg-blue-400 ring-4 ring-blue-500/30"></div>
    `;
    const buyerMarker = new Marker({ element: buyerEl })
      .setLngLat(buyerCoords)
      .addTo(map);

    tradeMarkersRef.current = [sellerMarker, buyerMarker];

    // 7. Auto-fit bounds to frame the trade path comfortably
    const tradeBounds = new LngLatBounds();
    tradeBounds.extend(sellerCoords);
    tradeBounds.extend(buyerCoords);
    map.fitBounds(tradeBounds, {
      padding: { top: 90, bottom: 90, left: 90, right: 360 },
      maxZoom: 14.5,
      duration: 900,
    });

    // 8. Subtle Particle Movement Animation via requestAnimationFrame
    let progress = 0;
    const speed = 0.003; // Smooth, non-distracting pace
    const totalPts = curvedCoordinates.length;

    const animateParticles = () => {
      progress = (progress + speed) % 1;

      // Calculate positions for 3 evenly spaced particle pulses
      const offsets = [0, 0.33, 0.66];
      const newParticleFeatures = offsets.map((off, i) => {
        const t = (progress + off) % 1;
        const idx = Math.min(Math.floor(t * (totalPts - 1)), totalPts - 1);
        return {
          type: "Feature" as const,
          properties: { id: i },
          geometry: {
            type: "Point" as const,
            coordinates: curvedCoordinates[idx],
          },
        };
      });

      const particleSource = map.getSource(PARTICLE_SOURCE_ID) as any;
      if (particleSource && particleSource.setData) {
        particleSource.setData({
          type: "FeatureCollection",
          features: newParticleFeatures,
        });
      }

      animFrameIdRef.current = requestAnimationFrame(animateParticles);
    };

    animFrameIdRef.current = requestAnimationFrame(animateParticles);

    return () => {
      cleanupLayers();
    };
  }, [mapLoaded, activeTradeFlow]);

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

      {/* Active Trade Flow Contextual Info Overlay (Step 6) */}
      {activeTradeFlow && (
        <div className="absolute bottom-6 right-4 z-10 p-3.5 rounded-xl bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 shadow-2xl text-xs font-mono max-w-sm space-y-2">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Zap className="h-3.5 w-3.5 fill-emerald-400" />
              <span>ACTIVE TRADE FLOW</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              #{activeTradeFlow.tradeId.substring(0, 8)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400 block text-[10px]">Seller Node</span>
              <strong className="text-amber-300 font-sans font-semibold truncate block">
                {activeTradeFlow.sellerName}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Buyer Node</span>
              <strong className="text-blue-300 font-sans font-semibold truncate block">
                {activeTradeFlow.buyerName}
              </strong>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-[11px]">
            <span>
              Transfer: <strong className="text-slate-100">{activeTradeFlow.energyKwh} kWh</strong>
            </span>
            <span>
              Tariff: <strong className="text-emerald-400">₹{activeTradeFlow.unitPrice.toFixed(2)}/kWh</strong>
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] text-slate-400">
            <span>Status: <span className="text-slate-200 uppercase font-bold">{activeTradeFlow.status.replace("_", " ")}</span></span>
            {activeTradeFlow.isAnchored ? (
              <span className="text-emerald-400 flex items-center gap-1 font-bold">
                <Blocks className="h-3 w-3" /> Anchored
              </span>
            ) : activeTradeFlow.isFullyVerified ? (
              <span className="text-indigo-400 flex items-center gap-1 font-bold">
                <ShieldCheck className="h-3 w-3" /> Verified
              </span>
            ) : (
              <span className="text-amber-400">Pending Signatures</span>
            )}
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
