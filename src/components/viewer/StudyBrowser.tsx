"use client";

import { useState } from "react";
import type { StudyTree, Series } from "@/lib/dicom/types";

interface StudyBrowserProps {
  studyTree: StudyTree;
  activeSeries: Series | null;
  onSelectSeries: (series: Series) => void;
}

export default function StudyBrowser({
  studyTree,
  activeSeries,
  onSelectSeries,
}: StudyBrowserProps) {
  const [expandedStudies, setExpandedStudies] = useState<Set<string>>(
    () => new Set(studyTree.studies.map((s) => s.studyInstanceUID))
  );

  const toggleStudy = (uid: string) => {
    setExpandedStudies((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-border overflow-hidden">
      <div className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted border-b border-border">
        Studies
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {studyTree.studies.map((study) => {
          const expanded = expandedStudies.has(study.studyInstanceUID);
          return (
            <div key={study.studyInstanceUID} className="mb-1">
              <button
                onClick={() => toggleStudy(study.studyInstanceUID)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-surface"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="currentColor"
                  className={`shrink-0 text-muted transition-transform ${
                    expanded ? "rotate-90" : ""
                  }`}
                >
                  <path d="M4 2l4 4-4 4" />
                </svg>
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {study.studyDescription}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {study.patientName}
                    {study.studyDate ? ` · ${formatDate(study.studyDate)}` : ""}
                  </div>
                </div>
              </button>

              {expanded && (
                <div className="ml-4 space-y-0.5">
                  {study.series.map((series) => {
                    const isActive =
                      activeSeries?.seriesInstanceUID ===
                      series.seriesInstanceUID;
                    return (
                      <button
                        key={series.seriesInstanceUID}
                        onClick={() => onSelectSeries(series)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                          isActive
                            ? "bg-accent-dim text-accent"
                            : "text-muted hover:bg-surface hover:text-foreground"
                        }`}
                      >
                        <span className="shrink-0 text-xs font-mono opacity-50">
                          {series.modality}
                        </span>
                        <span className="truncate">
                          {series.seriesDescription}
                        </span>
                        <span className="ml-auto shrink-0 text-xs opacity-50">
                          {series.instances.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(dicomDate: string): string {
  if (dicomDate.length !== 8) return dicomDate;
  return `${dicomDate.slice(0, 4)}-${dicomDate.slice(4, 6)}-${dicomDate.slice(6, 8)}`;
}
