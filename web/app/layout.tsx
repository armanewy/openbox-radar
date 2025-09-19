import "./globals.css";
import Link from "next/link";
import { getSession } from "@/lib/utils/auth";
import { Button } from "@/components/ui/button";
import AppToaster from "@/components/ui/Toaster";

export const metadata = {
  title: "Open-Box Radar",
  description: "Catch open-box deals before they’re gone.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const s = getSession();
  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white/80 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <Link href="/" className="font-semibold">Openbox Radar</Link>
              <nav className="hidden sm:flex items-center gap-4 text-sm text-gray-700">
                <Link href="/search" className="hover:underline">Search</Link>
                <Link href="/stores" className="hover:underline">Stores</Link>
                <Link href="/app" className="hover:underline">Dashboard</Link>
              </nav>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {s ? (
                <form action="/api/auth/signout" method="POST">
                  <Button variant="outline" size="sm">Sign out</Button>
                </form>
              ) : (
                <Link href="/?signin=1"><Button variant="outline" size="sm">Sign in</Button></Link>
              )}
            </div>
          </div>
        </header>
        <main>
          {children}
        </main>
        <AppToaster />
      </body>
    </html>
  );
}
