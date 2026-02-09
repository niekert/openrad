import type { ViewerState } from "@/lib/viewer/state/types";

export interface StudyMetadata {
  studies: StudySummary[];
  currentViewport: ViewportSummary;
  spatialInfo: SpatialInfo | null;
}

interface StudySummary {
  studyDate: string;
  studyDescription: string;
  series: SeriesSummary[];
}

interface SeriesSummary {
  seriesInstanceUID: string;
  seriesDescription: string;
  modality: string;
  sliceCount: number;
}

interface ViewportSummary {
  activeSeriesUID: string | null;
  activeSeriesDescription: string | null;
  sliceIndex: number;
  totalSlices: number;
  windowWidth: number;
  windowCenter: number;
  compareSeriesUID: string | null;
  compareSeriesDescription: string | null;
  compareSliceIndex: number;
}

interface SpatialInfo {
  zPositionRange: [number, number] | null;
  sliceThickness: number | null;
  pixelSpacing: [number, number] | null;
  firstSliceZ: number | null;
  lastSliceZ: number | null;
  increasingIndexDirection: "toward-head" | "toward-feet" | "unknown";
}

export function buildStudyMetadata(state: ViewerState): StudyMetadata {
  const tree = state.studyTree;
  const studies: StudySummary[] = [];

  if (tree) {
    for (const study of tree.studies) {
      const seriesList: SeriesSummary[] = [];
      for (const series of study.series) {
        seriesList.push({
          seriesInstanceUID: series.seriesInstanceUID,
          seriesDescription: series.seriesDescription,
          modality: series.modality,
          sliceCount: series.instances.length,
        });
      }
      studies.push({
        studyDate: study.studyDate,
        studyDescription: study.studyDescription,
        series: seriesList,
      });
    }
  }

  const primary = state.viewports.primary;
  const compare = state.viewports.compare;

  let activeSeriesDescription: string | null = null;
  let compareSeriesDescription: string | null = null;

  if (tree && state.activeSeriesUID) {
    activeSeriesDescription = findSeriesDescription(tree.studies, state.activeSeriesUID);
  }
  if (tree && state.compareSeriesUID) {
    compareSeriesDescription = findSeriesDescription(tree.studies, state.compareSeriesUID);
  }

  let spatialInfo: SpatialInfo | null = null;
  if (primary.axialPositions && primary.axialPositions.length > 0) {
    const zValues: number[] = [];
    let firstSliceZ: number | null = null;
    let lastSliceZ: number | null = null;

    for (const pos of primary.axialPositions) {
      if (pos) {
        if (firstSliceZ === null) {
          firstSliceZ = pos[2];
        }
        lastSliceZ = pos[2];
        zValues.push(pos[2]);
      }
    }
    const zPositionRange: [number, number] | null =
      zValues.length > 0
        ? [Math.min(...zValues), Math.max(...zValues)]
        : null;

    const sliceThickness =
      zValues.length >= 2 ? Math.abs(zValues[1] - zValues[0]) : null;

    let increasingIndexDirection: "toward-head" | "toward-feet" | "unknown" =
      "unknown";
    if (firstSliceZ !== null && lastSliceZ !== null) {
      const delta = lastSliceZ - firstSliceZ;
      if (Math.abs(delta) > 1e-4) {
        increasingIndexDirection = delta > 0 ? "toward-head" : "toward-feet";
      }
    }

    spatialInfo = {
      zPositionRange,
      sliceThickness,
      pixelSpacing: null,
      firstSliceZ,
      lastSliceZ,
      increasingIndexDirection,
    };
  }

  return {
    studies,
    currentViewport: {
      activeSeriesUID: state.activeSeriesUID,
      activeSeriesDescription,
      sliceIndex: primary.currentIndex,
      totalSlices: primary.total,
      windowWidth: primary.windowWidth,
      windowCenter: primary.windowCenter,
      compareSeriesUID: state.compareSeriesUID,
      compareSeriesDescription,
      compareSliceIndex: compare.currentIndex,
    },
    spatialInfo,
  };
}

function findSeriesDescription(
  studies: { series: { seriesInstanceUID: string; seriesDescription: string }[] }[],
  uid: string,
): string | null {
  for (const study of studies) {
    for (const series of study.series) {
      if (series.seriesInstanceUID === uid) {
        return series.seriesDescription;
      }
    }
  }
  return null;
}
