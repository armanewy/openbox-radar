"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NearYou() {
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState(25);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [nearby, setNearby] = useState<Array<{ retailer: string; store_id: string; name: string | null; city: string | null; state: string | null; distance_miles: number }>>([]);
  const [geoErr, setGeoErr] = useState<string>("");
  const router = useRouter();
  useEffect(() => {
    try {
      const z = localStorage.getItem('obr_zip');
      if (z) setZip(z);
      const r = localStorage.getItem('obr_radius');
      if (r) setRadius(Number(r) || 25);
      const lat = localStorage.getItem('obr_loc_lat');
      const lng = localStorage.getItem('obr_loc_lng');
      if (lat && lng) setLoc({ lat: Number(lat), lng: Number(lng) });
    } catch {}
  }, []);

  function save() {
    try {
      localStorage.setItem('obr_zip', zip);
      localStorage.setItem('obr_radius', String(radius));
    } catch {}
    router.push(`/search?zip=${encodeURIComponent(zip)}&radius_miles=${encodeURIComponent(String(radius))}`);
  }

  async function useMyLocation() {
    setGeoErr("");
    if (!('geolocation' in navigator)) {
      setGeoErr('Geolocation not available');
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLoc(p);
      try {
        localStorage.setItem('obr_loc_lat', String(p.lat));
        localStorage.setItem('obr_loc_lng', String(p.lng));
        localStorage.setItem('obr_radius', String(radius));
      } catch {}
      try {
        const u = new URLSearchParams({ lat: String(p.lat), lng: String(p.lng), radius: String(radius) });
        const r = await fetch(`/api/stores?${u.toString()}`);
        const d = await r.json();
        const stores = (d.stores || []) as any[];
        setNearby(stores.map(s => ({ retailer: s.retailer, store_id: s.store_id, name: s.name, city: s.city, state: s.state, distance_miles: Number(s.distance_miles?.toFixed?.(1) ?? s.distance_miles ?? 0) })));
      } catch (e) {
        setGeoErr('Could not fetch nearby stores');
      }
    }, (err) => {
      setGeoErr(err?.message || 'Location permission denied');
    }, { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 });
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 max-w-md">
        <Input placeholder="ZIP" value={zip} onChange={(e) => setZip(e.target.value)} />
        <Input type="number" placeholder="Radius" value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
        <Button onClick={save}>Search</Button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="outline" onClick={useMyLocation}>Use my location</Button>
        <span className="text-sm text-gray-600">Or view the <Link href="/search/map" className="underline">map</Link></span>
      </div>
      {geoErr && <div className="mt-2 text-sm text-red-600">{geoErr}</div>}
      {loc && nearby.length > 0 && (
        <div className="mt-4">
          <div className="text-sm text-gray-700 mb-1">Nearest stores ({nearby.length > 6 ? 'top 6' : nearby.length}):</div>
          <ul className="text-sm space-y-1">
            {nearby.slice(0, 6).map((s) => (
              <li key={`${s.retailer}:${s.store_id}`} className="flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="font-medium mr-1">{s.name || s.store_id}</span>
                  <span className="text-gray-600">{s.city}{s.state ? `, ${s.state}` : ''}</span>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-gray-700">~{s.distance_miles} mi</span>
                  <Link href={`/search?retailer=${encodeURIComponent(s.retailer)}&store_id=${encodeURIComponent(s.store_id)}`} className="underline">Browse</Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
