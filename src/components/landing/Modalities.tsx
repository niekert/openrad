import Link from "next/link";

const modalities = [
  {
    abbr: "CT",
    name: "Computed Tomography",
    description: "Cross-sectional imaging with detailed anatomical views",
    href: "/ct",
  },
  {
    abbr: "MRI",
    name: "Magnetic Resonance Imaging",
    description: "Soft tissue contrast with T1, T2, and FLAIR sequences",
    href: "/mri",
  },
  {
    abbr: "X-ray",
    name: "Radiography",
    description: "Projection imaging for bones, chest, and extremities",
    href: "/x-ray",
  },
];

export default function Modalities() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-10 text-center text-sm font-semibold uppercase tracking-widest text-muted font-mono">
          Supported Modalities
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {modalities.map((m) => (
            <Link key={m.abbr} href={m.href} className="group">
              <div className="rounded-xl border border-border bg-surface/50 p-6 transition-all group-hover:border-border-bright group-hover:glow-green-sm">
                <p className="text-3xl font-bold text-accent">
                  {m.abbr}
                </p>
                <p className="mt-1 text-xs text-muted">{m.name}</p>
                <p className="mt-3 text-sm text-muted leading-relaxed">
                  {m.description}
                </p>
                <p className="mt-4 text-sm text-accent group-hover:underline">
                  Learn more &rarr;
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
