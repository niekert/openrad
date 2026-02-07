import { promises as fs } from "node:fs";
import path from "node:path";

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

async function assertDicomExamples() {
  const root = path.resolve("dicom-examples");
  let files;
  try {
    files = await walk(root);
  } catch {
    throw new Error("dicom-examples/ directory is missing or unreadable");
  }

  const dicomFiles = files.filter((file) => file.toLowerCase().endsWith(".dcm"));
  const dicomdirFiles = files.filter((file) => path.basename(file).toUpperCase() === "DICOMDIR");

  if (dicomFiles.length === 0 && dicomdirFiles.length === 0) {
    throw new Error("dicom-examples/ contains no .dcm files or DICOMDIR");
  }

  console.log(`[smoke:viewer] dicom-examples OK (${dicomFiles.length} .dcm, ${dicomdirFiles.length} DICOMDIR)`);
}

async function assertRuntimeInitGuard() {
  const runtimePath = path.resolve("src/lib/cornerstone/runtime.ts");
  const content = await fs.readFile(runtimePath, "utf8");

  const hasAwaitInitCore = content.includes("await initCore()");
  const hasAwaitInitBeforeRegister = content.includes("await initCornerstoneRuntime();");

  if (!hasAwaitInitCore || !hasAwaitInitBeforeRegister) {
    throw new Error("Cornerstone runtime init guard is missing (expected awaited initCore + awaited runtime init)");
  }

  console.log("[smoke:viewer] runtime init guard OK");
}

async function assertSessionScopedImageIds() {
  const loaderPath = path.resolve("src/lib/cornerstone/custom-image-loader.ts");
  const content = await fs.readFile(loaderPath, "utf8");
  if (!content.includes("`${IMAGE_SCHEME}:${sessionId}:${fileKey}`")) {
    throw new Error("Session-scoped image ID format check failed");
  }
  console.log("[smoke:viewer] session-scoped image IDs OK");
}

async function main() {
  await assertDicomExamples();
  await assertRuntimeInitGuard();
  await assertSessionScopedImageIds();
  console.log("[smoke:viewer] PASS");
}

main().catch((error) => {
  console.error("[smoke:viewer] FAIL", error instanceof Error ? error.message : error);
  process.exit(1);
});
