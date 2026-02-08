# CLAUDE.md

## Project Overview
OpenRad is an open-source, browser-based DICOM medical image viewer. All processing happens locally in the browser — no uploads, no accounts, no server-side processing. Built with Next.js 16, React 19, TypeScript (strict), and Cornerstone3D v4 for rendering.

**Live:** https://openrad.vercel.app/

## Quick Reference

### Commands
- `npm run dev` — local dev server at http://localhost:3000
- `npm run build` — production build (also catches type errors)
- `npm run lint` — ESLint
- `npm run smoke:viewer` — lint + type check + smoke tests

### Code Style
- TypeScript strict, 2-space indent, semicolons, double quotes
- Components: PascalCase (`ViewerApp.tsx`), utilities: kebab-case (`parse-files.ts`)
- Imports: use `@/*` alias for `src/*`
- No type assertions (`as`, `!`) without explicit approval

### Architecture
```
src/app/                  → Next.js App Router pages (landing, viewer)
src/components/viewer/    → Viewer UI (viewport, toolbar, panels, study browser)
src/components/landing/   → Marketing/landing pages
src/lib/cornerstone/      → Cornerstone3D init, loaders, presets, runtime
src/lib/dicom/            → DICOM parsing, DICOMDIR, file indexing, types
src/lib/filesystem/       → File System Access API, persistent directories
src/lib/viewer/state/     → Redux-like store (actions, reducer, selectors)
src/lib/viewer/runtime/   → Session controller, viewer lifecycle
```

### Key Entry Points
- Viewer page: `src/app/viewer/page.tsx`
- Main viewer component: `src/components/viewer/ViewerApp.tsx`
- Session controller: `src/lib/viewer/runtime/viewer-session-controller.ts`
- State store: `src/lib/viewer/state/store.ts`
- Cornerstone runtime: `src/lib/cornerstone/runtime.ts`

## DICOM Example Data (`dicom-examples/`)

The test dataset contains **4 CT studies** (~4,350 files, ~2.15 GB total) from a Siemens scanner. All data is de-identified — no PII.

### Study Summary
| Study | Body Region | Soft Tissue Slices | Lung Slices | Total Files |
|-------|-------------|-------------------|-------------|-------------|
| 2025-09-10 | Thorax + Abdomen | ~700 | ~344 | 1,050 |
| 2025-11-13 | Thorax + Abdomen | ~697 | ~332 | 1,033 |
| 2025-12-18 | Thorax + Abdomen | ~723 | ~348 | 1,075 |
| 2026-02-02 | Neck + Thorax + Abdomen | ~820 | ~367 | 1,190 |

### Series Types Per Study
- **Topogram** (1 file) — scout/localizer image, 512x512
- **Soft tissue series** (Br36/Br40 kernel) — main diagnostic, 512x512, 1mm slices
- **Lung series** (Br56 kernel) — lung-optimized reconstruction, 512x512, 1mm slices
- **Patient protocol** (SC modality) — scan parameter documentation
- **Dose report** (SR modality) — radiation dosimetry
- **PACS report** (SR modality, Comprehensive SR) — present in 3 of 4 studies

### Technical Specs
- Image matrix: 512 x 512, 16-bit MONOCHROME2
- Slice thickness: 1 mm isotropic
- Pixel spacing: 0.827–0.937 mm (varies per study)
- Dual-kernel reconstruction: soft tissue + lung
- Modalities present: CT, SR (structured report), SC (secondary capture)

This dataset exercises key viewer features: stack scrolling through large series, topogram navigation, window/level presets (soft tissue vs lung), multi-series study browsing, and DICOMDIR-less file scanning.
