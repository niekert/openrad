import type { Series } from "./types";
import { getImageId, getImageMetadata } from "@/lib/cornerstone/custom-image-loader";

export function getSeriesSlicePositions(series: Series): (number[] | null)[] {
  return series.instances.map((inst) => {
    const meta = getImageMetadata(getImageId(inst.fileKey));
    const ipp = meta?.imagePositionPatient;
    if (!Array.isArray(ipp) || ipp.length < 3) return null;
    const x = Number(ipp[0]);
    const y = Number(ipp[1]);
    const z = Number(ipp[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    return [x, y, z];
  });
}

export function findNearestSliceByPosition(
  targetPosition: number[] | null,
  candidatePositions: (number[] | null)[]
): number | null {
  if (!targetPosition || targetPosition.length < 3) return null;

  let bestIndex = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < candidatePositions.length; i++) {
    const pos = candidatePositions[i];
    if (!pos || pos.length < 3) continue;
    const distance = Math.abs(pos[2] - targetPosition[2]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex >= 0 ? bestIndex : null;
}

export function mapByRelativeIndex(
  currentIndex: number,
  currentTotal: number,
  compareTotal: number
): number {
  if (currentTotal <= 1 || compareTotal <= 1) return 0;
  const ratio = currentIndex / (currentTotal - 1);
  const mapped = Math.round(ratio * (compareTotal - 1));
  return Math.max(0, Math.min(compareTotal - 1, mapped));
}
