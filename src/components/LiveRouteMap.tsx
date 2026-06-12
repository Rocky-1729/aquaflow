import React, { useEffect, useRef, useState } from 'react';
import { Compass, Navigation, MapPin, Truck, Home } from 'lucide-react';

interface LiveRouteMapProps {
  agentLat?: number;
  agentLon?: number;
  customerAddress?: string;
  etaMinutes?: number;
  orderStatus?: string;
}

// Hub Central Location coordinates
const DEPOT_LAT = 17.4062;
const DEPOT_LON = 78.4680;

export default function LiveRouteMap({
  agentLat = DEPOT_LAT,
  agentLon = DEPOT_LON,
  customerAddress = 'Customer Location',
  etaMinutes = 15,
  orderStatus = 'OUT_FOR_DELIVERY',
}: LiveRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [useFallback, setUseFallback] = useState(true);
  const mapInstanceRef = useRef<any>(null);
  const agentMarkerRef = useRef<any>(null);
  const depotMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);

  // We determine the customer coordinates based on agentLat and an offset so they line up beautifully
  // If the agent is simulating, they move from Depot to Customer. We'll set a custom location for the customer
  const destLat = DEPOT_LAT + 0.012;
  const destLon = DEPOT_LON + 0.015;

  // 1. Try to inject Leaflet if not present
  useEffect(() => {
    // Check if Leaflet is already loaded globally
    if ((window as any).L) {
      setLeafletLoaded(true);
      setUseFallback(false);
      return;
    }

    const loadLeaflet = async () => {
      try {
        // Link CSS
        if (!document.getElementById('leaflet-css')) {
          const cssLink = document.createElement('link');
          cssLink.id = 'leaflet-css';
          cssLink.rel = 'stylesheet';
          cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(cssLink);
        }

        // Script JS
        if (!document.getElementById('leaflet-js')) {
          const jsScript = document.createElement('script');
          jsScript.id = 'leaflet-js';
          jsScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          jsScript.async = true;
          document.body.appendChild(jsScript);

          jsScript.onload = () => {
            setLeafletLoaded(true);
            setUseFallback(false);
          };
        } else {
          // If already injected but waiting for load, check periodically
          const timer = setInterval(() => {
            if ((window as any).L) {
              setLeafletLoaded(true);
              setUseFallback(false);
              clearInterval(timer);
            }
          }, 300);
          return () => clearInterval(timer);
        }
      } catch (err) {
        console.warn('Could not load Leaflet from CDN. Falling back to high-fidelity SVG telemetry grid.', err);
        setUseFallback(true);
      }
    };

    loadLeaflet();

    // Set a timeout. If Leaflet fails to initialize after 3.5s, force fallback
    const timeout = setTimeout(() => {
      if (!(window as any).L) {
        setUseFallback(true);
      }
    }, 4000);

    return () => clearTimeout(timeout);
  }, []);

  // 2. Initialize vanilla Leaflet once available
  useEffect(() => {
    if (!leafletLoaded || useFallback || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    try {
      // Setup Map Instance
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapContainerRef.current, {
          zoomControl: false,
          scrollWheelZoom: true,
        }).setView([DEPOT_LAT, DEPOT_LON], 14);

        // Standard OSM Tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; CartoDB',
          maxZoom: 20,
        }).addTo(mapInstanceRef.current);

        // Add Zoom Control at right
        L.control.zoom({ position: 'bottomright' }).addTo(mapInstanceRef.current);

        // Icons
        const depotIcon = L.divIcon({
          className: 'custom-depot-marker',
          html: `<div class="bg-amber-500 text-white p-2 rounded-full border-2 border-white shadow-lg animate-pulse flex items-center justify-center" style="width:36px; height:36px;">💧</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const agentIcon = L.divIcon({
          className: 'custom-agent-marker',
          html: `<div class="bg-sky-500 text-white p-2 rounded-full border-2 border-white shadow-xl flex items-center justify-center transition-all duration-300 transform scale-110" style="width:40px; height:40px;">⚡</div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const customerIcon = L.divIcon({
          className: 'custom-customer-marker',
          html: `<div class="bg-emerald-500 text-white p-2 rounded-full border-2 border-white shadow-lg flex items-center justify-center" style="width:36px; height:36px;">🏡</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        // Add Depot, Customer, Agent Markers
        depotMarkerRef.current = L.marker([DEPOT_LAT, DEPOT_LON], { icon: depotIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup('Water Depot Headquarters (Dispatched Location)');

        customerMarkerRef.current = L.marker([destLat, destLon], { icon: customerIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup(`Customer Address: ${customerAddress}`);

        agentMarkerRef.current = L.marker([agentLat, agentLon], { icon: agentIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup(`<b>Delivery Agent</b><br>ETA: ${etaMinutes} mins`);

        // Draw Route Polyline
        routePolylineRef.current = L.polyline(
          [[DEPOT_LAT, DEPOT_LON], [agentLat, agentLon], [destLat, destLon]],
          { color: '#0ea5e9', weight: 4, dashArray: '5, 8', opacity: 0.8 }
        ).addTo(mapInstanceRef.current);
      } else {
        // Just update agent position & route polyline
        const currentAgentLatLng = [agentLat, agentLon];
        agentMarkerRef.current.setLatLng(currentAgentLatLng);
        agentMarkerRef.current.setPopupContent(`<b>Delivery Agent</b><br>ETA: ${etaMinutes} mins`);

        routePolylineRef.current.setLatLngs([
          [DEPOT_LAT, DEPOT_LON],
          currentAgentLatLng,
          [destLat, destLon],
        ]);

        // Auto pan map dynamically to fit markers
        const bounds = L.latLngBounds([
          [DEPOT_LAT, DEPOT_LON],
          currentAgentLatLng,
          [destLat, destLon],
        ]);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    } catch (e) {
      console.warn('Error rendering Leaflet directly, falling back to clean simulator grid.', e);
      setUseFallback(true);
    }
  }, [leafletLoaded, useFallback, agentLat, agentLon, destLat, destLon, customerAddress, etaMinutes]);

  // Calculate percentage progress along route based on agent coordinate
  const calcProgressPct = () => {
    const totalDist = Math.hypot(destLat - DEPOT_LAT, destLon - DEPOT_LON);
    const agentDist = Math.hypot(agentLat - DEPOT_LAT, agentLon - DEPOT_LON);
    let pct = Math.floor((agentDist / totalDist) * 100);
    if (pct > 100) pct = 100;
    if (pct < 0) pct = 0;
    return pct;
  };

  const progressPct = calcProgressPct();

  // Mode B: Interactive dashboard fallback
  return (
    <div className="relative w-full h-[380px] bg-slate-950 rounded-2xl overflow-hidden shadow-inner border border-slate-800">
      {/* MAP VIEWCONTAINER */}
      <div
        ref={mapContainerRef}
        className={`w-full h-full text-slate-800 ${useFallback ? 'hidden' : 'block'}`}
        id="leaflet-route-map-container"
      />

      {/* FALLBACK HIGH-TECH COORDINATE COMPASS CANVASES */}
      {useFallback && (
        <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white select-none">
          {/* Compass Track Details and Telemetry */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 animate-spin">
                <Compass className="h-4 w-4" />
              </span>
              <div>
                <h4 className="text-xs font-mono font-bold tracking-widest text-slate-400">SAT-TRACK NAVIGATION</h4>
                <p className="text-[10px] text-slate-500 font-mono">
                  AGENT COORDS: {agentLat.toFixed(5)}°N , {agentLon.toFixed(5)}°E
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
                SYS LIVE
              </span>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">SPEED: 26 km/h</p>
            </div>
          </div>

          {/* SVG Map Path Grid Graph */}
          <div className="flex-1 relative my-3 flex items-center justify-center">
            {/* Grid Coordinates BG */}
            <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 opacity-[0.03] pointer-events-none">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="border border-white" />
              ))}
            </div>

            {/* Radar Circle Beacons */}
            <div className="absolute h-48 w-48 border border-white/[0.04] rounded-full animate-pulse flex items-center justify-center">
              <div className="h-32 w-32 border border-white/[0.04] rounded-full" />
            </div>

            {/* Glowing route line path */}
            <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#eab308" />
                  <stop offset={`${progressPct}%`} stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              {/* Central route */}
              <path
                d={`M 50,150 Q 150,80 250,170 T 450,120`}
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d={`M 50,150 Q 150,80 250,170 T 450,120`}
                fill="none"
                stroke="url(#glowGrad)"
                strokeWidth="3.5"
                strokeDasharray="4, 6"
                strokeLinecap="round"
              />
            </svg>

            {/* HUB / DEPOT MARKER */}
            <div className="absolute left-[12%] top-[55%] flex flex-col items-center -translate-y-1/2">
              <div className="h-8 w-8 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center text-amber-400 shadow-md">
                <MapPin className="h-4 w-4" />
              </div>
              <span className="text-[9px] font-mono font-medium text-amber-500 mt-1">DEPOT</span>
            </div>

            {/* CUSTOMER DESTINATION MARKER */}
            <div className="absolute right-[12%] top-[40%] flex flex-col items-center -translate-y-1/2">
              <div className="h-8 w-8 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400 shadow-lg animate-pulse">
                <Home className="h-4 w-4" />
              </div>
              <span className="text-[9px] font-mono font-medium text-emerald-400 mt-1 truncate max-w-[80px]">
                HOME
              </span>
            </div>

            {/* LIVE MOVING AGENT TRUCK MARKER */}
            {/* Interpolating position on screen based on progress */}
            <div
              className="absolute flex flex-col items-center transition-all duration-700 ease-out"
              style={{
                left: `${12 + (88 - 12 - 5) * (progressPct / 100)}%`,
                top: `${55 - (55 - 40) * (progressPct / 100)}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="h-10 w-10 rounded-full bg-sky-500 border border-sky-350 flex items-center justify-center text-white shadow-xl scale-110 drop-shadow-[0_0_10px_rgba(14,165,233,0.4)]">
                <Truck className="h-5 w-5 animate-bounce" />
              </div>
              <span className="text-[10px] font-mono font-bold text-white bg-sky-500 px-1 py-0.5 rounded mt-1 shadow border border-sky-350 flex items-center gap-1">
                <Navigation className="h-2 w-2 rotate-45" /> AGENT
              </span>
            </div>
          </div>

          {/* Bottom Telemetry Display */}
          <div className="grid grid-cols-3 gap-2 bg-slate-900/50 border border-slate-800/80 rounded-xl p-3 text-center">
            <div>
              <p className="text-[10px] text-slate-500 font-mono uppercase">EST. ETA</p>
              <p className="text-base font-extrabold text-sky-400 font-mono tracking-tight animate-pulse">
                {etaMinutes} min{etaMinutes !== 1 ? 's' : ''}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-mono uppercase">TRANSIT PROGRESS</p>
              <p className="text-base font-extrabold text-white font-mono">{progressPct}%</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-mono uppercase">ROUTE STATUS</p>
              <p className="text-xs font-bold text-emerald-400 mt-1 uppercase truncate">
                {orderStatus.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Floating map controls for professional aesthetics */}
      <div className="absolute top-3 right-3 flex flex-col gap-2 z-[400] text-xs">
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 text-white border border-slate-800/80 shadow font-mono font-semibold">
          <span className={`block h-2 w-2 rounded-full ${orderStatus === 'OUT_FOR_DELIVERY' ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
          {orderStatus.replace(/_/g, ' ')}
        </span>
      </div>
    </div>
  );
}
