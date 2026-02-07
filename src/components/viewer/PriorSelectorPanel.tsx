"use client";

import { useMemo, useState } from "react";
import type { Series, Study, StudyTree } from "@/lib/dicom/types";
import { pickBestSeriesForStudy } from "@/lib/dicom/prior-match";

interface PriorSelectorPanelProps {
  studyTree: StudyTree;
  activeSeries: Series;
  selectedCompareSeries: Series | null;
  onSelectCompareSeries: (series: Series) => void;
  onCloseSelector: () => void;
}

interface CandidateStudy {
  studyInstanceUID: string;
  studyDescription: string;
  studyDate: string;
  patientName: string;
  patientID: string;
  series: Series[];
}

export default function PriorSelectorPanel({
  studyTree,
  activeSeries,
  selectedCompareSeries,
  onSelectCompareSeries,
  onCloseSelector,
}: PriorSelectorPanelProps) {
  const [expandedStudyId, setExpandedStudyId] = useState<string | null>(null);

  const activeStudy = studyTree.studies.find((study) =>
    study.series.some((series) => series.seriesInstanceUID === activeSeries.seriesInstanceUID)
  );

  const candidates: CandidateStudy[] = studyTree.studies
    .filter((study) => study.studyInstanceUID !== activeStudy?.studyInstanceUID)
    .map((study) => ({
      ...study,
      series: study.series.filter((series) => series.instances.length > 0),
    }))
    .filter((study) => study.series.length > 0)
    .sort((a, b) => sortStudies(a, b, activeStudy));

  const defaultSeriesByStudy = useMemo(() => {
    const entries = candidates.map((study) => [
      study.studyInstanceUID,
      pickBestSeriesForStudy(study.series, activeSeries),
    ]);
    return new Map(entries);
  }, [activeSeries, candidates]);

  const handleSelectStudy = (study: CandidateStudy) => {
    const next = defaultSeriesByStudy.get(study.studyInstanceUID) ?? null;
    if (!next) {
      return;
    }
    onSelectCompareSeries(next);
    setExpandedStudyId(null);
    onCloseSelector();
  };

  const handleSelectSeries = (series: Series) => {
    onSelectCompareSeries(series);
    setExpandedStudyId(null);
    onCloseSelector();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border p-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted">Prior</div>
        <p className="mt-1 text-xs text-muted">
          Select a prior study. We auto-pick the closest series, and you can override below.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {candidates.length === 0 && (
          <div className="rounded-lg border border-border bg-surface p-3 text-xs text-muted">
            No prior study in loaded dataset.
          </div>
        )}

        {candidates.map((study) => (
          <div key={study.studyInstanceUID} className="mb-2 rounded-lg border border-border">
            <div className="border-b border-border px-2 py-2">
              <div className="flex items-start gap-2">
                <button
                  onClick={() => handleSelectStudy(study)}
                  className="min-w-0 flex-1 text-left"
                  title="Select best matching series for this study"
                >
                  <div className="truncate text-xs font-medium">{study.studyDescription || "Unnamed Study"}</div>
                  <div className="truncate text-[11px] text-muted">
                    {study.patientName || "Unknown Patient"}
                    {study.studyDate ? ` · ${formatDate(study.studyDate)}` : ""}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-muted">
                    Default: {defaultSeriesByStudy.get(study.studyInstanceUID)?.seriesDescription || "Unavailable"}
                  </div>
                </button>
                <button
                  onClick={() =>
                    setExpandedStudyId((current) =>
                      current === study.studyInstanceUID ? null : study.studyInstanceUID
                    )
                  }
                  className="rounded border border-border px-1.5 py-1 text-[10px] uppercase tracking-widest text-muted transition-colors hover:bg-surface hover:text-foreground"
                  title="Choose a different series"
                >
                  {expandedStudyId === study.studyInstanceUID ? "Hide" : "Choose"}
                </button>
              </div>
            </div>
            <div className={expandedStudyId === study.studyInstanceUID ? "p-1" : "hidden"}>
              {study.series.map((series) => {
                const selected = selectedCompareSeries?.seriesInstanceUID === series.seriesInstanceUID;
                const studyDefault = defaultSeriesByStudy.get(study.studyInstanceUID);
                const isStudyDefault = studyDefault?.seriesInstanceUID === series.seriesInstanceUID;
                return (
                  <button
                    key={series.seriesInstanceUID}
                    onClick={() => handleSelectSeries(series)}
                    className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                      selected
                        ? "bg-accent-dim text-accent"
                        : "text-muted hover:bg-surface hover:text-foreground"
                    }`}
                  >
                    <span className="font-mono opacity-60">{series.modality}</span>
                    <span className="truncate">{series.seriesDescription || "Unnamed Series"}</span>
                    {isStudyDefault && (
                      <span className="rounded border border-border px-1 py-0.5 text-[10px] uppercase tracking-widest">
                        Default
                      </span>
                    )}
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

function sortStudies(a: CandidateStudy, b: CandidateStudy, activeStudy: Study | undefined): number {
  const aSamePatient = isSamePatient(a, activeStudy);
  const bSamePatient = isSamePatient(b, activeStudy);
  if (aSamePatient !== bSamePatient) return aSamePatient ? -1 : 1;

  const aBefore = isOlder(a.studyDate, activeStudy?.studyDate);
  const bBefore = isOlder(b.studyDate, activeStudy?.studyDate);
  if (aBefore !== bBefore) return aBefore ? -1 : 1;

  return (b.studyDate || "").localeCompare(a.studyDate || "");
}

function isSamePatient(study: CandidateStudy, activeStudy: Study | undefined): boolean {
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
