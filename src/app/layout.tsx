import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OAuth Runway — how long until your users can connect?",
  description:
    "Evidence-backed guides for creating and getting approval for a provider OAuth app: difficulty, time to first connection vs production, what an agent can do, and where you take over.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
        <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-20">
          <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-4 sm:gap-6">
            <Link href="/" className="font-semibold tracking-tight flex items-center gap-2 shrink-0">
              <span aria-hidden className="inline-block w-6 h-6 rounded-md bg-accent text-white text-xs grid place-items-center">✈</span>
              OAuth Runway
            </Link>
            <nav className="flex gap-4 text-sm text-muted overflow-x-auto whitespace-nowrap">
              <Link href="/#library" className="hover:text-text hidden sm:inline">Library</Link>
              <Link href="/generate" className="hover:text-text">Generate</Link>
              <Link href="/how-it-works" className="hover:text-text">How it works</Link>
              <Link href="/how-it-works#api" className="hover:text-text hidden sm:inline">API</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border text-xs text-muted">
          <div className="mx-auto max-w-6xl px-4 py-6 flex flex-wrap gap-x-6 gap-y-2 justify-between">
            <span>Guides state what was tested, what sources say, and what is uncertain. Provider rules change — check the dates.</span>
            <span>Built for the Composio APM Integrations take-home.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
