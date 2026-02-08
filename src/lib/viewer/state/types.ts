import type { StudyTree } from "@/lib/dicom/types";
import type { WindowPreset } from "@/lib/cornerstone/presets";
import type { RecentDirectoryEntry } from "@/lib/filesystem/persistent-directories";
import type { ToolName } from "@/components/viewer/Toolbar";

export type ViewportId = "primary" | "compare";
export type PanelId = "topogram" | "compare" | "ai";

export interface ProgressState {
  done: number;
  total: number;
}

export interface ViewportSliceState {
  viewportId: ViewportId;
  seriesInstanceUID: string | null;
  currentIndex: number;
  total: number;
  position: [number, number, number] | null;
  windowWidth: number;
  windowCenter: number;
  imageWidth: number;
  imageHeight: number;
  axialPositions: Array<[number, number, number] | null> | null;
  jumpToIndex: number | null;
}

export interface ViewerFsState {
  supported: boolean;
  loading: boolean;
  bootstrapping: boolean;
  pickerBusy: boolean;
  message: string | null;
  progress: ProgressState | null;
  recentDirectories: RecentDirectoryEntry[];
  activeRecentId: string | null;
  reconnectTargetId: string | null;
}

export interface ViewerPanelsState {
  open: ReadonlySet<PanelId>;
  widths: Record<PanelId, number>;
}

export interface ViewerStateSnapshot {
  activeSeriesUID: string | null;
  compareSeriesUID: string | null;
  primarySliceIndex: number;
  compareSliceIndex: number;
  windowWidth: number;
  windowCenter: number;
  panelsOpen: PanelId[];
  screenshots: Record<string, string>;
}

export interface ViewerState {
  studyTree: StudyTree | null;
  activeSeriesUID: string | null;
  compareSeriesUID: string | null;
  compareOffset: number;
  activeTool: ToolName;
  activePreset: WindowPreset;
  presetTrigger: WindowPreset | null;
  fs: ViewerFsState;
  panels: ViewerPanelsState;
  viewports: Record<ViewportId, ViewportSliceState>;
}
