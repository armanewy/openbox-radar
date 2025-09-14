import "./globals.css";

export const metadata = { title: "Open-Box Radar", description: "Catch open-box deals before they’re gone." }; export default function RootLayout({ children }: { children: React.ReactNode }) { return (<html lang="en"><body>{children}</body></html>); }
