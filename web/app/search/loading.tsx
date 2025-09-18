export default function Loading() {
  return (
    <main className="container mx-auto max-w-7xl p-4 md:p-6 grid grid-cols-12 gap-6">
      <aside className="col-span-12 md:col-span-3">
        <div className="sticky top-3 border rounded-xl p-4 space-y-3 bg-white/70 backdrop-blur shadow-card">
          <div className="h-8 bg-gray-100 rounded" />
          <div className="h-8 bg-gray-100 rounded" />
          <div className="h-8 bg-gray-100 rounded" />
          <div className="h-20 bg-gray-100 rounded" />
        </div>
      </aside>
      <section className="col-span-12 md:col-span-9">
        <div className="h-6 w-40 bg-gray-100 rounded mb-4" />
        <ul className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="border rounded-xl p-4 bg-white/70 backdrop-blur shadow-card">
              <div className="flex gap-4">
                <div className="h-24 w-24 rounded-lg bg-gray-100 border shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

