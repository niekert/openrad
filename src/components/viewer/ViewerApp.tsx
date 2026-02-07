"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import type { StudyTree, Series } from "@/lib/dicom/types";
import type { WindowPreset } from "@/lib/cornerstone/presets";
import { CT_PRESETS } from "@/lib/cornerstone/presets";
import { registerFiles, clearFiles } from "@/lib/dicom/file-manager";
import { parseDicomdirFromFiles } from "@/lib/dicom/parse-dicomdir";
import { parseFilesWithoutDicomdir } from "@/lib/dicom/parse-files";
import { findTopogramSeries } from "@/lib/dicom/topogram-utils";
import {
  findMatchingRecent,
  listRecentDirectories,
  markRecentDirectoryStatus,
  removeRecentDirectory,
  saveRecentDirectory,
  touchRecentDirectory,
  type RecentDirectoryEntry,
} from "@/lib/filesystem/persistent-directories";
import {
  isFileSystemAccessSupported,
  pickDirectory,
  queryReadPermission,
  readAllFilesFromDirectory,
  requestReadPermission,
} from "@/lib/filesystem/directory-reader";
import FileDropZone from "./FileDropZone";
import StudyBrowser from "./StudyBrowser";
import Toolbar, { type ToolName } from "./Toolbar";
import StatusBar from "./StatusBar";
import DicomViewport from "./DicomViewport";
import TopogramPanel from "./TopogramPanel";
import PanelActivityBar from "./PanelActivityBar";
import PanelContainer from "./PanelContainer";

function isPermissionDeniedError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "NotAllowedError" || error.name === "SecurityError";
  }

  return error instanceof Error && error.message === "permission-denied";
}

export default function ViewerApp() {
  const [studyTree, setStudyTree] = useState<StudyTree | null>(null);
  const [activeSeries, setActiveSeries] = useState<Series | null>(null);
  const [activeTool, setActiveTool] = useState<ToolName>("WindowLevel");
  const [activePreset, setActivePreset] = useState<WindowPreset>(CT_PRESETS[0]);
  const [presetTrigger, setPresetTrigger] = useState<WindowPreset | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [fsApiSupported, setFsApiSupported] = useState(false);
  const [recentDirectories, setRecentDirectories] = useState<RecentDirectoryEntry[]>([]);
  const [activeRecentId, setActiveRecentId] = useState<string | null>(null);
  const [reconnectTargetId, setReconnectTargetId] = useState<string | null>(null);
  const [pickerBusy, setPickerBusy] = useState(false);
  const directoryPickerPromiseRef = useRef<Promise<void> | null>(null);

  // Slice/window state for status bar
  const [currentSlice, setCurrentSlice] = useState(0);
  const [totalSlices, setTotalSlices] = useState(0);
  const [windowWidth, setWindowWidth] = useState(400);
  const [windowCenter, setWindowCenter] = useState(40);
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);

  // Topogram state
  const [currentSlicePosition, setCurrentSlicePosition] = useState<number[] | null>(null);
  const [axialSlicePositions, setAxialSlicePositions] = useState<(number[] | null)[] | null>(null);
  const [jumpToSliceIndex, setJumpToSliceIndex] = useState<number | null>(null);

  // Panel manager state
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(200);

  const refreshRecentDirectories = useCallback(async () => {
    if (!isFileSystemAccessSupported()) {
      setRecentDirectories([]);
      return;
    }

    const recents = await listRecentDirectories();
    setRecentDirectories(recents);
  }, []);

  const parseAndLoadFiles = useCallback(async (files: File[]) => {
    clearFiles();
    registerFiles(files);

    let tree = await parseDicomdirFromFiles(files);

    if (!tree || tree.studies.length === 0) {
      tree = await parseFilesWithoutDicomdir(files, (done, total) => {
        setProgress({ done, total });
      });
    }

    setStudyTree(tree);

    if (tree.studies.length > 0 && tree.studies[0].series.length > 0) {
      setActiveSeries(tree.studies[0].series[0]);
    } else {
      setActiveSeries(null);
    }
  }, []);

  const openDirectoryHandle = useCallback(
    async (
      handle: FileSystemDirectoryHandle,
      options: {
        existingId?: string;
        requestPermission: boolean;
        showErrorAlert?: boolean;
      }
    ) => {
      setLoading(true);
      setProgress(null);

      try {
        const permission = options.requestPermission
          ? await requestReadPermission(handle)
          : await queryReadPermission(handle);

        if (permission !== "granted") {
          throw new Error("permission-denied");
        }

        const files = await readAllFilesFromDirectory(handle);
        if (files.length === 0) {
          throw new Error("empty-directory");
        }

        await parseAndLoadFiles(files);

        let savedId = options.existingId;
        if (savedId) {
          await touchRecentDirectory(savedId);
          await markRecentDirectoryStatus(savedId, "ready");
        } else {
          const existing = await findMatchingRecent(handle);
          if (existing) {
            await touchRecentDirectory(existing.id);
            await markRecentDirectoryStatus(existing.id, "ready");
            savedId = existing.id;
          } else {
            const created = await saveRecentDirectory(handle);
            savedId = created.id;
          }
        }

        setActiveRecentId(savedId || null);
        setReconnectTargetId(null);
        await refreshRecentDirectories();
      } catch (error) {
        console.error("Failed to open directory:", error);

        if (options.existingId) {
          if (isPermissionDeniedError(error)) {
            await markRecentDirectoryStatus(options.existingId, "needs-permission");
            setReconnectTargetId(options.existingId);
          } else {
            await markRecentDirectoryStatus(options.existingId, "unavailable");
          }
          await refreshRecentDirectories();
        }

        if (options.showErrorAlert !== false) {
          if (isPermissionDeniedError(error)) {
            alert("OpenRad needs read access to that folder. Click Reconnect to grant access.");
          } else if (error instanceof Error && error.message === "empty-directory") {
            alert("The selected folder does not contain readable files.");
          } else {
            alert("Failed to read DICOM files from this folder.");
          }
        }
      } finally {
        setLoading(false);
        setProgress(null);
      }
    },
    [parseAndLoadFiles, refreshRecentDirectories]
  );

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      setLoading(true);
      setProgress(null);

      try {
        await parseAndLoadFiles(files);
      } catch (err) {
        console.error("Failed to parse DICOM files:", err);
        alert("Failed to parse DICOM files. Make sure you selected a valid DICOM folder.");
      } finally {
        setLoading(false);
        setProgress(null);
      }
    },
    [parseAndLoadFiles]
  );

  const handlePickDirectory = useCallback(async () => {
    if (!fsApiSupported || loading || bootstrapping) return;
    if (directoryPickerPromiseRef.current) return;

    const pickerTask = (async () => {
      setPickerBusy(true);

      try {
        const handle = await pickDirectory();
        await openDirectoryHandle(handle, {
          requestPermission: true,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (
          error instanceof DOMException &&
          error.name === "NotAllowedError" &&
          error.message.includes("already active")
        ) {
          return;
        }

        console.error("Directory picker failed:", error);
        alert("Failed to open directory picker.");
      } finally {
        setPickerBusy(false);
        directoryPickerPromiseRef.current = null;
      }
    })();

    directoryPickerPromiseRef.current = pickerTask;
    await pickerTask;
  }, [bootstrapping, fsApiSupported, loading, openDirectoryHandle]);

  const handleOpenRecent = useCallback(
    async (id: string) => {
      const recent = recentDirectories.find((entry) => entry.id === id);
      if (!recent) return;

      setActiveRecentId(id);

      try {
        const permission = await queryReadPermission(recent.handle);
        if (permission !== "granted") {
          await markRecentDirectoryStatus(id, "needs-permission");
          await refreshRecentDirectories();
          setReconnectTargetId(id);
          return;
        }

        await openDirectoryHandle(recent.handle, {
          existingId: id,
          requestPermission: false,
        });
      } catch (error) {
        console.error("Failed to open recent folder:", error);
        await markRecentDirectoryStatus(id, "unavailable");
        await refreshRecentDirectories();
        alert("That recent folder is unavailable. Reconnect or remove it.");
      }
    },
    [openDirectoryHandle, recentDirectories, refreshRecentDirectories]
  );

  const handleReconnectRecent = useCallback(
    async (id: string) => {
      const recent = recentDirectories.find((entry) => entry.id === id);
      if (!recent) return;

      setActiveRecentId(id);

      await openDirectoryHandle(recent.handle, {
        existingId: id,
        requestPermission: true,
      });
    },
    [openDirectoryHandle, recentDirectories]
  );

  const handleRemoveRecent = useCallback(
    async (id: string) => {
      await removeRecentDirectory(id);
      if (activeRecentId === id) {
        setActiveRecentId(null);
      }
      if (reconnectTargetId === id) {
        setReconnectTargetId(null);
      }
      await refreshRecentDirectories();
    },
    [activeRecentId, reconnectTargetId, refreshRecentDirectories]
  );

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const supported = isFileSystemAccessSupported();
      if (cancelled) return;

      setFsApiSupported(supported);

      if (!supported) {
        setBootstrapping(false);
        return;
      }

      try {
        const recents = await listRecentDirectories();
        if (cancelled) return;

        setRecentDirectories(recents);

        if (recents.length === 0) {
          setBootstrapping(false);
          return;
        }

        const latest = recents[0];
        setActiveRecentId(latest.id);

        const permission = await queryReadPermission(latest.handle);
        if (cancelled) return;

        if (permission === "granted") {
          await openDirectoryHandle(latest.handle, {
            existingId: latest.id,
            requestPermission: false,
            showErrorAlert: false,
          });
        } else {
          await markRecentDirectoryStatus(latest.id, "needs-permission");
          await refreshRecentDirectories();
          setReconnectTargetId(latest.id);
        }
      } catch (error) {
        console.error("Failed to restore recent folders:", error);
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [openDirectoryHandle, refreshRecentDirectories]);

  // Find topogram series for the active series' study
  const topogramSeries = useMemo(() => {
    if (!activeSeries || !studyTree) return null;

    const study = studyTree.studies.find((s) =>
      s.series.some((ser) => ser.seriesInstanceUID === activeSeries.seriesInstanceUID)
    );
    if (!study) return null;

    const topo = findTopogramSeries(study);
    if (topo && topo.seriesInstanceUID === activeSeries.seriesInstanceUID) return null;

    return topo;
  }, [activeSeries, studyTree]);

  // Reset topogram state when active series changes
  useEffect(() => {
    setCurrentSlicePosition(null);
    setAxialSlicePositions(null);
    setJumpToSliceIndex(null);
  }, [activeSeries]);

  // Auto-open topogram panel when it becomes available, auto-close when it doesn't
  const prevTopogramRef = useRef(topogramSeries);
  useEffect(() => {
    const hadTopogram = !!prevTopogramRef.current;
    const hasTopogram = !!topogramSeries;
    prevTopogramRef.current = topogramSeries;

    if (!hadTopogram && hasTopogram) {
      setActivePanelId("topogram");
    }
    if (hadTopogram && !hasTopogram) {
      setActivePanelId((prev) => (prev === "topogram" ? null : prev));
    }
  }, [topogramSeries]);

  const handlePanelToggle = useCallback((id: string) => {
    setActivePanelId((prev) => (prev === id ? null : id));
  }, []);

  const panels = useMemo(
    () => [
      {
        id: "topogram",
        title: "Topogram",
        available: !!topogramSeries,
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="6" y="2" width="12" height="20" rx="2" />
            <line x1="6" y1="12" x2="18" y2="12" strokeWidth="2" stroke="currentColor" />
          </svg>
        ),
      },
    ],
    [topogramSeries]
  );

  const handleOpenNew = useCallback(() => {
    clearFiles();
    setStudyTree(null);
    setActiveSeries(null);
  }, []);

  const handlePresetChange = useCallback((preset: WindowPreset) => {
    setActivePreset(preset);
    setPresetTrigger(preset);
  }, []);

  const handleSliceChange = useCallback((current: number, total: number, position: number[] | null) => {
    setCurrentSlice(current);
    setTotalSlices(total);
    setCurrentSlicePosition(position);
  }, []);

  const handleWindowChange = useCallback((ww: number, wc: number) => {
    setWindowWidth(ww);
    setWindowCenter(wc);
  }, []);

  const handleImageInfo = useCallback((w: number, h: number) => {
    setImageWidth(w);
    setImageHeight(h);
  }, []);

  const handleAxialPositionsReady = useCallback((positions: (number[] | null)[]) => {
    setAxialSlicePositions(positions);
  }, []);

  const handleJumpToSlice = useCallback((index: number) => {
    setJumpToSliceIndex(index);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const num = parseInt(e.key);
      if (num >= 1 && num <= CT_PRESETS.length) {
        handlePresetChange(CT_PRESETS[num - 1]);
        return;
      }

      switch (e.key) {
        case "w":
          setActiveTool("WindowLevel");
          break;
        case "p":
          setActiveTool("Pan");
          break;
        case "z":
          setActiveTool("Zoom");
          break;
        case "m":
          setActiveTool("Length");
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handlePresetChange]);

  if (!studyTree) {
    return (
      <div className="flex h-screen flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-2 glass">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />
            OpenRad
          </Link>
        </header>
        <FileDropZone
          onFilesSelected={handleFilesSelected}
          onPickDirectory={handlePickDirectory}
          onOpenRecent={handleOpenRecent}
          onReconnectRecent={handleReconnectRecent}
          onRemoveRecent={handleRemoveRecent}
          fsApiSupported={fsApiSupported}
          pickerBusy={pickerBusy}
          recentDirectories={recentDirectories}
          reconnectTargetId={reconnectTargetId}
          loading={loading || bootstrapping}
          progress={progress}
        />
      </div>
    );
  }

  const activeRecent = recentDirectories.find((entry) => entry.id === activeRecentId) || null;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-2 glass">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" />
          OpenRad
        </Link>
        <span className="text-xs text-muted truncate max-w-xs">
          {activeRecent ? `${activeRecent.name} · ` : ""}
          {activeSeries?.seriesDescription}
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-lg px-3 py-1 text-xs text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            Home
          </Link>
          <button
            onClick={handleOpenNew}
            className="rounded-lg border border-border-bright px-3 py-1 text-xs transition-colors hover:bg-surface"
          >
            Open New
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <StudyBrowser
          studyTree={studyTree}
          activeSeries={activeSeries}
          onSelectSeries={setActiveSeries}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          {activeSeries ? (
            <>
              <Toolbar
                activeTool={activeTool}
                onToolChange={setActiveTool}
                onPresetChange={handlePresetChange}
                activePreset={activePreset.name}
              />
              <div className="flex flex-1 overflow-hidden">
                <PanelActivityBar
                  panels={panels}
                  activePanelId={activePanelId}
                  onPanelToggle={handlePanelToggle}
                />
                {activePanelId === "topogram" && topogramSeries && (
                  <PanelContainer
                    title="Topogram"
                    width={panelWidth}
                    onWidthChange={setPanelWidth}
                  >
                    <TopogramPanel
                      series={topogramSeries}
                      currentSlicePosition={currentSlicePosition}
                      axialSlicePositions={axialSlicePositions}
                      onJumpToSlice={handleJumpToSlice}
                    />
                  </PanelContainer>
                )}
                <DicomViewport
                  series={activeSeries}
                  activeTool={activeTool}
                  activePreset={presetTrigger}
                  onSliceChange={handleSliceChange}
                  onWindowChange={handleWindowChange}
                  onImageInfo={handleImageInfo}
                  onAxialPositionsReady={handleAxialPositionsReady}
                  jumpToSliceIndex={jumpToSliceIndex}
                />
              </div>
              <StatusBar
                currentSlice={currentSlice}
                totalSlices={totalSlices}
                windowWidth={windowWidth}
                windowCenter={windowCenter}
                imageWidth={imageWidth}
                imageHeight={imageHeight}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted">
              Select a series to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
