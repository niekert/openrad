import type { Series, Study, StudyTree } from "@/lib/dicom/types";
import { findTopogramSeries } from "@/lib/dicom/topogram-utils";
import { FEATURES } from "@/lib/features";
import type { ViewerState } from "./types";

function findSeriesByUID(studyTree: StudyTree | null, uid: string | null): Series | null {
  if (!studyTree || !uid) {
    return null;
  }

  for (const study of studyTree.studies) {
    const match = study.series.find((series) => series.seriesInstanceUID === uid);
    if (match) {
      return match;
    }
  }

  return null;
}

export function selectActiveSeries(state: ViewerState): Series | null {
  return findSeriesByUID(state.studyTree, state.activeSeriesUID);
}

export function selectCompareSeries(state: ViewerState): Series | null {
  return findSeriesByUID(state.studyTree, state.compareSeriesUID);
}

function findStudyBySeriesUID(studyTree: StudyTree | null, uid: string | null): Study | null {
  if (!studyTree || !uid) {
    return null;
  }

  return (
    studyTree.studies.find((study) =>
      study.series.some((series) => series.seriesInstanceUID === uid)
    ) || null
  );
}

export function selectActiveStudy(state: ViewerState): Study | null {
  return findStudyBySeriesUID(state.studyTree, state.activeSeriesUID);
}

export function selectCompareStudy(state: ViewerState): Study | null {
  return findStudyBySeriesUID(state.studyTree, state.compareSeriesUID);
}

export function selectTopogramSeries(state: ViewerState): Series | null {
  const activeSeries = selectActiveSeries(state);
  const activeStudy = selectActiveStudy(state);
  if (!activeSeries || !activeStudy) {
    return null;
  }

  const topogram = findTopogramSeries(activeStudy);
  if (!topogram) {
    return null;
  }

  return topogram.seriesInstanceUID === activeSeries.seriesInstanceUID ? null : topogram;
}

export function selectComparePanelOpen(state: ViewerState): boolean {
  return FEATURES.compareViewer && state.panels.open.has("compare");
}

export function selectCompareEnabled(state: ViewerState): boolean {
  return selectComparePanelOpen(state) && !!state.compareSeriesUID;
}
