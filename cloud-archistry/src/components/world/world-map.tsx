"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Location } from "@/app/world/page";

// Business from Google Places
export interface Business {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
  rating?: number;
  totalRatings?: number;
  icon?: string;
  photo?: string;
  openNow?: boolean;
}

// Fix Leaflet default icon issue - kept for reference
// const defaultIcon = L.icon({
//   iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
//   iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
//   shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
//   iconSize: [25, 41],
//   iconAnchor: [12, 41],
//   popupAnchor: [1, -34],
//   shadowSize: [41, 41],
// });

// Custom marker icons based on industry
const createCustomIcon = (industry: string, isSelected: boolean, isVisited: boolean) => {
  const colors: Record<string, string> = {
    "Banking & Finance": "#22d3ee",
    "Healthcare": "#4ade80",
    "Technology": "#a78bfa",
    "Social Media": "#60a5fa",
    "E-Commerce": "#fbbf24",
    "Media & Streaming": "#f87171",
    "Gaming": "#c084fc",
    "Automotive": "#fb923c",
    "Logistics & Aviation": "#2dd4bf",
    "Retail & Luxury": "#f472b6",
  };

  const color = colors[industry] || "#22d3ee";
  const size = isSelected ? 40 : 30;
  const glowSize = isSelected ? 60 : 0;

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px;">
        ${isSelected ? `
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: ${glowSize}px;
            height: ${glowSize}px;
            background: radial-gradient(circle, ${color}40 0%, transparent 70%);
            border-radius: 50%;
            animation: pulse 2s ease-in-out infinite;
          "></div>
        ` : ""}
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: ${size}px;
          height: ${size}px;
          background: ${isVisited ? color : `${color}80`};
          border: 3px solid ${isSelected ? "#fff" : color};
          border-radius: 50%;
          box-shadow: 0 0 ${isSelected ? 20 : 10}px ${color}80;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        ">
          <div style="
            width: ${size * 0.4}px;
            height: ${size * 0.4}px;
            background: white;
            border-radius: 50%;
          "></div>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Map controller component to handle view changes
function MapController({ 
  center, 
  zoom, 
  selectedLocation,
  onZoomOut,
}: { 
  center: [number, number]; 
  zoom: number;
  selectedLocation: Location | null;
  onZoomOut?: () => void;
}) {
  const map = useMap();
  const initialPositionSet = useRef(false);
  const lastCenter = useRef<string>("");
  
  useEffect(() => {
    const centerKey = `${center[0]},${center[1]}`;
    
    // Only set view on initial load or when center actually changes (new city selected from globe)
    if (!initialPositionSet.current || lastCenter.current !== centerKey) {
      map.setView(center, zoom);
      initialPositionSet.current = true;
      lastCenter.current = centerKey;
      return;
    }
    
    // Only fly to location if a system location is selected
    if (selectedLocation) {
      map.flyTo([selectedLocation.lat, selectedLocation.lng], 15, {
        duration: 2,
      });
    }
    // Don't fly anywhere when selectedLocation becomes null - let user control the map
  }, [map, center, zoom, selectedLocation]);

  // Listen for zoom changes and switch to globe when zoomed out
  useEffect(() => {
    const handleZoomEnd = () => {
      const currentZoom = map.getZoom();
      if (currentZoom < 5 && onZoomOut) {
        onZoomOut();
      }
    };

    map.on("zoomend", handleZoomEnd);
    return () => {
      map.off("zoomend", handleZoomEnd);
    };
  }, [map, onZoomOut]);

  return null;
}

// Map Google place types to industry - UNIFIED with system challenges
export const mapTypeToIndustry = (types: string[]): string => {
  for (const type of types) {
    if (["bank", "finance", "accounting", "insurance_agency", "atm"].includes(type)) return "Banking & Finance";
    if (["hospital", "doctor", "dentist", "pharmacy", "health"].includes(type)) return "Healthcare";
    if (["electronics_store", "computer_store"].includes(type)) return "Technology";
    if (["store", "shopping_mall", "clothing_store", "department_store", "supermarket"].includes(type)) return "Retail";
    if (["restaurant", "cafe", "bar", "bakery", "food", "hotel", "lodging", "gym", "spa", "beauty_salon"].includes(type)) return "Hospitality";
    if (["car_dealer", "car_rental", "car_repair", "gas_station"].includes(type)) return "Automotive";
    if (["school", "university", "library"].includes(type)) return "Education";
    if (["lawyer", "real_estate_agency"].includes(type)) return "Professional Services";
    if (["travel_agency", "airport"].includes(type)) return "Aviation";
  }
  return "Business";
};

// Business marker icon - matches existing style
const createBusinessIcon = (business: Business, isSelected: boolean = false) => {
  const industry = mapTypeToIndustry(business.types);
  const colors: Record<string, string> = {
    "Banking & Finance": "#22d3ee",
    "Healthcare": "#4ade80",
    "Technology": "#a78bfa",
    "Retail": "#fbbf24",
    "Hospitality": "#f87171",
    "Automotive": "#fb923c",
    "Education": "#60a5fa",
    "E-Commerce": "#fbbf24",
    "Aviation": "#2dd4bf",
    "Professional Services": "#f472b6",
    "Business": "#22d3ee",
  };

  const color = colors[industry] || "#22d3ee";
  const size = isSelected ? 28 : 22;
  const dotSize = isSelected ? 10 : 8;
  
  return L.divIcon({
    className: "business-marker",
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color}40;
        border: 2px solid ${color};
        border-radius: 50%;
        box-shadow: 0 0 10px ${color}60;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      ">
        <div style="
          width: ${dotSize}px;
          height: ${dotSize}px;
          background: ${color};
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

// Component to fetch and display nearby businesses
function BusinessMarkers({ 
  center, 
  onSelect,
  selectedId,
  activeIndustries,
}: { 
  center: { lat: number; lng: number } | null;
  onSelect?: (business: Business) => void;
  selectedId?: string;
  activeIndustries?: Set<string>;
}) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!center) return;

    const fetchBusinesses = async () => {
      setLoading(true);
      try {
        // Fetch multiple types to get variety
        const types = ["bank", "hospital", "store", "restaurant", "hotel", "car_dealer", "school", "pharmacy", "gym", "cafe", "airport"];
        const allBusinesses: Business[] = [];
        
        // Fetch each type in parallel for speed
        const promises = types.map(type => 
          fetch(`/api/places/nearby?lat=${center.lat}&lng=${center.lng}&radius=5000&type=${type}`)
            .then(res => res.json())
            .catch(() => ({ businesses: [] }))
        );
        
        const results = await Promise.all(promises);
        
        for (const data of results) {
          if (data.businesses) {
            allBusinesses.push(...data.businesses.slice(0, 8)); // 8 per type
          }
        }
        
        // Remove duplicates by id
        const unique = allBusinesses.filter((b, i, arr) => 
          arr.findIndex(x => x.id === b.id) === i
        );
        
        setBusinesses(unique);
      } catch (err) {
        console.error("Failed to fetch businesses:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBusinesses();
  }, [center]);

  if (loading) {
    return null;
  }

  // Helper to get industry from business types
  const getIndustry = (types: string[]): string => {
    for (const type of types) {
      if (["bank", "finance", "atm", "accounting", "insurance_agency"].includes(type)) return "Finance";
      if (["hospital", "doctor", "dentist", "pharmacy", "health"].includes(type)) return "Healthcare";
      if (["electronics_store", "computer_store"].includes(type)) return "Technology";
      if (["store", "shopping_mall", "clothing_store", "supermarket"].includes(type)) return "Retail";
      if (["restaurant", "cafe", "bar", "bakery", "food", "hotel", "lodging", "gym", "spa", "beauty_salon"].includes(type)) return "Hospitality";
      if (["car_dealer", "car_rental", "car_repair", "gas_station"].includes(type)) return "Automotive";
      if (["school", "university", "library"].includes(type)) return "Education";
      if (["travel_agency", "airport", "transit_station"].includes(type)) return "Aviation";
    }
    return "Technology"; // Default
  };

  // Filter businesses by active industries
  const filteredBusinesses = activeIndustries 
    ? businesses.filter(b => activeIndustries.has(getIndustry(b.types)))
    : businesses;

  return (
    <>
      {filteredBusinesses.map((business) => (
        <Marker
          key={business.id}
          position={[business.lat, business.lng]}
          icon={createBusinessIcon(business, selectedId === business.id)}
          eventHandlers={{
            click: () => onSelect?.(business),
          }}
        >
          {/* Google Maps style popup */}
          <Popup className="business-popup" closeButton={false}>
            <div className="w-64">
              {/* Business Photo */}
              {business.photo ? (
                <div className="w-full h-32 rounded-t-lg overflow-hidden">
                  <img 
                    src={business.photo} 
                    alt={business.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-20 rounded-t-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                  <span className="text-3xl">🏢</span>
                </div>
              )}
              {/* Business Info */}
              <div className="p-3">
                <h3 className="font-semibold text-sm text-white leading-tight">{business.name}</h3>
                {business.rating && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-sm text-white">{business.rating}</span>
                    <span className="text-yellow-400 text-xs">{"★".repeat(Math.round(business.rating))}</span>
                    {business.totalRatings && (
                      <span className="text-xs text-gray-400">({business.totalRatings})</span>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1.5">{business.address}</p>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

interface WorldMapProps {
  locations: Location[];
  selectedLocation: Location | null;
  onLocationSelect: (location: Location) => void;
  visitedLocations: string[];
  mapView: "globe" | "satellite";
  zoomLevel: number;
  onZoomOut?: () => void;
  center?: { lat: number; lng: number } | null;
  onBusinessSelect?: (business: Business | null) => void;
  selectedBusiness?: Business | null;
  activeIndustries?: Set<string>;
}

export default function WorldMap({
  locations,
  selectedLocation,
  onLocationSelect,
  visitedLocations,
  mapView,
  zoomLevel,
  onZoomOut,
  center,
  onBusinessSelect,
  selectedBusiness,
  activeIndustries,
}: WorldMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  
  // Check if we're on client side
  const [isClient] = useState(() => typeof window !== "undefined");
  
  // Close all popups when selectedBusiness is cleared
  useEffect(() => {
    if (!selectedBusiness && mapRef.current) {
      mapRef.current.closePopup();
    }
  }, [selectedBusiness]);

  // Create route polyline from visited locations
  const routeCoordinates = useMemo(() => {
    return visitedLocations
      .map((id) => {
        const loc = locations.find((l) => l.id === id);
        return loc ? [loc.lat, loc.lng] as [number, number] : null;
      })
      .filter((coord): coord is [number, number] => coord !== null);
  }, [visitedLocations, locations]);

  // Use passed center or default to London
  const mapCenter: [number, number] = center 
    ? [center.lat, center.lng] 
    : [51.5074, -0.1278];

  // Satellite tile layer (ESRI World Imagery - free)
  const satelliteTileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  
  // Dark map tile layer for globe view
  const darkTileUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  if (!isClient) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-cyan-500/40" />
          </div>
          <p className="text-muted-foreground">Initializing World Map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={mapCenter}
        zoom={zoomLevel}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
        ref={mapRef}
        style={{ background: "#0f172a" }}
      >
        {/* Tile Layer - switches between dark and satellite */}
        <TileLayer
          url={mapView === "satellite" ? satelliteTileUrl : darkTileUrl}
          attribution={mapView === "satellite" 
            ? "Tiles &copy; Esri" 
            : "&copy; CartoDB"
          }
        />

        {/* Map Controller for animations */}
        <MapController
          center={mapCenter}
          zoom={zoomLevel}
          selectedLocation={selectedLocation}
          onZoomOut={onZoomOut}
        />

        {/* Business markers from Google Places */}
        <BusinessMarkers 
          center={center || null} 
          onSelect={onBusinessSelect}
          selectedId={selectedBusiness?.id}
          activeIndustries={activeIndustries}
        />

        {/* Route Polyline showing journey */}
        {routeCoordinates.length > 1 && (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: "#22d3ee",
              weight: 3,
              opacity: 0.8,
              dashArray: "10, 10",
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        )}

        {/* Location Markers */}
        {locations.map((location) => {
          const isSelected = selectedLocation?.id === location.id;
          const isVisited = visitedLocations.includes(location.id);

          return (
            <Marker
              key={location.id}
              position={[location.lat, location.lng]}
              icon={createCustomIcon(location.industry, isSelected, isVisited)}
              eventHandlers={{
                click: () => onLocationSelect(location),
              }}
            >
              <Popup className="custom-popup">
                <div className="p-2 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{location.icon}</span>
                    <div>
                      <div className="font-bold text-foreground">{location.company}</div>
                      <div className="text-xs text-muted-foreground">{location.name}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {location.industry} • {location.difficulty}
                  </div>
                  <div className="text-xs">
                    {location.challenges} challenges available
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Globe overlay effect for globe view */}
      {mapView === "globe" && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Vignette effect */}
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-slate-950/50" />
          
          {/* Grid overlay */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(rgba(34, 211, 238, 0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(34, 211, 238, 0.3) 1px, transparent 1px)
              `,
              backgroundSize: "50px 50px",
            }}
          />
        </div>
      )}

      {/* Pulse animation for markers */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.15); }
        }
        .business-marker div[style*="animation"] {
          animation: pulse 2s ease-in-out infinite !important;
        }
      `}</style>

      {/* Coordinates display */}
      {selectedLocation && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm rounded-full px-4 py-2 border border-border/50 text-xs font-mono">
          {selectedLocation.lat.toFixed(4)}°N, {Math.abs(selectedLocation.lng).toFixed(4)}°{selectedLocation.lng >= 0 ? "E" : "W"}
        </div>
      )}
    </div>
  );
}
