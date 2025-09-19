// Minimal embedded ZIP -> lat/lng lookup.
// This is intentionally tiny for dev; extend or replace with a table later.

export type ZipPoint = { lat: number; lng: number };

// A small set of common/dev ZIPs. Add more as needed.
const ZIP_MAP: Record<string, ZipPoint> = {
  // Boston/Cambridge area
  "02139": { lat: 42.3648, lng: -71.1038 }, // Cambridge, MA
  "02138": { lat: 42.3801, lng: -71.1280 },
  "02134": { lat: 42.3596, lng: -71.1324 },
  "02115": { lat: 42.3428, lng: -71.0878 },
  "01701": { lat: 42.3183, lng: -71.4412 }, // Framingham, MA
  // NYC
  "10001": { lat: 40.7506, lng: -73.9971 },
  "11201": { lat: 40.6956, lng: -73.9904 },
  // SF Bay
  "94105": { lat: 37.7898, lng: -122.3942 },
  "94016": { lat: 37.7081, lng: -122.4156 },
  // LA
  "90001": { lat: 33.9731, lng: -118.2487 },
  // Seattle
  "98101": { lat: 47.6101, lng: -122.3344 },
};

export function lookupZip(zip: string): ZipPoint | null {
  const z = (zip || "").trim();
  if (!z) return null;
  return ZIP_MAP[z] || null;
}

