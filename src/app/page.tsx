import Link from "next/link";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full glass">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
            OpenCT
          </Link>
          <Link
            href="/viewer"
            className="rounded-full border border-border-bright px-4 py-1.5 text-sm transition-colors hover:bg-surface"
          >
            Launch Viewer
          </Link>
        </div>
      </header>

      <main>
        <Hero />
        <Features />
        <HowItWorks />
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-10 text-center text-xs text-muted">
        <p>
          OpenCT is open source. Your files never leave your device.
        </p>
      </footer>
    </div>
  );
}
