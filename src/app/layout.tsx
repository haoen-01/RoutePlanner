import type { Metadata } from "next";
import Link from "next/link";
import { Footprints, History } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Running Route Planner",
  description: "Your personal AI running guide — the best route for the run you want today.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Footprints className="h-5 w-5 text-primary" /> AI Running Route Planner
            </Link>
            <Link href="/history" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <History className="h-4 w-4" /> History
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
