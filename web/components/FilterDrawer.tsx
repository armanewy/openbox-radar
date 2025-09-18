"use client";
import { useState } from "react";

export default function FilterDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button className="mb-3 px-3 py-2 border rounded" onClick={() => setOpen(true)}>Filters</button>
      <div className={open ? "fixed inset-0 z-50" : "hidden"}>
        <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
        <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-xl p-4 overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Filters</h2>
            <button className="px-3 py-1 rounded border" onClick={() => setOpen(false)}>Close</button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

