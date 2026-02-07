"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import type { StudyTree, Series, Study } from "@/lib/dicom/types";
import type { WindowPreset } from "@/lib/cornerstone/presets";
import { CT_PRESETS } from "@/lib/cornerstone/presets";
import { registerFiles, clearFiles } from "@/lib/dicom/file-manager";
import { parseDicomdirFromFiles } from "@/lib/dicom/parse-dicomdir";
import { parseFilesWithoutDicomdir } from "@/lib/dicom/parse-files";
import { findTopogramSeries } from "@/lib/dicom/topogram-utils";
import { findNearestSliceByPosition, mapByRelativeIndex } from "@/lib/dicom/slice-sync";
import { FEATURES } from "@/lib/features";
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
import ComparePanel from "./ComparePanel";

function isPermissionDeniedError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "NotAllowedError" || error.name === "SecurityError";
  }

  return error instanceof Error && error.message === "permission-denied";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
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
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [fsApiSupported, setFsApiSupported] = useState(false);
  const [recentDirectories, setRecentDirectories] = useState<RecentDirectoryEntry[]>([]);
  const [activeRecentId, setActiveRecentId] = useState<string | null>(null);
  const [reconnectTargetId, setReconnectTargetId] = useState<string | null>(null);
  const [pickerBusy, setPickerBusy] = useState(false);
  const directoryPickerPromiseRef = useRef<Promise<void> | null>(null);

  // Slice/window state for status bar (primary viewport)
  const [currentSlice, setCurrentSlice] = useState(0);
  const [totalSlices, setTotalSlices] = useState(0);
  const [windowWidth, setWindowWidth] = useState(400);
  const [windowCenter, setWindowCenter] = useState(40);
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);

  // Topogram state (primary series)
  const [currentSlicePosition, setCurrentSlicePosition] = useState<number[] | null>(null);
  const [axialSlicePositions, setAxialSlicePositions] = useState<(number[] | null)[] | null>(null);
  const [jumpToSliceIndex, setJumpToSliceIndex] = useState<number | null>(null);

  // Compare state
  const [compareSeries, setCompareSeries] = useState<Series | null>(null);
  const [compareCurrentSlice, setCompareCurrentSlice] = useState(0);
  const [compareTotalSlices, setCompareTotalSlices] = useState(0);
  const [compareAxialSlicePositions, setCompareAxialSlicePositions] = useState<(number[] | null)[] | null>(null);
  const [jumpToCompareSliceIndex, setJumpToCompareSliceIndex] = useState<number | null>(null);

  // Panel manager state
  const [openPanelIds, setOpenPanelIds] = useState<Set<string>>(new Set());
  const [topogramPanelWidth, setTopogramPanelWidth] = useState(200);
  const [comparePanelWidth, setComparePanelWidth] = useState(320);

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

    setLoadingMessage("Reading DICOMDIR...");
    let tree: StudyTree | null = null;
    try {
      tree = await withTimeout(
        parseDicomdirFromFiles(files),
        7000,
        "dicomdir-timeout"
      );
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "dicomdir-timeout") {
        throw error;
      }
    }

    if (!tree || tree.studies.length === 0) {
      setLoadingMessage("Scanning files...");
      tree = await withTimeout(
        parseFilesWithoutDicomdir(files, (done, total) => {
          setProgress({ done, total });
          setLoadingMessage(
            `Scanning files... ${done.toLocaleString()} / ${total.toLocaleString()}`
          );
        }),
        120000,
        "scan-timeout"
      );
    }

    setStudyTree(tree);

    const firstSeries = tree.studies[0]?.series[0] || null;
    setActiveSeries(firstSeries);
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
      setLoadingMessage("Requesting folder access...");

      try {
        const permission = options.requestPermission
          ? await requestReadPermission(handle)
          : await queryReadPermission(handle);

        if (permission !== "granted") {
          throw new Error("permission-denied");
        }

        setLoadingMessage("Reading files from folder...");
        const files = await readAllFilesFromDirectory(handle, (readCount) => {
          setLoadingMessage(`Reading files from folder... ${readCount.toLocaleString()}`);
        });
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
          } else if (error instanceof Error && error.message === "scan-timeout") {
            alert("File scan timed out. Please select a smaller folder or reconnect again.");
          } else if (error instanceof Error && error.message === "empty-directory") {
            alert("The selected folder does not contain readable files.");
          } else {
            alert("Failed to read DICOM files from this folder.");
          }
        }
      } finally {
        setLoading(false);
        setProgress(null);
        setLoadingMessage(null);
      }
    },
    [parseAndLoadFiles, refreshRecentDirectories]
  );

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      setLoading(true);
      setProgress(null);
      setLoadingMessage("Preparing files...");

      try {
        await parseAndLoadFiles(files);
      } catch (err) {
        console.error("Failed to parse DICOM files:", err);
        alert("Failed to parse DICOM files. Make sure you selected a valid DICOM folder.");
      } finally {
        setLoading(false);
        setProgress(null);
        setLoadingMessage(null);
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

  const activeStudy = useMemo<Study | null>(() => {
    if (!studyTree || !activeSeries) return null;
    return (
      studyTree.studies.find((study) =>
        study.series.some((series) => series.seriesInstanceUID === activeSeries.seriesInstanceUID)
      ) || null
    );
  }, [studyTree, activeSeries]);

  const compareStudy = useMemo<Study | null>(() => {
    if (!studyTree || !compareSeries) return null;
    return (
      studyTree.studies.find((study) =>
        study.series.some((series) => series.seriesInstanceUID === compareSeries.seriesInstanceUID)
      ) || null
    );
  }, [studyTree, compareSeries]);

  // Find topogram series for the active series' study
  const topogramSeries = useMemo(() => {
    if (!activeSeries || !activeStudy) return null;

    const topo = findTopogramSeries(activeStudy);
    if (topo && topo.seriesInstanceUID === activeSeries.seriesInstanceUID) return null;

    return topo;
  }, [activeSeries, activeStudy]);

  // Reset topogram/compare state when active series changes
  useEffect(() => {
    setCurrentSlicePosition(null);
    setAxialSlicePositions(null);
    setJumpToSliceIndex(null);

    setCompareSeries(null);
    setCompareCurrentSlice(0);
    setCompareTotalSlices(0);
    setCompareAxialSlicePositions(null);
    setJumpToCompareSliceIndex(null);
  }, [activeSeries]);

  // Auto-open topogram panel when it becomes available, auto-close when it doesn't
  const prevTopogramRef = useRef(topogramSeries);
  useEffect(() => {
    const hadTopogram = !!prevTopogramRef.current;
    const hasTopogram = !!topogramSeries;
    prevTopogramRef.current = topogramSeries;

    if (!hadTopogram && hasTopogram) {
      setOpenPanelIds((prev) => {
        const next = new Set(prev);
        next.add("topogram");
        return next;
      });
    }
    if (hadTopogram && !hasTopogram) {
      setOpenPanelIds((prev) => {
        const next = new Set(prev);
        next.delete("topogram");
        return next;
      });
    }
  }, [topogramSeries]);

  const handlePanelToggle = useCallback((id: string) => {
    setOpenPanelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const comparePanelOpen = FEATURES.compareViewer && openPanelIds.has("compare");
  const compareEnabled = comparePanelOpen && !!compareSeries;

  const panels = useMemo(
    () => [
      {
        id: "topogram",
        title: "Topogram",
        available: !!topogramSeries,
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3.5" y="5" width="17" height="14" rx="2" />
            <line x1="6.5" y1="9" x2="17.5" y2="9" />
            <line x1="6.5" y1="15" x2="17.5" y2="15" />
            <line x1="12" y1="5" x2="12" y2="19" />
          </svg>
        ),
      },
      {
        id: "compare",
        title: "Compare",
        available: FEATURES.compareViewer && !!activeSeries,
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3.5" y="4.5" width="7.5" height="15" rx="1.8" />
            <rect x="13" y="4.5" width="7.5" height="15" rx="1.8" />
            <path d="M10 9h4" />
            <path d="M10 15h4" />
          </svg>
        ),
      },
    ],
    [topogramSeries, activeSeries]
  );

  const handleOpenNew = useCallback(() => {
    clearFiles();
    setStudyTree(null);
    setActiveSeries(null);
    setCompareSeries(null);
    setOpenPanelIds(new Set());
  }, []);

  const handlePresetChange = useCallback((preset: WindowPreset) => {
    setActivePreset(preset);
    setPresetTrigger(preset);
    setWindowWidth(preset.windowWidth);
    setWindowCenter(preset.windowCenter);
  }, []);

  const handleSliceChange = useCallback((current: number, total: number, position: number[] | null) => {
    setCurrentSlice(current);
    setTotalSlices(total);
    setCurrentSlicePosition(position);
  }, []);

  const handleWindowChange = useCallback((ww: number, wc: number) => {
    setWindowWidth((prev) => (Math.abs(prev - ww) < 0.5 ? prev : ww));
    setWindowCenter((prev) => (Math.abs(prev - wc) < 0.5 ? prev : wc));
  }, []);

  const handleImageInfo = useCallback((w: number, h: number) => {
    setImageWidth(w);
    setImageHeight(h);
  }, []);

  const handleAxialPositionsReady = useCallback((positions: (number[] | null)[]) => {
    setAxialSlicePositions(positions);
  }, []);

  const handleCompareAxialPositionsReady = useCallback((positions: (number[] | null)[]) => {
    setCompareAxialSlicePositions(positions);
  }, []);

  const handleJumpToSlice = useCallback((index: number) => {
    setJumpToSliceIndex(index);
  }, []);

  const handlePrimarySliceIndexChange = useCallback(
    (index: number, total: number, position: number[] | null) => {
      if (!compareEnabled || !compareSeries) return;

      let mappedIndex: number | null = null;
      if (compareAxialSlicePositions && compareAxialSlicePositions.length > 0) {
        mappedIndex = findNearestSliceByPosition(position, compareAxialSlicePositions);
      }

      if (mappedIndex == null) {
        mappedIndex = mapByRelativeIndex(index, total, compareSeries.instances.length);
      }

      setJumpToCompareSliceIndex(mappedIndex);
    },
    [compareEnabled, compareSeries, compareAxialSlicePositions]
  );

  const handleCompareSliceChange = useCallback((current: number, total: number) => {
    setCompareCurrentSlice(current);
    setCompareTotalSlices(total);
  }, []);

  const handleSelectCompareSeries = useCallback((series: Series) => {
    setCompareSeries(series);
    setCompareAxialSlicePositions(null);
    setJumpToCompareSliceIndex(0);
  }, []);

  const handleClearCompareSeries = useCallback(() => {
    setCompareSeries(null);
    setCompareCurrentSlice(0);
    setCompareTotalSlices(0);
    setCompareAxialSlicePositions(null);
    setJumpToCompareSliceIndex(null);
  }, []);

  const syncedWindow = useMemo(
    () => ({ width: windowWidth, center: windowCenter }),
    [windowWidth, windowCenter]
  );

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
          loadingMessage={loadingMessage}
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
                  activePanelIds={openPanelIds}
                  onPanelToggle={handlePanelToggle}
                />
                {openPanelIds.has("topogram") && topogramSeries && (
                  <PanelContainer
                    title="Topogram"
                    width={topogramPanelWidth}
                    onWidthChange={setTopogramPanelWidth}
                  >
                    <TopogramPanel
                      series={topogramSeries}
                      currentSlicePosition={currentSlicePosition}
                      axialSlicePositions={axialSlicePositions}
                      onJumpToSlice={handleJumpToSlice}
                    />
                  </PanelContainer>
                )}

                {FEATURES.compareViewer && openPanelIds.has("compare") && (
                  <PanelContainer
                    title="Compare"
                    width={comparePanelWidth}
                    onWidthChange={setComparePanelWidth}
                  >
                    <ComparePanel
                      studyTree={studyTree}
                      activeSeries={activeSeries}
                      selectedCompareSeries={compareSeries}
                      onSelectCompareSeries={handleSelectCompareSeries}
                      onClearCompareSeries={handleClearCompareSeries}
                    />
                  </PanelContainer>
                )}

                {compareEnabled && compareSeries ? (
                  <div className="grid flex-1 grid-cols-2 overflow-hidden">
                    <div className="flex min-w-0 flex-col border-r border-border">
                      <div className="flex h-8 items-center justify-between border-b border-border px-3 text-[11px] text-muted">
                        <span className="uppercase tracking-widest">Prior</span>
                        <span>
                          {compareStudy?.studyDate ? formatDate(compareStudy.studyDate) : ""}
                          {compareTotalSlices > 0 ? ` · ${compareCurrentSlice}/${compareTotalSlices}` : ""}
                        </span>
                      </div>
                      <DicomViewport
                        viewportKey="compare"
                        series={compareSeries}
                        activeTool={activeTool}
                        activePreset={presetTrigger}
                        onSliceChange={handleCompareSliceChange}
                        onWindowChange={handleWindowChange}
                        onImageInfo={() => {
                          // Primary viewport owns status bar dimensions.
                        }}
                        onAxialPositionsReady={handleCompareAxialPositionsReady}
                        jumpToSliceIndex={jumpToCompareSliceIndex}
                        forcedWindow={syncedWindow}
                      />
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <div className="flex h-8 items-center justify-between border-b border-border px-3 text-[11px] text-muted">
                        <span className="uppercase tracking-widest">Current</span>
                        <span>{activeStudy?.studyDate ? formatDate(activeStudy.studyDate) : ""}</span>
                      </div>
                      <DicomViewport
                        viewportKey="primary"
                        series={activeSeries}
                        activeTool={activeTool}
                        activePreset={presetTrigger}
                        onSliceChange={handleSliceChange}
                        onSliceIndexChange={handlePrimarySliceIndexChange}
                        onWindowChange={handleWindowChange}
                        onImageInfo={handleImageInfo}
                        onAxialPositionsReady={handleAxialPositionsReady}
                        jumpToSliceIndex={jumpToSliceIndex}
                        forcedWindow={syncedWindow}
                      />
                    </div>
                  </div>
                ) : (
                  <DicomViewport
                    viewportKey="primary"
                    series={activeSeries}
                    activeTool={activeTool}
                    activePreset={presetTrigger}
                    onSliceChange={handleSliceChange}
                    onSliceIndexChange={handlePrimarySliceIndexChange}
                    onWindowChange={handleWindowChange}
                    onImageInfo={handleImageInfo}
                    onAxialPositionsReady={handleAxialPositionsReady}
                    jumpToSliceIndex={jumpToSliceIndex}
                    forcedWindow={syncedWindow}
                  />
                )}
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

function formatDate(dicomDate: string): string {
  if (dicomDate.length !== 8) return dicomDate;
  return `${dicomDate.slice(0, 4)}-${dicomDate.slice(4, 6)}-${dicomDate.slice(6, 8)}`;
}
