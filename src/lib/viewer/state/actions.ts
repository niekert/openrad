import type { StudyTree } from "@/lib/dicom/types";
import type { WindowPreset } from "@/lib/cornerstone/presets";
import type { RecentDirectoryEntry } from "@/lib/filesystem/persistent-directories";
import type { ToolName } from "@/components/viewer/Toolbar";
import type { PanelId, ProgressState, ViewportId } from "./types";

export type ViewerAction =
  | { type: "fs/setSupported"; supported: boolean }
  | { type: "fs/setBootstrapping"; bootstrapping: boolean }
  | { type: "fs/setPickerBusy"; pickerBusy: boolean }
  | { type: "fs/setLoading"; loading: boolean }
  | { type: "fs/setMessage"; message: string | null }
  | { type: "fs/setProgress"; progress: ProgressState | null }
  | { type: "fs/setRecents"; recents: RecentDirectoryEntry[] }
  | { type: "fs/setActiveRecent"; id: string | null }
  | { type: "fs/setReconnectTarget"; id: string | null }
  | { type: "study/setTree"; tree: StudyTree | null }
  | { type: "series/setActive"; seriesUID: string | null }
  | { type: "series/setCompare"; seriesUID: string | null }
  | { type: "tool/setActive"; tool: ToolName }
  | { type: "preset/setActive"; preset: WindowPreset }
  | { type: "preset/setTrigger"; preset: WindowPreset | null }
  | { type: "panel/toggle"; panelId: PanelId }
  | { type: "panel/setOpen"; panelId: PanelId; open: boolean }
  | { type: "panel/setWidth"; panelId: PanelId; width: number }
  | { type: "viewport/setSeries"; viewportId: ViewportId; seriesUID: string | null }
  | {
      type: "viewport/setSlice";
      viewportId: ViewportId;
      currentIndex: number;
      total: number;
      position: [number, number, number] | null;
    }
  | {
      type: "viewport/setWindow";
      viewportId: ViewportId;
      width: number;
      center: number;
    }
  | {
      type: "viewport/setImageInfo";
      viewportId: ViewportId;
      width: number;
      height: number;
    }
  | {
      type: "viewport/setAxialPositions";
      viewportId: ViewportId;
      positions: Array<[number, number, number] | null> | null;
    }
  | {
      type: "viewport/setJumpTo";
      viewportId: ViewportId;
      index: number | null;
    }
  | { type: "viewer/reset" };
