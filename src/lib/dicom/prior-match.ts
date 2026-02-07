import type { Series } from "./types";

interface SeriesMatchMetrics {
  score: number;
  tokenOverlap: number;
  instanceDelta: number;
  seriesNumberDelta: number;
}

function tokenizeDescription(description: string): string[] {
  return description
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

function countOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  const bSet = new Set(b);
  let overlap = 0;
  for (const token of a) {
    if (bSet.has(token)) {
      overlap += 1;
    }
  }
  return overlap;
}

function scoreSeriesMatch(candidate: Series, activeSeries: Series): SeriesMatchMetrics {
  const candidateTokens = tokenizeDescription(candidate.seriesDescription || "");
  const activeTokens = tokenizeDescription(activeSeries.seriesDescription || "");
  const tokenOverlap = countOverlap(candidateTokens, activeTokens);
  const instanceDelta = Math.abs(candidate.instances.length - activeSeries.instances.length);
  const seriesNumberDelta = Math.abs(candidate.seriesNumber - activeSeries.seriesNumber);
  const modalityBonus = candidate.modality === activeSeries.modality ? 100 : 0;

  return {
    score: modalityBonus + tokenOverlap * 2 - instanceDelta / 10,
    tokenOverlap,
    instanceDelta,
    seriesNumberDelta,
  };
}

export function pickBestSeriesForStudy(series: Series[], activeSeries: Series): Series | null {
  const candidates = series.filter((item) => item.instances.length > 0);
  if (candidates.length === 0) {
    return null;
  }

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      metrics: scoreSeriesMatch(candidate, activeSeries),
    }))
    .sort((a, b) => {
      if (a.metrics.score !== b.metrics.score) {
        return b.metrics.score - a.metrics.score;
      }
      if (a.metrics.tokenOverlap !== b.metrics.tokenOverlap) {
        return b.metrics.tokenOverlap - a.metrics.tokenOverlap;
      }
      if (a.metrics.instanceDelta !== b.metrics.instanceDelta) {
        return a.metrics.instanceDelta - b.metrics.instanceDelta;
      }
      if (a.candidate.instances.length !== b.candidate.instances.length) {
        return b.candidate.instances.length - a.candidate.instances.length;
      }
      if (a.metrics.seriesNumberDelta !== b.metrics.seriesNumberDelta) {
        return a.metrics.seriesNumberDelta - b.metrics.seriesNumberDelta;
      }
      return a.candidate.seriesNumber - b.candidate.seriesNumber;
    });

  return ranked[0]?.candidate ?? null;
}
