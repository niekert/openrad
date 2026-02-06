import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "What is DICOM? How to Get Your Medical Images — OpenRad",
  description:
    "Learn what DICOM files are, how medical images are stored, and how to request and access your CT, MRI, and X-ray files from hospitals and imaging centers.",
  keywords: [
    "what is DICOM",
    "DICOM files explained",
    "how to get medical images",
    "request CT scan files",
    "request MRI files",
    "medical imaging CD",
    "DICOM format",
    "patient imaging rights",
    "DICOMDIR",
    "download medical images",
  ],
  openGraph: {
    title: "What is DICOM? How to Get Your Medical Images — OpenRad",
    description:
      "Learn what DICOM files are and how to request your CT, MRI, and X-ray images from hospitals and imaging centers.",
  },
};

export default function DicomPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="px-6 pt-28 pb-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-sm font-mono text-accent">Guide</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            What is DICOM and how do I{" "}
            <span className="text-accent glow-green-text">
              get my medical images
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted leading-relaxed">
            Every time you get a CT scan, MRI, or X-ray, your images are saved
            in a standard format called DICOM. These are your files and you have
            the right to access them. Here is everything you need to know.
          </p>

          <div className="mt-12 space-y-10">
            {/* What is DICOM */}
            <div>
              <h2 className="text-2xl font-semibold">What is DICOM</h2>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                DICOM stands for Digital Imaging and Communications in Medicine.
                It is the universal standard format used by hospitals, clinics,
                and imaging centers worldwide to store and share medical images.
                Every CT scan, MRI, X-ray, ultrasound, and mammogram you have
                ever had was saved as DICOM files.
              </p>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                A DICOM file is more than just a picture. Each file contains both
                the image data and metadata about the scan: your name, the date,
                the type of equipment used, slice thickness, pixel spacing, and
                dozens of other technical details. This is what makes medical
                images different from regular photos.
              </p>
            </div>

            {/* How files are organized */}
            <div>
              <h2 className="text-2xl font-semibold">How DICOM files are organized</h2>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                Medical images follow a hierarchy that mirrors how your scans were performed:
              </p>
              <div className="mt-4 rounded-xl border border-border bg-surface/50 p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-background">
                    1
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground-bright">Patient</p>
                    <p className="text-xs text-muted">Your name and patient ID</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-background">
                    2
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground-bright">Study</p>
                    <p className="text-xs text-muted">A single visit or exam (e.g. &quot;CT Thorax/Abdomen&quot; on a specific date)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-background">
                    3
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground-bright">Series</p>
                    <p className="text-xs text-muted">A specific scan within that study (e.g. &quot;Soft Tissue&quot;, &quot;Bone Window&quot;, &quot;Lung&quot;)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-background">
                    4
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground-bright">Image</p>
                    <p className="text-xs text-muted">Individual slices or frames. A single CT series can have hundreds of images</p>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted leading-relaxed">
                Most hospital CDs also include a special file called DICOMDIR.
                This is an index file that lists all the images and how they are
                organized. OpenRad reads this file automatically so you can
                browse your studies and series without waiting for every file to
                be parsed.
              </p>
            </div>

            {/* How to get your files */}
            <div>
              <h2 className="text-2xl font-semibold">How to get your DICOM files</h2>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                You have the legal right to access your own medical images. In
                the US this is protected under HIPAA. In the EU it falls under
                GDPR. In most countries, healthcare providers are required to
                give you a copy of your imaging data when you ask.
              </p>

              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold">Ask for a CD or DVD at your appointment</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    The most common way to get your images. After a CT, MRI, or
                    X-ray, ask the radiology department or front desk for a copy
                    on disc. Many imaging centers will burn a CD for you on the
                    spot, sometimes for a small fee. The disc will contain your
                    DICOM files and usually a DICOMDIR index file.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold">Request through your patient portal</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    Some hospitals let you download imaging files through their
                    online patient portal (like MyChart, Epic, or similar systems).
                    Look for options like &quot;Download images&quot;, &quot;Request medical records&quot;,
                    or &quot;Imaging&quot; in the portal. The download may come as a ZIP file
                    containing DICOM files.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold">Submit a medical records request</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    If the above options are not available, you can formally request
                    your imaging records from the hospital&apos;s medical records or
                    health information department. Ask specifically for the images
                    in DICOM format (not just the radiology report). You may need
                    to fill out an authorization form. Hospitals are generally
                    required to respond within 30 days.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold">Ask your referring doctor</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    Your doctor who ordered the scan also receives copies of the
                    images. They may be able to share the DICOM files with you
                    or request them from the imaging center on your behalf.
                  </p>
                </div>
              </div>
            </div>

            {/* Using with OpenRad */}
            <div>
              <h2 className="text-2xl font-semibold">Viewing your files with OpenRad</h2>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                Once you have your DICOM files on a CD, DVD, USB drive, or
                downloaded to your computer:
              </p>
              <ol className="mt-4 space-y-3 text-sm text-muted">
                <li className="flex items-start gap-3">
                  <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-background">
                    1
                  </span>
                  <span>
                    Open <Link href="/viewer" className="text-accent hover:underline">OpenRad Viewer</Link> in
                    your browser
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-background">
                    2
                  </span>
                  <span>
                    Click &quot;Select Folder&quot; and choose the folder containing your
                    DICOM files (the root of the CD or the extracted folder)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-background">
                    3
                  </span>
                  <span>
                    Browse your studies and series in the sidebar, scroll through
                    slices, adjust contrast, zoom in, and measure
                  </span>
                </li>
              </ol>
              <p className="mt-4 text-sm text-muted leading-relaxed">
                Everything happens locally in your browser. Your files are never
                uploaded anywhere. No account is needed and it is completely free.
              </p>
            </div>

            {/* Tips */}
            <div>
              <h2 className="text-2xl font-semibold">Tips</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  DICOM files often have no file extension (no .jpg or .dcm). This is normal
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  If your CD includes a viewer application, you can ignore it and use OpenRad instead
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  Copy files from the CD to your computer first for faster loading
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  Select the top-level folder, not individual files. OpenRad will find all images automatically
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">&#x2713;</span>
                  Works best in Chrome or Edge. Safari and Firefox are supported but may be slower
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12">
            <Link
              href="/viewer"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-background transition-all hover:glow-green hover:scale-[1.02] active:scale-[0.98]"
            >
              Open Viewer
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
