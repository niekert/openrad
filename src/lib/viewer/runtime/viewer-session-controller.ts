import type { Series, StudyTree } from "@/lib/dicom/types";
import { logger } from "@/lib/debug";

const log = logger("session");
import { clearFiles, registerFiles, setActiveFileSession } from "@/lib/dicom/file-manager";
import { parseDicomdirFromFiles } from "@/lib/dicom/parse-dicomdir";
import { parseFilesWithoutDicomdir } from "@/lib/dicom/parse-files";
import { findNearestSliceByPosition, mapByRelativeIndex } from "@/lib/dicom/slice-sync";
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
import type { WindowPreset } from "@/lib/cornerstone/presets";
import { clearImageMetadataForSession } from "@/lib/cornerstone/custom-image-loader";
import {
  CornerstoneViewportRuntime,
  type RuntimeViewportId,
  type ViewerToolName,
} from "@/lib/cornerstone/runtime";
import type { ViewerStore } from "@/lib/viewer/state/store";
import type { PanelId } from "@/lib/viewer/state/types";

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
      .catch((error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

interface OpenDirectoryOptions {
  existingId?: string;
  requestPermission: boolean;
}

export class ViewerSessionController {
  private readonly store: ViewerStore;
  private readonly sessionId: string;
  private readonly runtime: CornerstoneViewportRuntime;
  private pickerTask: Promise<void> | null = null;
  private syncingWindow = false;

  constructor(store: ViewerStore, sessionId = crypto.randomUUID()) {
    this.store = store;
    this.sessionId = sessionId;
    log.debug("constructor", { sessionId });
    setActiveFileSession(sessionId);

    this.runtime = new CornerstoneViewportRuntime(sessionId, {
      onSliceChange: (viewportId, currentIndex, total, position) => {
        this.store.dispatch({
          type: "viewport/setSlice",
          viewportId,
          currentIndex,
          total,
          position,
        });

        if (viewportId === "primary") {
          this.syncPrimaryToCompare(currentIndex, total, position);
        }
      },
      onWindowChange: (viewportId, width, center) => {
        this.store.dispatch({ type: "viewport/setWindow", viewportId, width, center });

        if (viewportId !== "primary") {
          return;
        }

        const state = this.store.getSnapshot();
        const compareEnabled = state.panels.open.has("compare") && !!state.compareSeriesUID;
        if (!compareEnabled || this.syncingWindow) {
          return;
        }

        this.syncingWindow = true;
        try {
          this.runtime.setWindow("compare", width, center);
        } finally {
          this.syncingWindow = false;
        }
      },
      onImageInfo: (viewportId, width, height) => {
        this.store.dispatch({
          type: "viewport/setImageInfo",
          viewportId,
          width,
          height,
        });
      },
      onAxialPositionsReady: (viewportId, positions) => {
        this.store.dispatch({
          type: "viewport/setAxialPositions",
          viewportId,
          positions,
        });
      },
    });
  }

  getSessionId(): string {
    return this.sessionId;
  }

  async start(): Promise<void> {
    log.debug("start", { sessionId: this.sessionId });
    const supported = isFileSystemAccessSupported();
    this.store.dispatch({ type: "fs/setSupported", supported });

    if (!supported) {
      this.store.dispatch({ type: "fs/setBootstrapping", bootstrapping: false });
      return;
    }

    try {
      const recents = await listRecentDirectories();
      this.store.dispatch({ type: "fs/setRecents", recents });

      const latest = recents[0];
      if (!latest) {
        return;
      }

      this.store.dispatch({ type: "fs/setActiveRecent", id: latest.id });

      const permission = await queryReadPermission(latest.handle);
      if (permission === "granted") {
        await this.openDirectoryHandle(latest.handle, {
          existingId: latest.id,
          requestPermission: false,
        });
      } else {
        await markRecentDirectoryStatus(latest.id, "needs-permission");
        await this.refreshRecentDirectories();
        this.store.dispatch({ type: "fs/setReconnectTarget", id: latest.id });
      }
    } finally {
      this.store.dispatch({ type: "fs/setBootstrapping", bootstrapping: false });
    }
  }

  dispose(): void {
    log.debug("dispose", { sessionId: this.sessionId });
    this.runtime.dispose();
  }

  async registerViewportMount(viewportId: RuntimeViewportId, element: HTMLDivElement): Promise<void> {
    await this.runtime.registerViewport(viewportId, element);
    const state = this.store.getSnapshot();
    const uid = state.viewports[viewportId].seriesInstanceUID;
    const series = this.findSeriesByUID(uid);
    await this.runtime.setSeries(viewportId, series);

    if (viewportId === "compare") {
      const primary = state.viewports.primary;
      if (primary.windowWidth > 0) {
        this.runtime.setWindow("compare", primary.windowWidth, primary.windowCenter);
      }
    }
  }

  unregisterViewportMount(viewportId: RuntimeViewportId): void {
    this.runtime.unregisterViewport(viewportId);
  }

  async setViewportSeries(viewportId: RuntimeViewportId, seriesUID: string | null): Promise<void> {
    this.store.dispatch({ type: "viewport/setSeries", viewportId, seriesUID });
    const series = this.findSeriesByUID(seriesUID);
    await this.runtime.setSeries(viewportId, series);
  }

  setTool(tool: ViewerToolName): void {
    this.store.dispatch({ type: "tool/setActive", tool });
    this.runtime.setTool(tool);
  }

  applyPreset(preset: WindowPreset): void {
    this.store.dispatch({ type: "preset/setActive", preset });
    this.store.dispatch({ type: "preset/setTrigger", preset });
    this.runtime.applyPreset(preset);
  }

  togglePanel(panelId: PanelId): void {
    this.store.dispatch({ type: "panel/toggle", panelId });
  }

  setPanelWidth(panelId: PanelId, width: number): void {
    this.store.dispatch({ type: "panel/setWidth", panelId, width });
  }

  async jumpToSlice(viewportId: RuntimeViewportId, index: number): Promise<void> {
    this.store.dispatch({ type: "viewport/setJumpTo", viewportId, index });
    await this.runtime.jumpToSlice(viewportId, index);
  }

  selectActiveSeries(seriesUID: string | null): void {
    this.store.dispatch({ type: "series/setActive", seriesUID });
    void this.setViewportSeries("primary", seriesUID);
    void this.setViewportSeries("compare", null);
  }

  selectCompareSeries(seriesUID: string | null): void {
    this.store.dispatch({ type: "series/setCompare", seriesUID });
    void this.setViewportSeries("compare", seriesUID);
  }

  openNew(): void {
    clearFiles(this.sessionId);
    clearImageMetadataForSession(this.sessionId);
    this.store.dispatch({ type: "viewer/reset" });
    void this.setViewportSeries("primary", null);
    void this.setViewportSeries("compare", null);
  }

  async loadFiles(files: File[]): Promise<void> {
    this.store.dispatch({ type: "fs/setLoading", loading: true });
    this.store.dispatch({ type: "fs/setProgress", progress: null });
    this.store.dispatch({ type: "fs/setMessage", message: "Preparing files..." });

    try {
      const tree = await this.parseAndLoadFiles(files);
      const firstSeriesUID = tree.studies[0]?.series[0]?.seriesInstanceUID ?? null;
      this.store.dispatch({ type: "series/setActive", seriesUID: firstSeriesUID });

      await this.setViewportSeries("primary", firstSeriesUID);
      await this.setViewportSeries("compare", null);
    } finally {
      this.store.dispatch({ type: "fs/setLoading", loading: false });
      this.store.dispatch({ type: "fs/setProgress", progress: null });
      this.store.dispatch({ type: "fs/setMessage", message: null });
    }
  }

  async handlePickDirectory(): Promise<void> {
    const state = this.store.getSnapshot();
    if (!state.fs.supported || state.fs.loading || state.fs.bootstrapping) {
      return;
    }

    if (this.pickerTask) {
      return;
    }

    const task = (async () => {
      this.store.dispatch({ type: "fs/setPickerBusy", pickerBusy: true });
      try {
        const handle = await pickDirectory();
        await this.openDirectoryHandle(handle, { requestPermission: true });
      } finally {
        this.store.dispatch({ type: "fs/setPickerBusy", pickerBusy: false });
        this.pickerTask = null;
      }
    })();

    this.pickerTask = task;
    await task;
  }

  async openRecent(id: string): Promise<void> {
    const state = this.store.getSnapshot();
    const recent = state.fs.recentDirectories.find((entry) => entry.id === id);
    if (!recent) {
      return;
    }

    this.store.dispatch({ type: "fs/setActiveRecent", id });

    const permission = await queryReadPermission(recent.handle);
    if (permission !== "granted") {
      await markRecentDirectoryStatus(id, "needs-permission");
      await this.refreshRecentDirectories();
      this.store.dispatch({ type: "fs/setReconnectTarget", id });
      return;
    }

    await this.openDirectoryHandle(recent.handle, {
      existingId: id,
      requestPermission: false,
    });
  }

  async reconnectRecent(id: string): Promise<void> {
    const state = this.store.getSnapshot();
    const recent = state.fs.recentDirectories.find((entry) => entry.id === id);
    if (!recent) {
      return;
    }

    this.store.dispatch({ type: "fs/setActiveRecent", id });
    await this.openDirectoryHandle(recent.handle, {
      existingId: id,
      requestPermission: true,
    });
  }

  async removeRecent(id: string): Promise<void> {
    await removeRecentDirectory(id);
    const state = this.store.getSnapshot();
    this.store.dispatch({
      type: "fs/setActiveRecent",
      id: state.fs.activeRecentId === id ? null : state.fs.activeRecentId,
    });
    this.store.dispatch({
      type: "fs/setReconnectTarget",
      id: state.fs.reconnectTargetId === id ? null : state.fs.reconnectTargetId,
    });
    await this.refreshRecentDirectories();
  }

  private async refreshRecentDirectories(): Promise<void> {
    if (!isFileSystemAccessSupported()) {
      this.store.dispatch({ type: "fs/setRecents", recents: [] });
      return;
    }

    const recents = await listRecentDirectories();
    this.store.dispatch({ type: "fs/setRecents", recents });
  }

  private async parseAndLoadFiles(files: File[]): Promise<StudyTree> {
    clearFiles(this.sessionId);
    clearImageMetadataForSession(this.sessionId);
    registerFiles(files, this.sessionId);

    this.store.dispatch({ type: "fs/setMessage", message: "Reading DICOMDIR..." });

    let tree: StudyTree | null = null;
    try {
      tree = await withTimeout(parseDicomdirFromFiles(files), 7000, "dicomdir-timeout");
    } catch (error: unknown) {
      if (!(error instanceof Error) || error.message !== "dicomdir-timeout") {
        throw error;
      }
    }

    if (!tree || tree.studies.length === 0) {
      this.store.dispatch({ type: "fs/setMessage", message: "Scanning files..." });
      tree = await withTimeout(
        parseFilesWithoutDicomdir(files, (done, total) => {
          this.store.dispatch({
            type: "fs/setProgress",
            progress: { done, total },
          });
          this.store.dispatch({
            type: "fs/setMessage",
            message: `Scanning files... ${done.toLocaleString()} / ${total.toLocaleString()}`,
          });
        }),
        120000,
        "scan-timeout"
      );
    }

    this.store.dispatch({ type: "study/setTree", tree });
    return tree;
  }

  private async openDirectoryHandle(
    handle: FileSystemDirectoryHandle,
    options: OpenDirectoryOptions
  ): Promise<void> {
    this.store.dispatch({ type: "fs/setLoading", loading: true });
    this.store.dispatch({ type: "fs/setProgress", progress: null });
    this.store.dispatch({ type: "fs/setMessage", message: "Requesting folder access..." });

    try {
      const permission = options.requestPermission
        ? await requestReadPermission(handle)
        : await queryReadPermission(handle);

      if (permission !== "granted") {
        throw new Error("permission-denied");
      }

      this.store.dispatch({ type: "fs/setMessage", message: "Reading files from folder..." });
      const files = await readAllFilesFromDirectory(handle, (readCount) => {
        this.store.dispatch({
          type: "fs/setMessage",
          message: `Reading files from folder... ${readCount.toLocaleString()}`,
        });
      });

      if (files.length === 0) {
        throw new Error("empty-directory");
      }

      const tree = await this.parseAndLoadFiles(files);
      const firstSeriesUID = tree.studies[0]?.series[0]?.seriesInstanceUID ?? null;

      this.store.dispatch({ type: "series/setActive", seriesUID: firstSeriesUID });
      await this.setViewportSeries("primary", firstSeriesUID);
      await this.setViewportSeries("compare", null);

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

      this.store.dispatch({ type: "fs/setActiveRecent", id: savedId || null });
      this.store.dispatch({ type: "fs/setReconnectTarget", id: null });
      await this.refreshRecentDirectories();
    } catch (error: unknown) {
      if (options.existingId) {
        if (isPermissionDeniedError(error)) {
          await markRecentDirectoryStatus(options.existingId, "needs-permission");
          this.store.dispatch({
            type: "fs/setReconnectTarget",
            id: options.existingId,
          });
        } else {
          await markRecentDirectoryStatus(options.existingId, "unavailable");
        }
        await this.refreshRecentDirectories();
      }

      throw error;
    } finally {
      this.store.dispatch({ type: "fs/setLoading", loading: false });
      this.store.dispatch({ type: "fs/setProgress", progress: null });
      this.store.dispatch({ type: "fs/setMessage", message: null });
    }
  }

  private findSeriesByUID(seriesUID: string | null): Series | null {
    if (!seriesUID) {
      return null;
    }

    const tree = this.store.getSnapshot().studyTree;
    if (!tree) {
      return null;
    }

    for (const study of tree.studies) {
      const series = study.series.find((item) => item.seriesInstanceUID === seriesUID);
      if (series) {
        return series;
      }
    }

    return null;
  }

  private syncPrimaryToCompare(
    index: number,
    total: number,
    position: [number, number, number] | null
  ): void {
    const state = this.store.getSnapshot();
    const compareUID = state.compareSeriesUID;
    if (!compareUID || !state.panels.open.has("compare")) {
      return;
    }

    const compare = state.viewports.compare;
    let mapped: number | null = null;

    if (compare.axialPositions && compare.axialPositions.length > 0) {
      mapped = findNearestSliceByPosition(position, compare.axialPositions);
    }

    if (mapped == null) {
      mapped = mapByRelativeIndex(index, total, Math.max(compare.total, 1));
    }

    if (mapped == null) {
      return;
    }

    this.store.dispatch({ type: "viewport/setJumpTo", viewportId: "compare", index: mapped });
    void this.runtime.jumpToSlice("compare", mapped);
  }
}

export function formatViewerLoadError(error: unknown): string {
  if (isPermissionDeniedError(error)) {
    return "OpenRad needs read access to that folder. Click Reconnect to grant access.";
  }
  if (error instanceof Error && error.message === "scan-timeout") {
    return "File scan timed out. Please select a smaller folder or reconnect again.";
  }
  if (error instanceof Error && error.message === "empty-directory") {
    return "The selected folder does not contain readable files.";
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return "cancelled";
  }
  if (
    error instanceof DOMException &&
    error.name === "NotAllowedError" &&
    error.message.includes("already active")
  ) {
    return "cancelled";
  }
  return "Failed to read DICOM files from this folder.";
}

export function findRecentById(recents: RecentDirectoryEntry[], id: string): RecentDirectoryEntry | null {
  return recents.find((entry) => entry.id === id) || null;
}
