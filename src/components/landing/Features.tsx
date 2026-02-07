const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
    title: "Private",
    description:
      "Your files never leave your device. Everything runs locally in your browser — zero uploads, zero servers.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: "Instant",
    description:
      "No waiting, no downloads, no installs. Just open your DICOM folder and start viewing scans immediately.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="8" height="18" rx="1" />
        <rect x="14" y="3" width="8" height="18" rx="1" />
      </svg>
    ),
    title: "Side-by-Side Compare",
    description:
      "Compare prior and current studies side by side with synchronized scrolling and linked window/level.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3h18v18H3z" />
        <path d="M3 12h18" strokeDasharray="2 2" />
        <path d="M12 3v18" strokeDasharray="2 2" />
        <circle cx="12" cy="8" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
    title: "Topogram Navigation",
    description:
      "Click anywhere on the scout image to jump to that slice instantly. Navigate large series with ease.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        <path d="M8 10h8M8 14h4" />
      </svg>
    ),
    title: "AI Chat",
    badge: "Coming Soon",
    description:
      "Ask questions about your scans using AI — get explanations, measurements, and insights without leaving the viewer.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: "Open Source",
    description:
      "Fully open source and free to use. Inspect the code, contribute, or self-host — no vendor lock-in.",
  },
];

export default function Features() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-10 text-center text-sm font-semibold uppercase tracking-widest text-muted font-mono">
          Features
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-surface/50 p-6 transition-all hover:border-border-bright hover:glow-green-sm"
            >
              <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-accent-dim p-2.5 text-accent">
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold font-mono">
                {f.title}
                {"badge" in f && f.badge && (
                  <span className="ml-2 inline-flex items-center rounded-full border border-accent/30 bg-accent-dim px-2 py-0.5 text-[10px] font-medium text-accent align-middle">
                    {f.badge}
                  </span>
                )}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
