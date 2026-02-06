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
  title: "OpenCT — View CT Scans in Your Browser",
  description:
    "View your hospital CT scan DICOM files instantly in the browser. No uploads, no installs, 100% private. Works with any DICOM CD or folder.",
  keywords: [
    "CT scan viewer",
    "DICOM viewer",
    "medical imaging",
    "browser DICOM",
    "CT scan online",
    "DICOM CD viewer",
    "medical image viewer",
    "open source DICOM",
  ],
  openGraph: {
    title: "OpenCT — View CT Scans in Your Browser",
    description:
      "View your hospital CT scan DICOM files instantly in the browser. No uploads, no installs, 100% private.",
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
