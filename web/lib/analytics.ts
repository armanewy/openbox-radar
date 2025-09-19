"use client";

export function track(event: string, props?: Record<string, any>) {
  try {
    const payload = JSON.stringify({ event, props, t: Date.now() });
    const url = "/api/analytics";
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
    fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true });
  } catch {}
}

