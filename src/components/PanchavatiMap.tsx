import { useEffect, useRef } from "react";
import * as L from "leaflet";

import { OSM_COPYRIGHT_URL } from "@/data/panchavati";
import type { Landmark } from "@/data/panchavati";
import { PANCHAVATI_CENTER } from "@/data/panchavati";
import type { LatLng, TrafficReport, WalkingRoute } from "@/lib/panchavati-routing";

export interface PanchavatiMapProps {
  destination?: Landmark;
  reports: TrafficReport[];
  routes: WalkingRoute[];
  selectedRoute: number;
  userLocation?: LatLng;
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
}

function formatMarkerIcon(color: string, symbol: string, className: string) {
  return L.divIcon({
    className: "kp-div-icon",
    html: `<span class="${className}" style="--marker-tone:${color}">${symbol}</span>`,
    iconSize: [34, 42],
    iconAnchor: [17, 39],
    popupAnchor: [0, -38],
  });
}

const incidentColors = {
  light: "#54a874",
  moderate: "#e1a542",
  heavy: "#d95d57",
};

const routeTone = ["kp-route-primary", "kp-route-alt-one", "kp-route-alt-two"];

export function PanchavatiMap({
  destination,
  reports,
  routes,
  selectedRoute,
  userLocation,
  landmarks,
  onSelectLandmark,
}: PanchavatiMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup[]>([]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || mapRef.current) return;

    const map = L.map(host, {
      center: PANCHAVATI_CENTER,
      zoom: 16,
      zoomControl: false,
      preferCanvas: true,
      attributionControl: true,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      minZoom: 12,
      maxZoom: 19,
      attribution: `&copy; <a href="${OSM_COPYRIGHT_URL}" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors`,
      subdomains: "abc",
    }).addTo(map);

    mapRef.current = map;
    const resizeObserver = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resizeObserver.observe(host);
    const resizeFrame = window.requestAnimationFrame(() => map.invalidateSize({ pan: false }));

    return () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const layer of layersRef.current) layer.remove();
    layersRef.current = [];

    for (const landmark of landmarks) {
      const tone = landmark.kind === "ghat" ? "kp-landmark-pin kp-landmark-pin-ghat" : "kp-landmark-pin";
      const marker = L.marker(landmark.position, {
        icon: L.divIcon({
          className: "kp-div-icon",
          html: `<span class="${tone}"><span class="kp-landmark-dot"></span></span>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
        keyboard: true,
        title: landmark.name,
        alt: landmark.name,
      }).addTo(map);
      marker.bindTooltip(landmark.name, { direction: "top", offset: [0, -6], opacity: 0.96 });
      marker.on("click", () => onSelectLandmark(landmark));
      layersRef.current.push(marker);
    }

    for (const report of reports) {
      const color = incidentColors[report.intensity];
      const ageMinutes = Math.max(0, Math.round((Date.now() - report.createdAt) / 60_000));
      const sourceText = report.source === "demo" ? "Sample report · not live traffic" : "Community report · unverified";
      const countText = report.id.includes("cluster-") ? `${report.id.split("-").at(-1)} nearby reports` : "Community observation";
      const marker = L.marker([report.latitude, report.longitude], {
        icon: formatMarkerIcon(color, "!", "kp-traffic-pin"),
        keyboard: true,
        title: `${report.intensity} congestion, ${sourceText}`,
        alt: `${report.intensity} traffic report`,
      }).addTo(map);
      marker.bindPopup(
        `<strong>${report.intensity[0]?.toUpperCase()}${report.intensity.slice(1)} congestion</strong><br/>${countText}<br/>${sourceText}<br/>${ageMinutes === 0 ? "Just now" : `${ageMinutes} min ago`}`,
      );
      layersRef.current.push(marker);

      const radius = Math.min(115, 60 + ageMinutes * 0.5);
      const area = L.circle([report.latitude, report.longitude], {
        radius,
        color,
        fillColor: color,
        fillOpacity: report.source === "demo" ? 0.11 : 0.19,
        opacity: report.source === "demo" ? 0.3 : 0.52,
        weight: 1,
        interactive: false,
      }).addTo(map);
      layersRef.current.push(area);
    }

    for (const [index, route] of routes.entries()) {
      const line = L.polyline(route.coordinates.map((point) => [point[0], point[1]]), {
        className: routeTone[index] ?? routeTone[2],
        color: index === selectedRoute ? (index === 0 ? "#438d65" : "#738886") : "#82918b",
        weight: index === selectedRoute ? 6 : 4,
        opacity: index === selectedRoute ? 0.88 : 0.45,
        dashArray: index === selectedRoute ? undefined : "8 8",
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      line.bringToBack();
      layersRef.current.push(line);
    }

    if (userLocation) {
      const accuracy = L.circle(userLocation, {
        radius: 80,
        color: "#3684de",
        fillColor: "#4d93e6",
        fillOpacity: 0.13,
        weight: 1,
        interactive: false,
      }).addTo(map);
      const position = L.marker(userLocation, {
        icon: L.divIcon({
          className: "kp-div-icon",
          html: '<span class="kp-user-location-pin"><span></span></span>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        title: "Your location",
        alt: "Your current location",
      }).addTo(map);
      position.bindTooltip("Your location", { direction: "top", offset: [0, -10] });
      layersRef.current.push(accuracy, position);
    }

    if (destination) {
      map.panTo(destination.position, { animate: true, duration: 0.35 });
    }
  }, [destination, landmarks, onSelectLandmark, reports, routes, selectedRoute, userLocation]);

  return <div className="kp-map-canvas" data-testid="map-canvas" ref={hostRef} aria-label="OpenStreetMap showing Panchavati, Nashik" role="application" />;
}