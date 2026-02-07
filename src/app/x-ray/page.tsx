import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "View X-rays in Your Browser — openrad",
  description:
    "Open and view X-ray DICOM files directly in your browser. Supports CR and DR modalities. No uploads, no installs, 100% private.",
  keywords: [
    "X-ray viewer",
    "DICOM X-ray viewer",
    "radiography viewer",
    "browser X-ray",
    "CR DR viewer",
    "openrad X-ray",
    "view X-ray free",
    "digital radiography viewer",
  ],
  openGraph: {
    title: "View X-rays in Your Browser — openrad",
    description:
      "Open and view X-ray DICOM files directly in your browser. No uploads, no installs, 100% private.",
  },
};

export default function XRayPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="px-6 pt-28 pb-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-sm font-mono text-accent">X-ray</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight font-mono leading-tight">
            View X-rays in{" "}
            <span className="text-accent glow-green-text">Your Browser</span>
          </h1>
          <p className="mt-6 text-lg text-muted leading-relaxed">
            X-rays (radiography) are projection images that pass radiation through
            the body onto a detector. They are the most common medical imaging modality,
            used for bones, chest, and extremities. Digital X-rays are stored as DICOM
            files in CR (Computed Radiography) or DR (Digital Radiography) format.
          </p>

          <div className="mt-12 space-y-8">
            <div>
              <h2 className="text-xl font-semibold font-mono">What is digital radiography?</h2>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                Traditional X-rays captured images on film, but modern digital radiography
                (DR) uses flat-panel detectors to produce high-resolution digital images.
                Computed Radiography (CR) uses phosphor plates that are scanned to produce
                a digital image. Both formats are stored as DICOM files with standardized
                metadata for window width, center, and pixel spacing.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold font-mono">Common X-ray studies</h2>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                Chest X-rays (PA and lateral views) are the most frequently performed
                radiographic examination. Other common studies include hand, wrist, spine,
                pelvis, and extremity imaging. Unlike CT or MRI, X-ray studies typically
                contain just one or a few images per series rather than hundreds of slices.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold font-mono">openrad X-ray features</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  Supports both CR and DR DICOM modalities
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  Window/level adjustments for bone and soft tissue
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  Zoom and pan for detailed examination
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  Length measurements with calibrated pixel spacing
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  100% local — your images never leave your device
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12">
            <Link
              href="/viewer"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-background transition-all hover:glow-green hover:scale-[1.02] active:scale-[0.98]"
            >
              Open X-ray Viewer
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
