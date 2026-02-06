import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "View MRI Scans in Your Browser — OpenRad",
  description:
    "Open and view MRI DICOM files directly in your browser. Supports T1, T2, FLAIR sequences. No uploads, no installs, 100% private.",
  keywords: [
    "MRI viewer",
    "DICOM MRI viewer",
    "magnetic resonance imaging viewer",
    "browser MRI scan",
    "MRI DICOM online",
    "OpenRad MRI",
    "view MRI free",
    "T1 T2 FLAIR viewer",
  ],
  openGraph: {
    title: "View MRI Scans in Your Browser — OpenRad",
    description:
      "Open and view MRI DICOM files directly in your browser. No uploads, no installs, 100% private.",
  },
};

export default function MRIPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="px-6 pt-28 pb-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-sm font-mono text-accent">MRI</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight font-mono leading-tight">
            View MRI Scans in{" "}
            <span className="text-accent glow-green-text">Your Browser</span>
          </h1>
          <p className="mt-6 text-lg text-muted leading-relaxed">
            Magnetic Resonance Imaging (MRI) uses strong magnetic fields and radio waves
            to produce detailed images of soft tissues, the brain, joints, and organs.
            MRI files are stored in DICOM format, just like CT scans.
          </p>

          <div className="mt-12 space-y-8">
            <div>
              <h2 className="text-xl font-semibold font-mono">What is an MRI?</h2>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                MRI works by aligning hydrogen atoms in your body using a powerful magnet,
                then measuring the radio signals they emit as they relax. Different tissues
                produce different signal intensities, creating excellent soft-tissue contrast
                without ionizing radiation. MRI is commonly used for brain, spine, knee, and
                abdominal imaging.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold font-mono">MRI sequences</h2>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                MRI studies typically include multiple sequences, each highlighting different
                tissue properties. Common sequences include T1-weighted (anatomical detail,
                fat appears bright), T2-weighted (fluid appears bright, good for edema),
                and FLAIR (fluid-suppressed, ideal for brain lesions). Each sequence is
                stored as a separate DICOM series.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold font-mono">OpenRad MRI features</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  Browse multiple sequences (T1, T2, FLAIR, DWI) per study
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  Window/level adjustments for optimal contrast
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  Smooth scrolling through volumetric series
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  Measurement tools with pixel spacing calibration
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  100% local — your scans never leave your device
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12">
            <Link
              href="/viewer"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-background transition-all hover:glow-green hover:scale-[1.02] active:scale-[0.98]"
            >
              Open MRI Viewer
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
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
