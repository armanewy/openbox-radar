"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NearYou() {
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState(25);
  const router = useRouter();
  useEffect(() => {
    try {
      const z = localStorage.getItem('obr_zip');
      if (z) setZip(z);
      const r = localStorage.getItem('obr_radius');
      if (r) setRadius(Number(r) || 25);
    } catch {}
  }, []);

  function save() {
    try {
      localStorage.setItem('obr_zip', zip);
      localStorage.setItem('obr_radius', String(radius));
    } catch {}
    router.push(`/search?zip=${encodeURIComponent(zip)}&radius_miles=${encodeURIComponent(String(radius))}`);
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 max-w-md">
        <Input placeholder="ZIP" value={zip} onChange={(e) => setZip(e.target.value)} />
        <Input type="number" placeholder="Radius" value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
        <Button onClick={save}>Search</Button>
      </div>
      <div className="mt-2 text-sm text-gray-600">
        Or view the <Link href="/search/map" className="underline">map</Link>
      </div>
    </div>
  );
}

