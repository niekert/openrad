import Link from "next/link";
import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center px-4 sm:px-6 pt-32 pb-10 text-center">
      {/* Gradient glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] opacity-20 blur-[120px] bg-accent" />

      <div className="relative mb-6 inline-flex items-center gap-2 rounded-full border border-border-bright bg-accent-dim px-3 py-1 text-xs font-mono text-accent">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        open source
      </div>

      <h1 className="relative text-5xl sm:text-7xl font-bold tracking-tight leading-[1.1]">
        Medical imaging
        <br />
        <span className="text-accent glow-green-text">
          in your browser.
        </span>
      </h1>

      <p className="relative mt-6 max-w-xl text-lg text-muted leading-relaxed">
        View CT scans, MRI, and X-rays instantly.
        <br />
        No uploads. No installs. No account.
        <br />
        100% free. 100% private.
      </p>

      <div className="relative mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/viewer"
          className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-background transition-all hover:glow-green hover:scale-[1.02] active:scale-[0.98]"
        >
          Launch Viewer
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 3l5 5-5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <a
          href="https://github.com/niekert/OpenRad"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          View on GitHub
        </a>
      </div>

      {/* Screenshot in browser mockup */}
      <div className="relative mt-10 sm:mt-16 w-full max-w-5xl">
        <div className="rounded-xl border border-border bg-[#0d0d0d] overflow-hidden shadow-2xl shadow-accent/5">
          {/* Browser chrome bar */}
          <div className="flex items-center gap-2 px-4 py-3 bg-[#0d0d0d] border-b border-border">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]/70" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]/70" />
              <span className="h-3 w-3 rounded-full bg-[#27c93f]/70" />
            </div>
            <div className="flex-1 mx-8">
              <div className="mx-auto max-w-md rounded-md bg-[#1a1a1a] px-3 py-1 text-xs text-muted text-center font-mono">
                openrad.com/viewer
              </div>
            </div>
          </div>
          <Image
            src="/screenshot.jpg"
            alt="openrad viewer showing a CT scan"
            width={2560}
            height={1600}
            className="w-full h-auto"
            priority
          />
        </div>
      </div>
    </section>
  );
}
