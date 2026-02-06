import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center px-6 pt-32 pb-20 text-center">
      {/* Gradient glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] opacity-30 blur-[120px] bg-gradient-to-br from-accent via-violet to-emerald" />

      <h1 className="relative text-5xl sm:text-7xl font-bold tracking-tight leading-[1.1]">
        Medical imaging,
        <br />
        <span className="bg-gradient-to-r from-accent to-violet bg-clip-text text-transparent">
          reimagined for the web.
        </span>
      </h1>

      <p className="relative mt-6 max-w-xl text-lg text-muted leading-relaxed">
        View CT scans instantly in your browser.
        <br />
        No uploads. No installs. 100% private.
      </p>

      <Link
        href="/viewer"
        className="relative mt-10 inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-background transition-all hover:glow-cyan hover:scale-[1.02] active:scale-[0.98]"
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
    </section>
  );
}
