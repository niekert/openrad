# Repository Guidelines

## Project Structure & Module Organization
OpenRad is a Next.js 16 + TypeScript app. Main code lives in `src/`.
- `src/app/`: App Router pages (`page.tsx`, modality pages, `viewer` route).
- `src/components/landing/`: marketing/landing UI sections.
- `src/components/viewer/`: viewer UI (viewport, toolbar, study browser, panels).
- `src/lib/dicom/`: DICOM parsing, file indexing, DICOMDIR handling.
- `src/lib/cornerstone/`: Cornerstone initialization, loaders, presets.
- `public/`: static assets (icons, screenshot).
- `dicom-examples/`: local sample studies for manual verification.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: run local dev server at `http://localhost:3000`.
- `npm run build`: create production build and catch build-time issues.
- `npm run start`: serve the production build.
- `npm run lint`: run ESLint checks.

## Coding Style & Naming Conventions
- Language: TypeScript (`strict` enabled in `tsconfig.json`).
- Formatting: 2-space indentation, semicolons, double quotes.
- Components/hooks: PascalCase component names and files (for example, `ViewerApp.tsx`).
- Utility modules: kebab-case file names (for example, `parse-files.ts`).
- Imports: prefer `@/*` alias for `src/*` paths.
- Linting: ESLint via `eslint.config.mjs` (`eslint-config-next` core-web-vitals + TypeScript rules).
- Type safety policy: do not use TypeScript type assertions/casts (`as`, non-null assertions, double assertions). If a cast is truly unavoidable, stop and get explicit approval in the PR/issue before introducing it, and document why the cast is safe.

## Testing Guidelines
There is no dedicated automated test framework configured yet. For every change:
- run `npm run lint`;
- run `npm run build` for integration-level validation.

When adding non-trivial logic, introduce tests with names like `*.test.ts` or `*.test.tsx` near the related code or in a future `tests/` folder.

## Commit & Pull Request Guidelines
Follow the existing history style: short, imperative commit messages (for example, `Fix viewer panel alignment`, `Add topogram panel`).
- Keep each commit focused on one logical change.
- Open PRs with a clear summary and linked issue (if applicable).
- Include screenshots/GIFs for UI changes.
- Note which `dicom-examples/` dataset was used to validate behavior.

## Security & Data Handling
This project is designed for local, in-browser DICOM viewing. Do not commit patient-identifiable data. Use only de-identified datasets in `dicom-examples/` and documentation.

## Example Data Notes
- `dicom-examples/` contains de-identified CT studies used for viewer development and manual QA.
- Keep examples free of PII in directory names, screenshots, tests, and docs.
- Compare-feature validation should cover at least the thorax/abdomen and hals/thorax/abdomen example sets, including topogram, soft kernel, and lung kernel series variants.
