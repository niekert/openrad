"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Series } from "@/lib/dicom/types";
import { CT_PRESETS, type WindowPreset } from "@/lib/cornerstone/presets";
import { FEATURES } from "@/lib/features";
import { createViewerStore } from "@/lib/viewer/state/store";
import {
  selectActiveSeries,
  selectActiveStudy,
  selectComparePanelOpen,
  selectCompareSeries,
  selectCompareStudy,
  selectTopogramSeries,
} from "@/lib/viewer/state/selectors";
import {
  ViewerSessionController,
  formatViewerLoadError,
} from "@/lib/viewer/runtime/viewer-session-controller";
import FileDropZone from "./FileDropZone";
import StudyBrowser from "./StudyBrowser";
import Toolbar, { type ToolName } from "./Toolbar";
import StatusBar from "./StatusBar";
import DicomViewport from "./DicomViewport";
import TopogramPanel from "./TopogramPanel";
import PanelActivityBar from "./PanelActivityBar";
import PanelContainer from "./PanelContainer";
import PriorSelectorPanel from "./PriorSelectorPanel";

export default function ViewerApp() {
  const [store] = useState(() => createViewerStore());
  const [session] = useState(() => new ViewerSessionController(store));

  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );

  const activeSeries = selectActiveSeries(state);
  const compareSeries = selectCompareSeries(state);
  const activeStudy = selectActiveStudy(state);
  const compareStudy = selectCompareStudy(state);
  const topogramSeries = selectTopogramSeries(state);
  const comparePanelOpen = selectComparePanelOpen(state);
  const [priorSelectorRequested, setPriorSelectorRequested] = useState(false);
  const priorSelectorOpen = comparePanelOpen && (priorSelectorRequested || !compareSeries);

  useEffect(() => {
    void session.start().catch((error: unknown) => {
      console.error("Viewer bootstrap failed", error);
    });

    return () => {
      session.dispose();
    };
  }, [session]);

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      try {
        await session.loadFiles(files);
      } catch (error: unknown) {
        console.error("Failed to parse DICOM files", error);
        alert("Failed to parse DICOM files. Make sure you selected a valid DICOM folder.");
      }
    },
    [session]
  );

  const handlePickDirectory = useCallback(async () => {
    try {
      await session.handlePickDirectory();
    } catch (error: unknown) {
      const message = formatViewerLoadError(error);
      if (message !== "cancelled") {
        alert(message);
      }
    }
  }, [session]);

  const handleOpenRecent = useCallback(
    async (id: string) => {
      try {
        await session.openRecent(id);
      } catch (error: unknown) {
        const message = formatViewerLoadError(error);
        if (message !== "cancelled") {
          alert(message);
        }
      }
    },
    [session]
  );

  const handleReconnectRecent = useCallback(
    async (id: string) => {
      try {
        await session.reconnectRecent(id);
      } catch (error: unknown) {
        const message = formatViewerLoadError(error);
        if (message !== "cancelled") {
          alert(message);
        }
      }
    },
    [session]
  );

  const handleRemoveRecent = useCallback(
    async (id: string) => {
      await session.removeRecent(id);
    },
    [session]
  );

  const prevTopogramRef = useRef(topogramSeries);
  useEffect(() => {
    const hadTopogram = !!prevTopogramRef.current;
    const hasTopogram = !!topogramSeries;
    prevTopogramRef.current = topogramSeries;

    if (!hadTopogram && hasTopogram) {
      store.dispatch({ type: "panel/setOpen", panelId: "topogram", open: true });
    }
    if (hadTopogram && !hasTopogram) {
      store.dispatch({ type: "panel/setOpen", panelId: "topogram", open: false });
    }
  }, [store, topogramSeries]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= CT_PRESETS.length) {
        session.applyPreset(CT_PRESETS[num - 1]);
        return;
      }

      if (e.key === "w") {
        session.setTool("WindowLevel");
      }
      if (e.key === "p") {
        session.setTool("Pan");
      }
      if (e.key === "z") {
        session.setTool("Zoom");
      }
      if (e.key === "m") {
        session.setTool("Length");
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [session]);

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
        title: "Prior",
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

  const handleToolChange = useCallback(
    (tool: ToolName) => {
      session.setTool(tool);
    },
    [session]
  );

  const handlePresetChange = useCallback(
    (preset: WindowPreset) => {
      session.applyPreset(preset);
    },
    [session]
  );

  const handleOpenNew = useCallback(() => {
    session.openNew();
  }, [session]);

  const handlePanelToggle = useCallback(
    (id: string) => {
      if (id === "topogram" || id === "compare") {
        if (id === "compare" && state.panels.open.has("compare")) {
          setPriorSelectorRequested(false);
        }
        session.togglePanel(id);
      }
    },
    [session, state.panels.open]
  );

  const handleJumpToSlice = useCallback(
    (index: number) => {
      void session.jumpToSlice("primary", index);
    },
    [session]
  );

  const handleSelectCompareSeries = useCallback(
    (series: Series) => {
      session.selectCompareSeries(series.seriesInstanceUID);
      setPriorSelectorRequested(false);
    },
    [session]
  );

  if (!state.studyTree) {
    return (
      <div className="flex h-screen flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-2 glass">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />
            openrad
          </Link>
        </header>
        <FileDropZone
          onFilesSelected={handleFilesSelected}
          onPickDirectory={handlePickDirectory}
          onOpenRecent={handleOpenRecent}
          onReconnectRecent={handleReconnectRecent}
          onRemoveRecent={handleRemoveRecent}
          fsApiSupported={state.fs.supported}
          pickerBusy={state.fs.pickerBusy}
          recentDirectories={state.fs.recentDirectories}
          reconnectTargetId={state.fs.reconnectTargetId}
          loading={state.fs.loading || state.fs.bootstrapping}
          loadingMessage={state.fs.message}
          progress={state.fs.progress}
        />
      </div>
    );
  }

  const activeRecent = state.fs.recentDirectories.find((entry) => entry.id === state.fs.activeRecentId) || null;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-2 glass">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" />
          openrad
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
          studyTree={state.studyTree}
          activeSeries={activeSeries}
          onSelectSeries={(series) => session.selectActiveSeries(series.seriesInstanceUID)}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          {activeSeries ? (
            <>
              <Toolbar
                activeTool={state.activeTool}
                onToolChange={handleToolChange}
                onPresetChange={handlePresetChange}
                activePreset={state.activePreset.name}
              />
              <div className="flex flex-1 overflow-hidden">
                <PanelActivityBar
                  panels={panels}
                  activePanelIds={state.panels.open}
                  onPanelToggle={handlePanelToggle}
                />
                {state.panels.open.has("topogram") && topogramSeries && (
                  <PanelContainer
                    title="Topogram"
                    width={state.panels.widths.topogram}
                    onWidthChange={(width) => session.setPanelWidth("topogram", width)}
                  >
                    <TopogramPanel
                      sessionId={session.getSessionId()}
                      series={topogramSeries}
                      currentSlicePosition={state.viewports.primary.position}
                      axialSlicePositions={state.viewports.primary.axialPositions}
                      onJumpToSlice={handleJumpToSlice}
                    />
                  </PanelContainer>
                )}

                {comparePanelOpen ? (
                  <div className="grid flex-1 grid-cols-2 overflow-hidden">
                    <div className="flex min-w-0 flex-col border-r border-border">
                      <div className="flex h-8 items-center justify-between border-b border-border px-3 text-[11px] text-muted">
                        <span className="uppercase tracking-widest">Prior</span>
                        <div className="flex items-center gap-2">
                          <span>
                            {compareSeries
                              ? `${compareStudy?.studyDate ? formatDate(compareStudy.studyDate) : ""}${
                                  state.viewports.compare.total > 0
                                    ? ` · ${state.viewports.compare.currentIndex + 1}/${state.viewports.compare.total}`
                                    : ""
                                }`
                              : "Select prior study"}
                          </span>
                          <button
                            onClick={() => setPriorSelectorRequested(true)}
                            className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-widest transition-colors hover:bg-surface hover:text-foreground"
                          >
                            Switch
                          </button>
                        </div>
                      </div>
                      {priorSelectorOpen || !compareSeries ? (
                        <PriorSelectorPanel
                          studyTree={state.studyTree}
                          activeSeries={activeSeries}
                          selectedCompareSeries={compareSeries}
                          onSelectCompareSeries={handleSelectCompareSeries}
                          onCloseSelector={() => setPriorSelectorRequested(false)}
                        />
                      ) : (
                        <DicomViewport
                          viewportId="compare"
                          session={session}
                          series={compareSeries}
                          jumpToSliceIndex={state.viewports.compare.jumpToIndex}
                        />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <div className="flex h-8 items-center justify-between border-b border-border px-3 text-[11px] text-muted">
                        <span className="uppercase tracking-widest">Current</span>
                        <span>{activeStudy?.studyDate ? formatDate(activeStudy.studyDate) : ""}</span>
                      </div>
                      <DicomViewport
                        viewportId="primary"
                        session={session}
                        series={activeSeries}
                        jumpToSliceIndex={state.viewports.primary.jumpToIndex}
                      />
                    </div>
                  </div>
                ) : (
                  <DicomViewport
                    viewportId="primary"
                    session={session}
                    series={activeSeries}
                    jumpToSliceIndex={state.viewports.primary.jumpToIndex}
                  />
                )}
              </div>
              <StatusBar
                currentSlice={state.viewports.primary.currentIndex + 1}
                totalSlices={state.viewports.primary.total}
                windowWidth={state.viewports.primary.windowWidth}
                windowCenter={state.viewports.primary.windowCenter}
                imageWidth={state.viewports.primary.imageWidth}
                imageHeight={state.viewports.primary.imageHeight}
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
  if (dicomDate.length !== 8) {
    return dicomDate;
  }
  return `${dicomDate.slice(0, 4)}-${dicomDate.slice(4, 6)}-${dicomDate.slice(6, 8)}`;
}
