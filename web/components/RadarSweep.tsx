"use client";
import { useEffect, useRef } from "react";

type Blip = { id: string; x: number; y: number };

export default function RadarSweep({ blips = [] as Blip[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  // CSS-only sweep; ensure reflow in Safari
  useEffect(() => {
    if (!ref.current) return;
    // force repaint on mount
    const el = ref.current;
    el.style.willChange = 'transform';
    const t = setTimeout(() => (el.style.willChange = ''), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div ref={ref} className="relative h-56 w-full overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 to-white">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="radar-sweep" />
      </div>
      {blips.slice(0, 10).map((b) => (
        <div key={b.id} className="absolute" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
        </div>
      ))}
      <style jsx>{`
        .radar-sweep {
          width: 300%;
          height: 300%;
          border-radius: 50%;
          background: conic-gradient(from 0deg, rgba(16,185,129,0.15), rgba(16,185,129,0.0) 45%);
          animation: sweep 4s linear infinite;
        }
        @keyframes sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

