export interface OpenRadFile extends File {
  __openradRelativePath?: string;
}

export function setFileRelativePath(file: File, relativePath: string): void {
  const normalized = relativePath.replace(/\\/g, "/");
  const openRadFile = file as OpenRadFile;
  openRadFile.__openradRelativePath = normalized;

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
  const openRadFile = file as OpenRadFile;
  return openRadFile.__openradRelativePath || file.webkitRelativePath || file.name;
}
