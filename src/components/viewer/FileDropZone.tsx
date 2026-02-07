"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { RecentDirectoryEntry } from "@/lib/filesystem/persistent-directories";

interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  onPickDirectory: () => void;
  onOpenRecent: (id: string) => void;
  onReconnectRecent: (id: string) => void;
  onRemoveRecent: (id: string) => void;
  fsApiSupported: boolean;
  pickerBusy: boolean;
  recentDirectories: RecentDirectoryEntry[];
  reconnectTargetId: string | null;
  loading?: boolean;
  progress?: { done: number; total: number } | null;
}

export default function FileDropZone({
  onFilesSelected,
  onPickDirectory,
  onOpenRecent,
  onReconnectRecent,
  onRemoveRecent,
  fsApiSupported,
  pickerBusy,
  recentDirectories,
  reconnectTargetId,
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
      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        const allFiles: File[] = [];
        let pending = 0;

        function readEntry(entry: FileSystemEntry) {
          if (entry.isFile) {
            pending++;
            (entry as FileSystemFileEntry).file((f) => {
              Object.defineProperty(f, "webkitRelativePath", {
                value: entry.fullPath.slice(1),
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
              for (const child of entries) readEntry(child);
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

  const handleDropZoneClick = useCallback(() => {
    if (loading || pickerBusy) return;

    if (fsApiSupported) {
      return;
    }

    inputRef.current?.click();
  }, [fsApiSupported, loading, pickerBusy]);

  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="flex w-full max-w-3xl flex-col gap-4">
        <div
          className={`relative flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16 transition-all cursor-pointer ${
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
          onClick={handleDropZoneClick}
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
              <p className="text-base font-medium">Drop your DICOM folder here</p>
              <p className="mt-1 text-sm text-muted">
                {fsApiSupported ? "or click to pick a folder" : "or click to browse"}
              </p>
              {fsApiSupported ? (
                <button
                  type="button"
                  disabled={pickerBusy || loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPickDirectory();
                  }}
                  className="mt-6 rounded-lg border border-border-bright px-4 py-2 text-sm transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pickerBusy ? "Opening..." : "Open Folder"}
                </button>
              ) : (
                <p className="mt-4 text-xs text-muted text-center max-w-md">
                  Persistent folder recents require File System Access API support in Chromium-based browsers.
                </p>
              )}
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

        {fsApiSupported && recentDirectories.length > 0 && !loading && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent folders</h2>
              <span className="text-xs text-muted">{recentDirectories.length} saved</span>
            </div>
            <div className="space-y-2">
              {recentDirectories.map((recent) => {
                const needsReconnect =
                  recent.status !== "ready" || reconnectTargetId === recent.id;

                return (
                  <div
                    key={recent.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{recent.name}</p>
                      <p className="text-xs text-muted">
                        {needsReconnect ? "Permission required" : "Ready"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {needsReconnect ? (
                        <button
                          type="button"
                          onClick={() => onReconnectRecent(recent.id)}
                          className="rounded-md border border-border-bright px-3 py-1 text-xs transition-colors hover:bg-background"
                        >
                          Reconnect
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenRecent(recent.id)}
                          className="rounded-md border border-border-bright px-3 py-1 text-xs transition-colors hover:bg-background"
                        >
                          Open
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemoveRecent(recent.id)}
                        className="rounded-md px-3 py-1 text-xs text-muted transition-colors hover:bg-background hover:text-foreground"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && (
          <div className="rounded-2xl border border-border-bright bg-gradient-to-r from-surface to-background p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">New to DICOM?</p>
                <p className="mt-1 text-xs text-muted">
                  Learn what studies, series, and DICOMDIR mean before opening your folder.
                </p>
              </div>
              <Link
                href="/dicom"
                className="shrink-0 rounded-lg border border-border-bright px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface"
              >
                DICOM Guide
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
