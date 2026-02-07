const fileRelativePathMap = new WeakMap<File, string>();

export function setFileRelativePath(file: File, relativePath: string): void {
  const normalized = relativePath.replace(/\\/g, "/");
  fileRelativePathMap.set(file, normalized);

  // Keep webkitRelativePath in sync when browser allows redefining it.
  try {
    Object.defineProperty(file, "webkitRelativePath", {
      value: normalized,
      writable: false,
      configurable: true,
    });
  } catch {
    // Ignore when browser marks the property as non-configurable.
  }
}

export function getFileRelativePath(file: File): string {
  return fileRelativePathMap.get(file) || file.webkitRelativePath || file.name;
}
