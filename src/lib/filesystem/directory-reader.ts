import { setFileRelativePath } from "@/lib/dicom/file-path";

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker({ mode: "read" });
}

export async function queryReadPermission(
  handle: FileSystemDirectoryHandle
): Promise<PermissionState> {
  return handle.queryPermission({ mode: "read" });
}

export async function requestReadPermission(
  handle: FileSystemDirectoryHandle
): Promise<PermissionState> {
  return handle.requestPermission({ mode: "read" });
}

export async function readAllFilesFromDirectory(
  handle: FileSystemDirectoryHandle
): Promise<File[]> {
  const files: File[] = [];

  const walk = async (dir: FileSystemDirectoryHandle, pathSegments: string[]): Promise<void> => {
    for await (const entry of dir.values()) {
      if (entry.kind === "file") {
        const file = await entry.getFile();
        const relativePath = [handle.name, ...pathSegments, entry.name].join("/");
        setFileRelativePath(file, relativePath);
        files.push(file);
        continue;
      }

      if (entry.kind === "directory") {
        await walk(entry, [...pathSegments, entry.name]);
      }
    }
  };

  await walk(handle, []);
  return files;
}
