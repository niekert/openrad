"use client";

import { useCallback, useState, useRef } from "react";

interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  loading?: boolean;
  progress?: { done: number; total: number } | null;
}

export default function FileDropZone({
  onFilesSelected,
  loading,
  progress,
}: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      onFilesSelected(Array.from(fileList));
    },
    [onFilesSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      // webkitGetAsEntry for directory support
      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        const allFiles: File[] = [];
        let pending = 0;

        function readEntry(entry: FileSystemEntry) {
          if (entry.isFile) {
            pending++;
            (entry as FileSystemFileEntry).file((f) => {
              // Preserve the full path
              Object.defineProperty(f, "webkitRelativePath", {
                value: entry.fullPath.slice(1), // remove leading /
                writable: false,
              });
              allFiles.push(f);
              pending--;
              if (pending === 0) onFilesSelected(allFiles);
            });
          } else if (entry.isDirectory) {
            pending++;
            const reader = (entry as FileSystemDirectoryEntry).createReader();
            reader.readEntries((entries) => {
              for (const e of entries) readEntry(e);
              pending--;
              if (pending === 0) onFilesSelected(allFiles);
            });
          }
        }

        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry();
          if (entry) readEntry(entry);
        }
      } else {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles, onFilesSelected]
  );

  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div
        className={`relative flex w-full max-w-lg flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16 transition-all cursor-pointer ${
          dragging
            ? "border-accent bg-accent-dim scale-[1.01]"
            : "border-border-bright hover:border-muted"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          /* @ts-expect-error webkitdirectory is non-standard */
          webkitdirectory=""
          directory=""
          multiple
          onChange={(e) => handleFiles(e.target.files)}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-sm text-muted">
              {progress
                ? `Scanning files... ${progress.done.toLocaleString()} / ${progress.total.toLocaleString()}`
                : "Reading DICOMDIR..."}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-2xl bg-surface p-4">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-accent"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="text-base font-medium">
              Drop your DICOM folder here
            </p>
            <p className="mt-1 text-sm text-muted">or click to browse</p>
            <div className="mt-6 flex items-center gap-2 text-xs text-muted">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              Your files never leave this device
            </div>
          </>
        )}
      </div>
    </div>
  );
}
