import type { Study, Series } from "./types";

const TOPOGRAM_KEYWORDS = ["topogram", "scout", "localizer", "surview", "scanogram"];

/**
 * Find the topogram (scout/localizer) series in a study.
 * Matches by series description keywords, single instance, and CT modality.
 * Prefers coronal orientation if available.
 */
export function findTopogramSeries(study: Study): Series | null {
  const candidates = study.series.filter((s) => {
    if (s.modality !== "CT") return false;
    if (s.instances.length !== 1) return false;
    const desc = s.seriesDescription.toLowerCase();
    return TOPOGRAM_KEYWORDS.some((kw) => desc.includes(kw));
  });

  if (candidates.length === 0) return null;

  // Prefer coronal
  const coronal = candidates.find((s) =>
    s.seriesDescription.toLowerCase().includes("cor")
  );
  return coronal || candidates[0];
}
