"use client";

import type { Series, StudyTree } from "@/lib/dicom/types";

interface ComparePanelProps {
  studyTree: StudyTree;
  activeSeries: Series;
  selectedCompareSeries: Series | null;
  onSelectCompareSeries: (series: Series) => void;
  onClearCompareSeries: () => void;
}

interface CandidateStudy {
  studyInstanceUID: string;
  studyDescription: string;
  studyDate: string;
  patientName: string;
  patientID: string;
  series: Series[];
}

export default function ComparePanel({
  studyTree,
  activeSeries,
  selectedCompareSeries,
  onSelectCompareSeries,
  onClearCompareSeries,
}: ComparePanelProps) {
  const activeStudy = studyTree.studies.find((study) =>
    study.series.some((series) => series.seriesInstanceUID === activeSeries.seriesInstanceUID)
  );

  const candidates: CandidateStudy[] = studyTree.studies
    .map((study) => ({
      ...study,
      series: study.series.filter(
        (series) =>
          series.seriesInstanceUID !== activeSeries.seriesInstanceUID &&
          series.instances.length > 0
      ),
    }))
    .filter((study) => study.series.length > 0)
    .sort((a, b) => sortStudies(a, b, activeStudy, activeSeries));

  const flattenedSeries = candidates.flatMap((study) =>
    study.series.map((series) => ({ study, series }))
  );
  const quickPrior = flattenedSeries[0] ?? null;
  const modalityMatch =
    flattenedSeries.find((item) => item.series.modality === activeSeries.modality) ?? null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border p-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted">Compare</div>
        <p className="mt-1 text-xs text-muted">
          Select a prior series to view side-by-side with the active scan.
        </p>
      </div>

      <div className="space-y-2 border-b border-border p-3">
        <button
          disabled={!quickPrior}
          onClick={() => quickPrior && onSelectCompareSeries(quickPrior.series)}
          className="w-full rounded-lg border border-border px-3 py-2 text-left text-xs transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          Most recent prior study
        </button>
        <button
          disabled={!modalityMatch}
          onClick={() => modalityMatch && onSelectCompareSeries(modalityMatch.series)}
          className="w-full rounded-lg border border-border px-3 py-2 text-left text-xs transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          Best modality match ({activeSeries.modality})
        </button>
        <button
          disabled={!selectedCompareSeries}
          onClick={onClearCompareSeries}
          className="w-full rounded-lg px-3 py-2 text-left text-xs text-muted transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear selection
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {candidates.length === 0 && (
          <div className="rounded-lg border border-border bg-surface p-3 text-xs text-muted">
            No earlier study in loaded dataset.
          </div>
        )}

        {candidates.map((study) => (
          <div key={study.studyInstanceUID} className="mb-2 rounded-lg border border-border">
            <div className="border-b border-border px-2 py-2">
              <div className="truncate text-xs font-medium">{study.studyDescription || "Unnamed Study"}</div>
              <div className="truncate text-[11px] text-muted">
                {study.patientName || "Unknown Patient"}
                {study.studyDate ? ` · ${formatDate(study.studyDate)}` : ""}
              </div>
            </div>
            <div className="p-1">
              {study.series.map((series) => {
                const selected =
                  selectedCompareSeries?.seriesInstanceUID === series.seriesInstanceUID;
                return (
                  <button
                    key={series.seriesInstanceUID}
                    onClick={() => onSelectCompareSeries(series)}
                    className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                      selected
                        ? "bg-accent-dim text-accent"
                        : "text-muted hover:bg-surface hover:text-foreground"
                    }`}
                  >
                    <span className="font-mono opacity-60">{series.modality}</span>
                    <span className="truncate">{series.seriesDescription || "Unnamed Series"}</span>
                    <span className="ml-auto opacity-50">{series.instances.length}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function sortStudies(
  a: CandidateStudy,
  b: CandidateStudy,
  activeStudy: CandidateStudy | undefined,
  activeSeries: Series
): number {
  const aSamePatient = isSamePatient(a, activeStudy);
  const bSamePatient = isSamePatient(b, activeStudy);
  if (aSamePatient !== bSamePatient) return aSamePatient ? -1 : 1;

  const aBefore = isOlder(a.studyDate, activeStudy?.studyDate);
  const bBefore = isOlder(b.studyDate, activeStudy?.studyDate);
  if (aBefore !== bBefore) return aBefore ? -1 : 1;

  const aModality = a.series.some((s) => s.modality === activeSeries.modality);
  const bModality = b.series.some((s) => s.modality === activeSeries.modality);
  if (aModality !== bModality) return aModality ? -1 : 1;

  return (b.studyDate || "").localeCompare(a.studyDate || "");
}

function isSamePatient(study: CandidateStudy, activeStudy: CandidateStudy | undefined): boolean {
  if (!activeStudy) return false;
  if (study.patientID && activeStudy.patientID) {
    return study.patientID === activeStudy.patientID;
  }
  return study.patientName === activeStudy.patientName;
}

function isOlder(date: string, activeDate: string | undefined): boolean {
  if (!date || !activeDate) return false;
  return date < activeDate;
}

function formatDate(dicomDate: string): string {
  if (dicomDate.length !== 8) return dicomDate;
  return `${dicomDate.slice(0, 4)}-${dicomDate.slice(4, 6)}-${dicomDate.slice(6, 8)}`;
}
