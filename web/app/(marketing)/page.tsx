export default function Page() {
  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-semibold">Catch open-box deals before they’re gone.</h1>
      <p className="mt-4 text-gray-600">
        Set a watch for your SKU, condition, and price. We’ll ping you when it appears near you.
      </p>
      <div className="mt-8 space-x-3">
        <a href="/app" className="px-4 py-2 bg-black text-white rounded">Start free</a>
        <a href="#how" className="px-4 py-2 border rounded">See how it works</a>
      </div>
      <section id="how" className="mt-12">
        <h2 className="text-xl font-semibold">How it works</h2>
        <ol className="list-decimal ml-6 mt-3 space-y-2">
          <li>Add a watch (SKU or link). Pick stores or a ZIP radius, condition, and price ceiling.</li>
          <li>We scan public open-box/clearance pages at a polite cadence.</li>
          <li>We alert you on new stock or real price drops.</li>
        </ol>
      </section>
    </main>
  );
}
