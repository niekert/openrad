"use client";

import { useState, useCallback, useEffect } from "react";
import type { StudyTree, Series } from "@/lib/dicom/types";
import type { WindowPreset } from "@/lib/cornerstone/presets";
import { CT_PRESETS } from "@/lib/cornerstone/presets";
import { registerFiles, clearFiles } from "@/lib/dicom/file-manager";
import { parseDicomdirFromFiles } from "@/lib/dicom/parse-dicomdir";
import { parseFilesWithoutDicomdir } from "@/lib/dicom/parse-files";
import FileDropZone from "./FileDropZone";
import StudyBrowser from "./StudyBrowser";
import Toolbar, { type ToolName } from "./Toolbar";
import StatusBar from "./StatusBar";
import DicomViewport from "./DicomViewport";
import Link from "next/link";

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

  // Slice/window state for status bar
  const [currentSlice, setCurrentSlice] = useState(0);
  const [totalSlices, setTotalSlices] = useState(0);
  const [windowWidth, setWindowWidth] = useState(400);
  const [windowCenter, setWindowCenter] = useState(40);
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    setLoading(true);
    setProgress(null);

    try {
      // Register all files in the file manager
      clearFiles();
      registerFiles(files);

      // Try DICOMDIR first
      let tree = await parseDicomdirFromFiles(files);

      if (!tree || tree.studies.length === 0) {
        // Fallback: scan all files
        tree = await parseFilesWithoutDicomdir(files, (done, total) => {
          setProgress({ done, total });
        });
      }

      setStudyTree(tree);

      // Auto-select first series if available
      if (tree.studies.length > 0 && tree.studies[0].series.length > 0) {
        setActiveSeries(tree.studies[0].series[0]);
      }
    } catch (err) {
      console.error("Failed to parse DICOM files:", err);
      alert(
        "Failed to parse DICOM files. Make sure you selected a valid DICOM folder."
      );
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, []);

  const handleOpenNew = useCallback(() => {
    clearFiles();
    setStudyTree(null);
    setActiveSeries(null);
  }, []);

  const handlePresetChange = useCallback((preset: WindowPreset) => {
    setActivePreset(preset);
    setPresetTrigger(preset);
  }, []);

  const handleSliceChange = useCallback((current: number, total: number) => {
    setCurrentSlice(current);
    setTotalSlices(total);
  }, []);

  const handleWindowChange = useCallback((ww: number, wc: number) => {
    setWindowWidth(ww);
    setWindowCenter(wc);
  }, []);

  const handleImageInfo = useCallback((w: number, h: number) => {
    setImageWidth(w);
    setImageHeight(h);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Number keys for presets
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

  // No files loaded yet — show drop zone
  if (!studyTree) {
    return (
      <div className="flex h-screen flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-2 glass">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />
            OpenCT
          </Link>
        </header>
        <FileDropZone
          onFilesSelected={handleFilesSelected}
          loading={loading}
          progress={progress}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2 glass">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" />
          OpenCT
        </Link>
        <span className="text-xs text-muted truncate max-w-xs">
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

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <StudyBrowser
          studyTree={studyTree}
          activeSeries={activeSeries}
          onSelectSeries={setActiveSeries}
        />

        {/* Viewport area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {activeSeries ? (
            <>
              <Toolbar
                activeTool={activeTool}
                onToolChange={setActiveTool}
                onPresetChange={handlePresetChange}
                activePreset={activePreset.name}
              />
              <DicomViewport
                series={activeSeries}
                activeTool={activeTool}
                activePreset={presetTrigger}
                onSliceChange={handleSliceChange}
                onWindowChange={handleWindowChange}
                onImageInfo={handleImageInfo}
              />
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
