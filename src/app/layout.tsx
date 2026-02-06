import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenRad — View Medical Images in Your Browser",
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
    "OpenRad",
    "DICOM CD viewer",
    "radiology viewer",
  ],
  openGraph: {
    title: "OpenRad — View Medical Images in Your Browser",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased noise`}
      >
        {children}
      </body>
    </html>
  );
}
