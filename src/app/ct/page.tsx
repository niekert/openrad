import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "View CT Scans in Your Browser — OpenRad",
  description:
    "Open and view CT scan DICOM files directly in your browser. No uploads, no installs. Supports DICOMDIR, window/level presets, measurements, and smooth slice scrolling.",
  keywords: [
    "CT scan viewer",
    "DICOM CT viewer",
    "computed tomography viewer",
    "browser CT scan",
    "CT DICOM online",
    "OpenRad CT",
    "view CT scan free",
  ],
  openGraph: {
    title: "View CT Scans in Your Browser — OpenRad",
    description:
      "Open and view CT scan DICOM files directly in your browser. No uploads, no installs, 100% private.",
  },
};

export default function CTPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="px-6 pt-28 pb-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-sm font-mono text-accent">CT</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight font-mono leading-tight">
            View CT Scans in{" "}
            <span className="text-accent glow-green-text">Your Browser</span>
          </h1>
          <p className="mt-6 text-lg text-muted leading-relaxed">
            Computed Tomography (CT) produces detailed cross-sectional images of the body
            using X-rays. CT scans are stored as DICOM files — typically hundreds of
            slices per series — on CDs or in folders from your hospital.
          </p>

          <div className="mt-12 space-y-8">
            <div>
              <h2 className="text-xl font-semibold font-mono">What is a CT scan?</h2>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                A CT scanner rotates an X-ray beam around your body to capture cross-sectional
                slices. These slices are reconstructed into detailed images that reveal bones,
                organs, and soft tissue. Common CT studies include thorax, abdomen, head, and
                spine scans. Each slice is stored as an individual DICOM file with standardized
                metadata like window width, window center, and pixel spacing.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold font-mono">DICOM structure</h2>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                Hospital CT discs typically contain a DICOMDIR index file that organizes
                your images into a hierarchy: Patient → Study → Series → Image. OpenRad
                reads this index automatically, or falls back to scanning all files in the
                folder. Each DICOM file contains both the image pixel data and metadata like
                slice position, spacing, and Hounsfield unit calibration.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold font-mono">OpenRad CT features</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  Window/level presets for soft tissue, bone, lung, and brain
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  Smooth scrolling through hundreds of slices
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  Length measurements with pixel spacing calibration
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  Hounsfield unit display with rescale slope/intercept
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  DICOMDIR auto-detection for fast loading
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12">
            <Link
              href="/viewer"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-background transition-all hover:glow-green hover:scale-[1.02] active:scale-[0.98]"
            >
              Open CT Viewer
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
