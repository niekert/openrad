import { CT_PRESETS } from "@/lib/cornerstone/presets";
import type { ViewerAction } from "./actions";
import type { ViewerState } from "./types";

function initialViewport(viewportId: "primary" | "compare") {
  return {
    viewportId,
    seriesInstanceUID: null,
    currentIndex: 0,
    total: 0,
    position: null,
    windowWidth: 400,
    windowCenter: 40,
    imageWidth: 0,
    imageHeight: 0,
    axialPositions: null,
    jumpToIndex: null,
  };
}

export function createInitialViewerState(): ViewerState {
  return {
    studyTree: null,
    activeSeriesUID: null,
    compareSeriesUID: null,
    activeTool: "WindowLevel",
    activePreset: CT_PRESETS[0],
    presetTrigger: null,
    fs: {
      supported: false,
      loading: false,
      bootstrapping: true,
      pickerBusy: false,
      message: null,
      progress: null,
      recentDirectories: [],
      activeRecentId: null,
      reconnectTargetId: null,
    },
    panels: {
      open: new Set(),
      widths: {
        topogram: 200,
        compare: 320,
      },
    },
    viewports: {
      primary: initialViewport("primary"),
      compare: initialViewport("compare"),
    },
  };
}

export function viewerReducer(state: ViewerState, action: ViewerAction): ViewerState {
  switch (action.type) {
    case "fs/setSupported":
      return { ...state, fs: { ...state.fs, supported: action.supported } };
    case "fs/setBootstrapping":
      return { ...state, fs: { ...state.fs, bootstrapping: action.bootstrapping } };
    case "fs/setPickerBusy":
      return { ...state, fs: { ...state.fs, pickerBusy: action.pickerBusy } };
    case "fs/setLoading":
      return { ...state, fs: { ...state.fs, loading: action.loading } };
    case "fs/setMessage":
      return { ...state, fs: { ...state.fs, message: action.message } };
    case "fs/setProgress":
      return { ...state, fs: { ...state.fs, progress: action.progress } };
    case "fs/setRecents":
      return { ...state, fs: { ...state.fs, recentDirectories: action.recents } };
    case "fs/setActiveRecent":
      return { ...state, fs: { ...state.fs, activeRecentId: action.id } };
    case "fs/setReconnectTarget":
      return { ...state, fs: { ...state.fs, reconnectTargetId: action.id } };

    case "study/setTree":
      return { ...state, studyTree: action.tree };

    case "series/setActive": {
      return {
        ...state,
        activeSeriesUID: action.seriesUID,
        compareSeriesUID: null,
        viewports: {
          ...state.viewports,
          primary: {
            ...state.viewports.primary,
            seriesInstanceUID: action.seriesUID,
            position: null,
            axialPositions: null,
            jumpToIndex: null,
          },
          compare: {
            ...state.viewports.compare,
            seriesInstanceUID: null,
            currentIndex: 0,
            total: 0,
            position: null,
            axialPositions: null,
            jumpToIndex: null,
          },
        },
      };
    }

    case "series/setCompare":
      return {
        ...state,
        compareSeriesUID: action.seriesUID,
        viewports: {
          ...state.viewports,
          compare: {
            ...state.viewports.compare,
            seriesInstanceUID: action.seriesUID,
            axialPositions: null,
            jumpToIndex: action.seriesUID ? 0 : null,
          },
        },
      };

    case "tool/setActive":
      return { ...state, activeTool: action.tool };

    case "preset/setActive":
      return {
        ...state,
        activePreset: action.preset,
        viewports: {
          ...state.viewports,
          primary: {
            ...state.viewports.primary,
            windowWidth: action.preset.windowWidth,
            windowCenter: action.preset.windowCenter,
          },
          compare: {
            ...state.viewports.compare,
            windowWidth: action.preset.windowWidth,
            windowCenter: action.preset.windowCenter,
          },
        },
      };

    case "preset/setTrigger":
      return { ...state, presetTrigger: action.preset };

    case "panel/toggle": {
      const next = new Set(state.panels.open);
      if (next.has(action.panelId)) {
        next.delete(action.panelId);
      } else {
        next.add(action.panelId);
      }
      return {
        ...state,
        panels: {
          ...state.panels,
          open: next,
        },
      };
    }

    case "panel/setOpen": {
      const next = new Set(state.panels.open);
      if (action.open) {
        next.add(action.panelId);
      } else {
        next.delete(action.panelId);
      }
      return {
        ...state,
        panels: {
          ...state.panels,
          open: next,
        },
      };
    }

    case "panel/setWidth":
      return {
        ...state,
        panels: {
          ...state.panels,
          widths: {
            ...state.panels.widths,
            [action.panelId]: action.width,
          },
        },
      };

    case "viewport/setSeries":
      return {
        ...state,
        viewports: {
          ...state.viewports,
          [action.viewportId]: {
            ...state.viewports[action.viewportId],
            seriesInstanceUID: action.seriesUID,
          },
        },
      };

    case "viewport/setSlice":
      return {
        ...state,
        viewports: {
          ...state.viewports,
          [action.viewportId]: {
            ...state.viewports[action.viewportId],
            currentIndex: action.currentIndex,
            total: action.total,
            position: action.position,
          },
        },
      };

    case "viewport/setWindow": {
      const prev = state.viewports[action.viewportId];
      const width = Math.abs(prev.windowWidth - action.width) < 0.5 ? prev.windowWidth : action.width;
      const center = Math.abs(prev.windowCenter - action.center) < 0.5 ? prev.windowCenter : action.center;
      return {
        ...state,
        viewports: {
          ...state.viewports,
          [action.viewportId]: {
            ...prev,
            windowWidth: width,
            windowCenter: center,
          },
        },
      };
    }

    case "viewport/setImageInfo":
      return {
        ...state,
        viewports: {
          ...state.viewports,
          [action.viewportId]: {
            ...state.viewports[action.viewportId],
            imageWidth: action.width,
            imageHeight: action.height,
          },
        },
      };

    case "viewport/setAxialPositions":
      return {
        ...state,
        viewports: {
          ...state.viewports,
          [action.viewportId]: {
            ...state.viewports[action.viewportId],
            axialPositions: action.positions,
          },
        },
      };

    case "viewport/setJumpTo":
      return {
        ...state,
        viewports: {
          ...state.viewports,
          [action.viewportId]: {
            ...state.viewports[action.viewportId],
            jumpToIndex: action.index,
          },
        },
      };

    case "viewer/reset":
      return {
        ...state,
        studyTree: null,
        activeSeriesUID: null,
        compareSeriesUID: null,
        panels: {
          ...state.panels,
          open: new Set(),
        },
        viewports: {
          primary: initialViewport("primary"),
          compare: initialViewport("compare"),
        },
      };

    default:
      return state;
  }
}
