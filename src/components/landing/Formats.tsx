const formats = [
  { name: "DICOM", detail: ".dcm and extensionless files" },
  { name: "DICOMDIR", detail: "Auto-detected index file" },
  { name: "Raw DICOM", detail: "Folder scan fallback" },
  { name: "Multi-frame", detail: "Enhanced DICOM" },
];

const modalities = ["CT", "MRI", "X-ray", "CR", "DR"];

export default function Formats() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-10 text-center text-sm font-semibold uppercase tracking-widest text-muted font-mono">
          Supported Formats
        </h2>
        <div className="rounded-xl border border-border bg-surface/50 p-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {formats.map((f) => (
              <div key={f.name} className="flex items-start gap-3">
                <span className="mt-0.5 text-accent">&#x2713;</span>
                <div>
                  <p className="text-sm font-semibold text-foreground-bright">{f.name}</p>
                  <p className="text-xs text-muted">{f.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-xs text-muted mb-2">Modalities</p>
            <div className="flex flex-wrap gap-2">
              {modalities.map((m) => (
                <span
                  key={m}
                  className="rounded-full border border-border-bright bg-accent-dim px-3 py-1 text-xs font-mono text-accent"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
