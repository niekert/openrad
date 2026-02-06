# OpenRad

Open source medical image viewer that runs entirely in your browser. View CT scans, MRI, and X-rays without uploading files, creating an account, or installing anything.

## Features

- **100% local** — your files never leave your device
- **No account needed** — completely free, no sign-up required
- **DICOM support** — reads DICOM files, DICOMDIR indexes, and extensionless files from hospital CDs
- **Multiple modalities** — CT, MRI, X-ray, CR, DR
- **Viewing tools** — window/level presets, zoom, pan, measurements, smooth slice scrolling
- **DICOMDIR auto-detection** — instantly organizes studies and series from hospital disc structure

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

- [Next.js](https://nextjs.org/) 16
- [Cornerstone3D](https://www.cornerstonejs.org/) v4
- [dicom-parser](https://github.com/cornerstonejs/dicomParser)
- [Tailwind CSS](https://tailwindcss.com/) v4

## How It Works

1. Select a folder containing DICOM files (from a hospital CD, USB drive, or download)
2. OpenRad reads the DICOMDIR index or scans all files to find your studies and series
3. Browse, scroll, adjust contrast, zoom, and measure — all in the browser

## License

MIT
