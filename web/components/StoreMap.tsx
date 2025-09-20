"use client";
import { useEffect, useRef } from "react";

type StorePin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  count: number;
  dist?: number | null;
  browseUrl?: string;
};

function ensureLeafletCss() {
  if (typeof document === 'undefined') return;
  const id = 'leaflet-css';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

export default function StoreMap({ pins, origin }: { pins: StorePin[]; origin?: { lat: number; lng: number } }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let map: any;
    let L: any;
    let layerGroup: any;
    let markers: any[] = [];
    (async () => {
      ensureLeafletCss();
      L = await import('leaflet');
      if (!ref.current) return;
      map = L.map(ref.current, { zoomControl: true, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      layerGroup = L.layerGroup().addTo(map);

      const bounds = L.latLngBounds([]);
      pins.forEach((p) => {
        const marker = L.marker([p.lat, p.lng]);
        const html = `<div style="min-width:180px"><strong>${p.name}</strong><br/>Items: ${p.count}${p.dist != null ? ` • ~${p.dist.toFixed(1)} mi` : ''}${p.browseUrl ? `<br/><a href='${p.browseUrl}' target='_blank' rel='noopener'>Browse</a>` : ''}</div>`;
        marker.bindPopup(html);
        marker.addTo(layerGroup);
        markers.push(marker);
        bounds.extend([p.lat, p.lng]);
      });
      if (origin) {
        const u = L.circleMarker([origin.lat, origin.lng], { radius: 6, color: '#10b981', fillColor: '#10b981', fillOpacity: 0.8 });
        u.bindPopup('You are here');
        u.addTo(layerGroup);
        bounds.extend([origin.lat, origin.lng]);
      }
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));
      else map.setView([origin?.lat || 42.36, origin?.lng || -71.06], 10);
    })();
    return () => {
      try { markers.forEach((m) => m.remove && m.remove()); } catch {}
      try { layerGroup && layerGroup.remove && layerGroup.remove(); } catch {}
      try { map && map.remove && map.remove(); } catch {}
    };
  }, [pins, origin]);

  return <div ref={ref} className="h-[360px] w-full rounded-xl border border-gray-300 overflow-hidden bg-gray-100" />;
}

