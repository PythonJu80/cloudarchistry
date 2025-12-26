"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Location } from "@/app/world/page";
import type { GlobeInstance } from "react-globe.gl";

// Business hub locations - each gets a marker on the globe
const BUSINESS_HUBS = [
  // EUROPE - Western
  { id: "london", name: "London", flag: "GB", lat: 51.5074, lng: -0.1278, color: "rgba(59, 130, 246, 0.6)", borderColor: "#3b82f6", businesses: "450K+" },
  { id: "paris", name: "Paris", flag: "FR", lat: 48.8566, lng: 2.3522, color: "rgba(59, 130, 246, 0.6)", borderColor: "#3b82f6", businesses: "380K+" },
  { id: "berlin", name: "Berlin", flag: "DE", lat: 52.5200, lng: 13.4050, color: "rgba(59, 130, 246, 0.6)", borderColor: "#3b82f6", businesses: "290K+" },
  { id: "amsterdam", name: "Amsterdam", flag: "NL", lat: 52.3676, lng: 4.9041, color: "rgba(59, 130, 246, 0.6)", borderColor: "#3b82f6", businesses: "180K+" },
  { id: "madrid", name: "Madrid", flag: "ES", lat: 40.4168, lng: -3.7038, color: "rgba(59, 130, 246, 0.6)", borderColor: "#3b82f6", businesses: "220K+" },
  { id: "milan", name: "Milan", flag: "IT", lat: 45.4642, lng: 9.1900, color: "rgba(59, 130, 246, 0.6)", borderColor: "#3b82f6", businesses: "195K+" },
  { id: "zurich", name: "Zurich", flag: "CH", lat: 47.3769, lng: 8.5417, color: "rgba(59, 130, 246, 0.6)", borderColor: "#3b82f6", businesses: "85K+" },
  { id: "dublin", name: "Dublin", flag: "IE", lat: 53.3498, lng: -6.2603, color: "rgba(59, 130, 246, 0.6)", borderColor: "#3b82f6", businesses: "120K+" },
  { id: "stockholm", name: "Stockholm", flag: "SE", lat: 59.3293, lng: 18.0686, color: "rgba(59, 130, 246, 0.6)", borderColor: "#3b82f6", businesses: "95K+" },
  { id: "vienna", name: "Vienna", flag: "AT", lat: 48.2082, lng: 16.3738, color: "rgba(59, 130, 246, 0.6)", borderColor: "#3b82f6", businesses: "75K+" },
  // EUROPE - Eastern
  { id: "warsaw", name: "Warsaw", flag: "PL", lat: 52.2297, lng: 21.0122, color: "rgba(59, 130, 246, 0.6)", borderColor: "#3b82f6", businesses: "110K+" },
  { id: "prague", name: "Prague", flag: "CZ", lat: 50.0755, lng: 14.4378, color: "rgba(59, 130, 246, 0.6)", borderColor: "#3b82f6", businesses: "85K+" },
  { id: "moscow", name: "Moscow", flag: "RU", lat: 55.7558, lng: 37.6173, color: "rgba(59, 130, 246, 0.6)", borderColor: "#3b82f6", businesses: "320K+" },
  
  // NORTH AMERICA - USA
  { id: "new-york", name: "New York", flag: "US", lat: 40.7128, lng: -74.0060, color: "rgba(239, 68, 68, 0.6)", borderColor: "#ef4444", businesses: "890K+" },
  { id: "los-angeles", name: "Los Angeles", flag: "US", lat: 34.0522, lng: -118.2437, color: "rgba(239, 68, 68, 0.6)", borderColor: "#ef4444", businesses: "520K+" },
  { id: "san-francisco", name: "San Francisco", flag: "US", lat: 37.7749, lng: -122.4194, color: "rgba(239, 68, 68, 0.6)", borderColor: "#ef4444", businesses: "340K+" },
  { id: "chicago", name: "Chicago", flag: "US", lat: 41.8781, lng: -87.6298, color: "rgba(239, 68, 68, 0.6)", borderColor: "#ef4444", businesses: "410K+" },
  { id: "houston", name: "Houston", flag: "US", lat: 29.7604, lng: -95.3698, color: "rgba(239, 68, 68, 0.6)", borderColor: "#ef4444", businesses: "380K+" },
  { id: "miami", name: "Miami", flag: "US", lat: 25.7617, lng: -80.1918, color: "rgba(239, 68, 68, 0.6)", borderColor: "#ef4444", businesses: "210K+" },
  { id: "seattle", name: "Seattle", flag: "US", lat: 47.6062, lng: -122.3321, color: "rgba(239, 68, 68, 0.6)", borderColor: "#ef4444", businesses: "180K+" },
  { id: "boston", name: "Boston", flag: "US", lat: 42.3601, lng: -71.0589, color: "rgba(239, 68, 68, 0.6)", borderColor: "#ef4444", businesses: "165K+" },
  { id: "atlanta", name: "Atlanta", flag: "US", lat: 33.7490, lng: -84.3880, color: "rgba(239, 68, 68, 0.6)", borderColor: "#ef4444", businesses: "195K+" },
  { id: "denver", name: "Denver", flag: "US", lat: 39.7392, lng: -104.9903, color: "rgba(239, 68, 68, 0.6)", borderColor: "#ef4444", businesses: "140K+" },
  // NORTH AMERICA - Canada
  { id: "toronto", name: "Toronto", flag: "CA", lat: 43.6532, lng: -79.3832, color: "rgba(239, 68, 68, 0.6)", borderColor: "#ef4444", businesses: "290K+" },
  { id: "vancouver", name: "Vancouver", flag: "CA", lat: 49.2827, lng: -123.1207, color: "rgba(239, 68, 68, 0.6)", borderColor: "#ef4444", businesses: "150K+" },
  { id: "montreal", name: "Montreal", flag: "CA", lat: 45.5017, lng: -73.5673, color: "rgba(239, 68, 68, 0.6)", borderColor: "#ef4444", businesses: "125K+" },
  // NORTH AMERICA - Mexico
  { id: "mexico-city", name: "Mexico City", flag: "MX", lat: 19.4326, lng: -99.1332, color: "rgba(239, 68, 68, 0.6)", borderColor: "#ef4444", businesses: "280K+" },
  
  // ASIA - East
  { id: "tokyo", name: "Tokyo", flag: "JP", lat: 35.6762, lng: 139.6503, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "720K+" },
  { id: "osaka", name: "Osaka", flag: "JP", lat: 34.6937, lng: 135.5023, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "280K+" },
  { id: "shanghai", name: "Shanghai", flag: "CN", lat: 31.2304, lng: 121.4737, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "680K+" },
  { id: "beijing", name: "Beijing", flag: "CN", lat: 39.9042, lng: 116.4074, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "590K+" },
  { id: "shenzhen", name: "Shenzhen", flag: "CN", lat: 22.5431, lng: 114.0579, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "420K+" },
  { id: "hong-kong", name: "Hong Kong", flag: "HK", lat: 22.3193, lng: 114.1694, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "350K+" },
  { id: "seoul", name: "Seoul", flag: "KR", lat: 37.5665, lng: 126.9780, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "410K+" },
  { id: "taipei", name: "Taipei", flag: "TW", lat: 25.0330, lng: 121.5654, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "185K+" },
  // ASIA - Southeast
  { id: "singapore", name: "Singapore", flag: "SG", lat: 1.3521, lng: 103.8198, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "280K+" },
  { id: "bangkok", name: "Bangkok", flag: "TH", lat: 13.7563, lng: 100.5018, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "195K+" },
  { id: "jakarta", name: "Jakarta", flag: "ID", lat: -6.2088, lng: 106.8456, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "240K+" },
  { id: "kuala-lumpur", name: "Kuala Lumpur", flag: "MY", lat: 3.1390, lng: 101.6869, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "165K+" },
  { id: "manila", name: "Manila", flag: "PH", lat: 14.5995, lng: 120.9842, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "180K+" },
  { id: "ho-chi-minh", name: "Ho Chi Minh", flag: "VN", lat: 10.8231, lng: 106.6297, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "145K+" },
  // ASIA - South
  { id: "mumbai", name: "Mumbai", flag: "IN", lat: 19.0760, lng: 72.8777, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "350K+" },
  { id: "delhi", name: "New Delhi", flag: "IN", lat: 28.6139, lng: 77.2090, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "310K+" },
  { id: "bangalore", name: "Bangalore", flag: "IN", lat: 12.9716, lng: 77.5946, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "220K+" },
  // ASIA - Middle East
  { id: "dubai", name: "Dubai", flag: "AE", lat: 25.2048, lng: 55.2708, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "195K+" },
  { id: "tel-aviv", name: "Tel Aviv", flag: "IL", lat: 32.0853, lng: 34.7818, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "85K+" },
  { id: "riyadh", name: "Riyadh", flag: "SA", lat: 24.7136, lng: 46.6753, color: "rgba(249, 115, 22, 0.6)", borderColor: "#f97316", businesses: "120K+" },
  
  // OCEANIA
  { id: "sydney", name: "Sydney", flag: "AU", lat: -33.8688, lng: 151.2093, color: "rgba(20, 184, 166, 0.6)", borderColor: "#14b8a6", businesses: "180K+" },
  { id: "melbourne", name: "Melbourne", flag: "AU", lat: -37.8136, lng: 144.9631, color: "rgba(20, 184, 166, 0.6)", borderColor: "#14b8a6", businesses: "150K+" },
  { id: "brisbane", name: "Brisbane", flag: "AU", lat: -27.4698, lng: 153.0251, color: "rgba(20, 184, 166, 0.6)", borderColor: "#14b8a6", businesses: "85K+" },
  { id: "perth", name: "Perth", flag: "AU", lat: -31.9505, lng: 115.8605, color: "rgba(20, 184, 166, 0.6)", borderColor: "#14b8a6", businesses: "70K+" },
  { id: "auckland", name: "Auckland", flag: "NZ", lat: -36.8509, lng: 174.7645, color: "rgba(20, 184, 166, 0.6)", borderColor: "#14b8a6", businesses: "65K+" },
  { id: "wellington", name: "Wellington", flag: "NZ", lat: -41.2865, lng: 174.7762, color: "rgba(20, 184, 166, 0.6)", borderColor: "#14b8a6", businesses: "35K+" },
  
  // SOUTH AMERICA
  { id: "sao-paulo", name: "Sao Paulo", flag: "BR", lat: -23.5505, lng: -46.6333, color: "rgba(34, 197, 94, 0.6)", borderColor: "#22c55e", businesses: "420K+" },
  { id: "rio", name: "Rio de Janeiro", flag: "BR", lat: -22.9068, lng: -43.1729, color: "rgba(34, 197, 94, 0.6)", borderColor: "#22c55e", businesses: "180K+" },
  { id: "buenos-aires", name: "Buenos Aires", flag: "AR", lat: -34.6037, lng: -58.3816, color: "rgba(34, 197, 94, 0.6)", borderColor: "#22c55e", businesses: "210K+" },
  { id: "bogota", name: "Bogota", flag: "CO", lat: 4.7110, lng: -74.0721, color: "rgba(34, 197, 94, 0.6)", borderColor: "#22c55e", businesses: "140K+" },
  { id: "santiago", name: "Santiago", flag: "CL", lat: -33.4489, lng: -70.6693, color: "rgba(34, 197, 94, 0.6)", borderColor: "#22c55e", businesses: "120K+" },
  { id: "lima", name: "Lima", flag: "PE", lat: -12.0464, lng: -77.0428, color: "rgba(34, 197, 94, 0.6)", borderColor: "#22c55e", businesses: "95K+" },
  { id: "medellin", name: "Medellin", flag: "CO", lat: 6.2442, lng: -75.5812, color: "rgba(34, 197, 94, 0.6)", borderColor: "#22c55e", businesses: "65K+" },
  
  // AFRICA
  { id: "johannesburg", name: "Johannesburg", flag: "ZA", lat: -26.2041, lng: 28.0473, color: "rgba(168, 85, 247, 0.6)", borderColor: "#a855f7", businesses: "95K+" },
  { id: "cairo", name: "Cairo", flag: "EG", lat: 30.0444, lng: 31.2357, color: "rgba(168, 85, 247, 0.6)", borderColor: "#a855f7", businesses: "110K+" },
  { id: "lagos", name: "Lagos", flag: "NG", lat: 6.5244, lng: 3.3792, color: "rgba(168, 85, 247, 0.6)", borderColor: "#a855f7", businesses: "85K+" },
  { id: "nairobi", name: "Nairobi", flag: "KE", lat: -1.2921, lng: 36.8219, color: "rgba(168, 85, 247, 0.6)", borderColor: "#a855f7", businesses: "60K+" },
  { id: "cape-town", name: "Cape Town", flag: "ZA", lat: -33.9249, lng: 18.4241, color: "rgba(168, 85, 247, 0.6)", borderColor: "#a855f7", businesses: "55K+" },
  { id: "casablanca", name: "Casablanca", flag: "MA", lat: 33.5731, lng: -7.5898, color: "rgba(168, 85, 247, 0.6)", borderColor: "#a855f7", businesses: "70K+" },
  { id: "accra", name: "Accra", flag: "GH", lat: 5.6037, lng: -0.1870, color: "rgba(168, 85, 247, 0.6)", borderColor: "#a855f7", businesses: "45K+" },
  { id: "addis-ababa", name: "Addis Ababa", flag: "ET", lat: 9.0320, lng: 38.7469, color: "rgba(168, 85, 247, 0.6)", borderColor: "#a855f7", businesses: "40K+" },
];

interface Globe3DProps {
  locations: Location[];
  selectedLocation: Location | null;
  onLocationSelect: (location: Location) => void;
  visitedLocations: string[];
  onZoomIn?: (lat: number, lng: number) => void;
  onContinentSelect?: (continentId: string) => void;
}

export default function Globe3D({
  locations,
  selectedLocation,
  onLocationSelect,
  visitedLocations,
  onZoomIn,
  onContinentSelect,
}: Globe3DProps) {
  const globeRef = useRef<HTMLDivElement>(null);
  const globeInstanceRef = useRef<GlobeInstance | null>(null);
  const [isClient, setIsClient] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [GlobeModule, setGlobeModule] = useState<React.ComponentType<any> | null>(null);
  const [hoveredContinent, setHoveredContinent] = useState<string | null>(null);
  const [selectedContinent, setSelectedContinent] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Load Globe.gl dynamically (client-side only)
  useEffect(() => {
    setIsClient(true);
    import("react-globe.gl").then((mod) => {
      setGlobeModule(() => mod.default);
    });
  }, []);

  // Track container dimensions with ResizeObserver
  useEffect(() => {
    if (!globeRef.current) return;
    
    const updateDimensions = () => {
      if (globeRef.current) {
        const rect = globeRef.current.getBoundingClientRect();
        const width = rect.width || globeRef.current.clientWidth || 800;
        const height = rect.height || globeRef.current.clientHeight || window.innerHeight;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    };
    
    // Initial measurement after a brief delay to ensure layout is complete
    updateDimensions();
    const initialTimeout = setTimeout(updateDimensions, 100);
    
    // Watch for resize
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(globeRef.current);
    
    // Also listen to window resize as fallback
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      clearTimeout(initialTimeout);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [isClient, GlobeModule]);

  const [isZooming, setIsZooming] = useState(false);
  const [zoomingTo, setZoomingTo] = useState<string | null>(null);

  // Handle continent click - smooth zoom animation then transition to Leaflet
  const handleContinentClick = useCallback((continent: typeof BUSINESS_HUBS[0]) => {
    if (isZooming) return; // Prevent double-clicks
    
    setSelectedContinent(continent.id);
    setIsZooming(true);
    setZoomingTo(continent.name);
    
    if (onContinentSelect) {
      onContinentSelect(continent.id);
    }
    
    // Animate zoom into the capital city
    if (globeInstanceRef.current) {
      const globe = globeInstanceRef.current;
      
      // Stop auto-rotation
      globe.controls().autoRotate = false;
      
      // Phase 1: Zoom to continent (1.5s)
      globe.pointOfView(
        { lat: continent.lat, lng: continent.lng, altitude: 0.8 },
        1500
      );
      
      // Phase 2: Zoom closer (after 1.5s)
      setTimeout(() => {
        globe.pointOfView(
          { lat: continent.lat, lng: continent.lng, altitude: 0.15 },
          1500
        );
      }, 1500);
      
      // Phase 3: Transition to Leaflet (after 3s total)
      setTimeout(() => {
        setIsZooming(false);
        setZoomingTo(null);
        if (onZoomIn) {
          onZoomIn(continent.lat, continent.lng);
        }
      }, 3000);
    }
  }, [onContinentSelect, onZoomIn, isZooming]);

  // Continent label data for the globe
  const continentLabels = BUSINESS_HUBS.map((c) => ({
    ...c,
    altitude: 0.01,
  }));

  // Auto-rotate and initial position
  useEffect(() => {
    if (globeInstanceRef.current) {
      const globe = globeInstanceRef.current;
      
      // Set initial view to show Europe/London area
      globe.pointOfView({ lat: 30, lng: 0, altitude: 2.5 }, 0);
      
      // Enable auto-rotation
      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.3;
      // Disable zoom - click continent to transition to Leaflet
      globe.controls().enableZoom = false;
      globe.controls().minDistance = 250;
      globe.controls().maxDistance = 250;
      
      // Stop rotation on interaction
      const stopRotation = () => {
        globe.controls().autoRotate = false;
      };
      
      // Listen for zoom and switch to Leaflet when zoomed in enough
      const controls = globe.controls();
      
      const checkZoom = () => {
        const distance = controls.getDistance();
        if (distance < 130 && distance > 0 && onZoomIn) {
          const pov = globe.pointOfView();
          onZoomIn(pov.lat, pov.lng);
        }
      };
      
      controls.addEventListener("change", checkZoom);
      
      const currentRef = globeRef.current;
      currentRef?.addEventListener("mousedown", stopRotation);
      currentRef?.addEventListener("touchstart", stopRotation);
      
      return () => {
        controls.removeEventListener("change", checkZoom);
        currentRef?.removeEventListener("mousedown", stopRotation);
        currentRef?.removeEventListener("touchstart", stopRotation);
      };
    }
  }, [GlobeModule, onZoomIn]);

  // Focus on selected location
  useEffect(() => {
    if (selectedLocation && globeInstanceRef.current) {
      globeInstanceRef.current.pointOfView(
        { lat: selectedLocation.lat, lng: selectedLocation.lng, altitude: 0.5 },
        1500
      );
    }
  }, [selectedLocation]);

  if (!isClient || !GlobeModule || !dimensions) {
    return (
      <div ref={globeRef} className="w-full h-full bg-slate-950 relative">
        <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground">
          Initializing 3D Globe...
        </p>
      </div>
    );
  }

  const Globe = GlobeModule;

  return (
    <div ref={globeRef} className="w-full h-full relative overflow-hidden" style={{ cursor: "grab" }}>
      <Globe
        ref={globeInstanceRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        
        // Atmosphere
        atmosphereColor="#22d3ee"
        atmosphereAltitude={0.15}
        
        // Continent Labels with Flags (HTML - floating style)
        htmlElementsData={continentLabels}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude="altitude"
        htmlElement={(d: typeof BUSINESS_HUBS[0] & { size: number }) => {
          const el = document.createElement("div");
          el.className = "continent-marker";
          el.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            pointer-events: auto !important;
          `;
          el.innerHTML = `
            <div style="
              position: relative;
              width: 60px;
              height: 60px;
              display: flex;
              align-items: center;
              justify-content: center;
              pointer-events: auto;
            ">
              <div style="
                position: absolute;
                inset: -8px;
                border-radius: 50%;
                background: radial-gradient(circle, ${d.color} 0%, transparent 70%);
                animation: pulse 2s ease-in-out infinite;
                pointer-events: none;
              "></div>
              <div style="
                position: absolute;
                inset: 0;
                border-radius: 50%;
                border: 2px solid ${d.borderColor};
                opacity: 0.8;
                pointer-events: none;
              "></div>
              <img src="https://flagcdn.com/w40/${d.flag.toLowerCase()}.png" alt="${d.flag}" style="width: 28px; height: 20px; object-fit: cover; border-radius: 3px; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5)); pointer-events: auto;" />
            </div>
            <div style="
              margin-top: 8px;
              padding: 6px 14px;
              background: rgba(0, 0, 0, 0.8);
              backdrop-filter: blur(8px);
              border-radius: 20px;
              border: 1px solid ${d.borderColor}50;
              text-align: center;
              white-space: nowrap;
              pointer-events: auto;
            ">
              <div style="color: white; font-weight: 700; font-size: 12px; pointer-events: none;">${d.name}</div>
            </div>
          `;
          // Prevent event bubbling to globe
          el.onpointerdown = (e) => e.stopPropagation();
          el.onmousedown = (e) => e.stopPropagation();
          el.ontouchstart = (e) => e.stopPropagation();
          
          el.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            handleContinentClick(d);
          };
          el.onmouseenter = () => {
            setHoveredContinent(d.id);
            // Bring to front and scale up on hover
            el.style.zIndex = "9999";
            el.style.transform = "scale(1.3)";
            el.style.transition = "transform 0.2s ease";
            if (globeRef.current) {
              globeRef.current.style.cursor = "pointer";
            }
          };
          el.onmouseleave = () => {
            setHoveredContinent(null);
            // Reset z-index and scale
            el.style.zIndex = "1";
            el.style.transform = "scale(1)";
            if (globeRef.current) {
              globeRef.current.style.cursor = "grab";
            }
          };
          return el;
        }}
        
        // Performance
        animateIn={true}
        width={dimensions.width}
        height={dimensions.height}
      />
      
      {/* Zoom Animation Overlay */}
      {isZooming && zoomingTo && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
          <div className="bg-background/80 backdrop-blur-xl rounded-2xl px-8 py-6 border border-cyan-500/30 shadow-2xl animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin" />
              <div>
                <div className="text-lg font-bold text-foreground">Traveling to {zoomingTo}</div>
                <div className="text-sm text-muted-foreground">Entering business district...</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected Continent Panel */}
      {selectedContinent && !isZooming && (
        <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-xl rounded-xl p-4 border border-border/50 shadow-2xl z-50 min-w-[200px]">
          {(() => {
            const c = BUSINESS_HUBS.find(cont => cont.id === selectedContinent);
            if (!c) return null;
            return (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl">{c.flag}</span>
                  <div>
                    <div className="font-bold text-lg">{c.name}</div>
                    <div className="text-sm text-muted-foreground">{c.businesses} businesses</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedContinent(null);
                    if (globeInstanceRef.current) {
                      globeInstanceRef.current.pointOfView({ lat: 30, lng: 0, altitude: 2.5 }, 1500);
                    }
                  }}
                  className="w-full py-2 px-3 bg-secondary/50 hover:bg-secondary rounded-lg text-sm transition-colors"
                >
                  ← Back to Globe
                </button>
              </>
            );
          })()}
        </div>
      )}
      
      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/60 backdrop-blur-sm rounded-full px-4 py-2 text-xs text-muted-foreground">
        🌍 Drag to rotate • Click a continent to explore businesses
      </div>
      
      {/* Pulse animation style */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
