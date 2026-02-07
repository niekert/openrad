import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "openrad — View Medical Images in Your Browser",
  description:
    "View CT scans, MRI, and X-rays instantly in the browser. No uploads, no installs, 100% private. Open source DICOM viewer for any medical imaging modality.",
  keywords: [
    "DICOM viewer",
    "CT scan viewer",
    "MRI viewer",
    "X-ray viewer",
    "medical imaging",
    "browser DICOM",
    "open source DICOM",
    "medical image viewer",
    "openrad",
    "DICOM CD viewer",
    "radiology viewer",
  ],
  verification: {
    google: "8GG_Gw0npilqZ8NbLSdZe-rOtjPwlxjm8P8j2X7yzl0",
  },
  openGraph: {
    title: "openrad — View Medical Images in Your Browser",
    description:
      "View CT scans, MRI, and X-rays instantly in the browser. No uploads, no installs, 100% private.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased noise">
        {children}
      </body>
    </html>
  );
}
