import { getFileRelativePath } from "./file-path";

const fileRegistry = new Map<string, File>();

export function registerFile(key: string, file: File): void {
  fileRegistry.set(key, file);
}

export function getFile(key: string): File | undefined {
  return fileRegistry.get(key);
}

export function clearFiles(): void {
  fileRegistry.clear();
}

export function generateFileKey(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").toLowerCase();
}

export function registerFiles(files: File[]): void {
  for (const file of files) {
    const path = getFileRelativePath(file);
    const key = generateFileKey(path);
    registerFile(key, file);
  }
}
