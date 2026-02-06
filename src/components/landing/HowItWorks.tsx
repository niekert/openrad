const steps = [
  {
    number: "1",
    title: "Select your DICOM folder",
    description: "Open the folder from your medical imaging disc or any DICOM directory on your computer.",
  },
  {
    number: "2",
    title: "Browse your studies and series",
    description: "OpenRad reads the DICOMDIR index to show all your studies, series, and slices.",
  },
  {
    number: "3",
    title: "View, scroll, and analyze",
    description: "Scroll through slices, adjust window/level presets, zoom in, and take measurements.",
  },
];

export default function HowItWorks() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-12 text-center text-sm font-semibold uppercase tracking-widest text-muted font-mono">
          How it works
        </h2>
        <div className="space-y-10">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-mono font-bold text-background">
                {step.number}
              </div>
              <div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
