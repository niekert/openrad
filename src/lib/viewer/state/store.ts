import { createInitialViewerState, viewerReducer } from "./reducer";
import type { ViewerAction } from "./actions";
import type { ViewerState } from "./types";

export interface ViewerStore {
  getSnapshot(): ViewerState;
  subscribe(listener: () => void): () => void;
  dispatch(action: ViewerAction): void;
}

export function createViewerStore(initial?: ViewerState): ViewerStore {
  let state = initial ?? createInitialViewerState();
  const listeners = new Set<() => void>();

  return {
    getSnapshot() {
      return state;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(action: ViewerAction) {
      const next = viewerReducer(state, action);
      if (next === state) {
        return;
      }
      state = next;
      listeners.forEach((listener) => listener());
    },
  };
}
