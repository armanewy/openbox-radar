'use client';

export default function BestBuyAttribution() {
  if (process.env.NEXT_PUBLIC_BESTBUY_ATTRIB_DISABLED === '1') return null;
  return (
    <div className="mt-6 flex items-center gap-2 text-sm text-zinc-500">
      <a
        href="https://developer.bestbuy.com"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 hover:opacity-80"
      >
        <img
          src="https://developer.bestbuy.com/images/bestbuy-logo.png"
          alt="Best Buy Developer API"
          className="h-4 w-auto"
        />
        <span>Data from Best Buy</span>
      </a>
    </div>
  );
}

