"use client";
import { Search, Bell, HeartHandshake } from "lucide-react";

function Step({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-white/60 p-4">
      <div className="mt-0.5 text-brand-700">{icon}</div>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-sm text-gray-600">{text}</div>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section className="space-y-3">
      <div className="text-sm text-gray-600">Free alerts. We link you directly to the retailer.</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Step icon={<Search size={18} />} title="Discover" text="Browse and search open-box deals across retailers." />
        <Step icon={<HeartHandshake size={18} />} title="Watch" text="Save a product or search. No password — email only." />
        <Step icon={<Bell size={18} />} title="Get alerts" text="We email you when new matches appear near you." />
      </div>
    </section>
  );
}

