import test from "node:test";
import assert from "node:assert/strict";
import type { Instance, Series } from "./types.ts";
import { pickBestSeriesForStudy } from "./prior-match.ts";

function makeInstances(count: number): Instance[] {
  const list: Instance[] = [];
  for (let i = 0; i < count; i += 1) {
    list.push({
      fileKey: `f-${i + 1}`,
      sopInstanceUID: `1.2.3.${i + 1}`,
      instanceNumber: i + 1,
      file: new File([""], `img-${i + 1}.dcm`),
    });
  }
  return list;
}

function makeSeries(
  seriesInstanceUID: string,
  seriesNumber: number,
  seriesDescription: string,
  modality: string,
  count: number
): Series {
  return {
    seriesInstanceUID,
    seriesNumber,
    seriesDescription,
    modality,
    instances: makeInstances(count),
  };
}

test("picks best study default using dicom-examples style descriptions", () => {
  const active = makeSeries("active", 5, "ThorAbd PV 1,00 Br36 Soft", "CT", 320);
  const candidates = [
    makeSeries("topogram", 1, "Topogram 0,60 Tr20 cor MPR", "CT", 1),
    makeSeries("lung", 6, "ThorAbd PV 1,00 Br56 Lung", "CT", 328),
    makeSeries("soft", 4, "ThorAbd PV 1.0 Br40 Soft", "CT", 318),
  ];

  const picked = pickBestSeriesForStudy(candidates, active);
  assert.ok(picked);
  assert.equal(picked.seriesInstanceUID, "soft");
});

test("favors closer slice count when description overlap is similar", () => {
  const active = makeSeries("active", 4, "HalsThorAbd PV 1,00 Br36 Soft", "CT", 360);
  const candidates = [
    makeSeries("far-count", 4, "HalsThorAbd PV 1,00 Br36 Soft", "CT", 200),
    makeSeries("close-count", 4, "HalsThorAbd PV 1,00 Br36 Soft", "CT", 356),
  ];

  const picked = pickBestSeriesForStudy(candidates, active);
  assert.ok(picked);
  assert.equal(picked.seriesInstanceUID, "close-count");
});

test("falls back to largest stack when metadata signal is weak", () => {
  const active = makeSeries("active", 10, "Thorax baseline", "CT", 300);
  const candidates = [
    makeSeries("small", 11, "Series A", "CT", 120),
    makeSeries("large", 12, "Series B", "CT", 280),
  ];

  const picked = pickBestSeriesForStudy(candidates, active);
  assert.ok(picked);
  assert.equal(picked.seriesInstanceUID, "large");
});

test("returns null when study has no usable image stacks", () => {
  const active = makeSeries("active", 5, "ThorAbd PV 1,00 Br36 Soft", "CT", 320);
  const emptyCandidates = [
    makeSeries("empty-1", 1, "Dose Report", "OT", 0),
    makeSeries("empty-2", 2, "Patient Protocol", "OT", 0),
  ];

  const picked = pickBestSeriesForStudy(emptyCandidates, active);
  assert.equal(picked, null);
});
