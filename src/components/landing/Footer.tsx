import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2 font-mono text-sm text-muted">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" />
          OpenRad
        </div>
        <p className="text-xs text-muted">
          Open source. Your files never leave your device.
        </p>
        <div className="flex items-center gap-4 text-xs text-muted">
          <Link href="/ct" className="hover:text-accent transition-colors">
            CT
          </Link>
          <Link href="/mri" className="hover:text-accent transition-colors">
            MRI
          </Link>
          <Link href="/x-ray" className="hover:text-accent transition-colors">
            X-ray
          </Link>
          <Link href="/dicom" className="hover:text-accent transition-colors">
            DICOM Guide
          </Link>
          <a
            href="https://github.com/niekert/openrad"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
