import dicomParser from "dicom-parser";
import type { StudyTree, Study, Series, Instance } from "./types";
import { generateFileKey, getFile } from "./file-manager";
import { getFileRelativePath } from "./file-path";

function getString(
  dataset: dicomParser.DataSet,
  tag: string,
  fallback = ""
): string {
  return dataset.string(tag)?.trim() || fallback;
}

function getInt(
  dataset: dicomParser.DataSet,
  tag: string,
  fallback = 0
): number {
  return dataset.intString(tag) ?? fallback;
}

export function findDicomdir(files: File[]): File | null {
  return (
    files.find((f) => {
      const name = getFileRelativePath(f).split("/").pop() || "";
      return name.toUpperCase() === "DICOMDIR";
    }) || null
  );
}

export async function parseDicomdir(
  dicomdirFile: File,
  rootPrefix: string
): Promise<StudyTree> {
  const buffer = await dicomdirFile.arrayBuffer();
  const byteArray = new Uint8Array(buffer);
  const dataset = dicomParser.parseDicom(byteArray);

  // x00041220 = DirectoryRecordSequence
  const dirRecordSeq = dataset.elements["x00041220"];
  if (!dirRecordSeq || !dirRecordSeq.items) {
    return { studies: [] };
  }

  // Walk the sequence in order. DICOMDIR records are stored in tree-order:
  // PATIENT, then its STUDY children, then SERIES children, then IMAGE leaves.
  // We use a simple sequential walk, tracking parent context.

  const items = dirRecordSeq.items;
  const studies: Study[] = [];

  let currentPatientName = "Unknown";
  let currentPatientID = "";
  let currentStudy: Study | null = null;
  let currentSeries: Series | null = null;

  for (const item of items) {
    const record = item.dataSet;
    if (!record) continue;

    const recordType = getString(record, "x00041430").toUpperCase();

    if (recordType === "PATIENT") {
      currentPatientName = getString(record, "x00100010", "Unknown");
      currentPatientID = getString(record, "x00100020", "");
      currentStudy = null;
      currentSeries = null;
    } else if (recordType === "STUDY") {
      const studyUID = getString(record, "x0020000d");
      if (!studyUID) continue;

      currentStudy = {
        studyInstanceUID: studyUID,
        studyDate: getString(record, "x00080020"),
        studyDescription: getString(record, "x00081030", "Unnamed Study"),
        patientName: currentPatientName,
        patientID: currentPatientID,
        series: [],
      };
      studies.push(currentStudy);
      currentSeries = null;
    } else if (recordType === "SERIES") {
      const seriesUID = getString(record, "x0020000e");
      if (!seriesUID || !currentStudy) continue;

      currentSeries = {
        seriesInstanceUID: seriesUID,
        seriesNumber: getInt(record, "x00200011"),
        seriesDescription: getString(record, "x0008103e", "Unnamed Series"),
        modality: getString(record, "x00080060", "OT"),
        instances: [],
      };
      currentStudy.series.push(currentSeries);
    } else if (recordType === "IMAGE" || recordType === "SR DOCUMENT") {
      if (!currentSeries) continue;

      const sopUID = getString(record, "x00080018");

      // x00041500 = ReferencedFileID — path components stored as multi-valued string
      const refFileId = getString(record, "x00041500");
      if (!refFileId) continue;

      // ReferencedFileID components are backslash-separated
      const relativePath = refFileId.replace(/\\/g, "/");
      const fullPath = rootPrefix
        ? `${rootPrefix}/${relativePath}`
        : relativePath;
      const fileKey = generateFileKey(fullPath);
      const file = getFile(fileKey);

      if (!file) continue;

      const instance: Instance = {
        fileKey,
        sopInstanceUID: sopUID || fileKey,
        instanceNumber: getInt(record, "x00200013"),
        file,
      };

      currentSeries.instances.push(instance);
    }
  }

  // Sort and clean up
  for (const study of studies) {
    study.series.sort((a, b) => a.seriesNumber - b.seriesNumber);
    for (const series of study.series) {
      series.instances.sort((a, b) => a.instanceNumber - b.instanceNumber);
    }
    study.series = study.series.filter((s) => s.instances.length > 0);
  }

  return { studies: studies.filter((s) => s.series.length > 0) };
}

export async function parseDicomdirFromFiles(
  files: File[]
): Promise<StudyTree | null> {
  const dicomdirFile = findDicomdir(files);
  if (!dicomdirFile) return null;

  const dicomdirPath = getFileRelativePath(dicomdirFile);
  const parts = dicomdirPath.split("/");
  const rootPrefix = parts.length > 1 ? parts.slice(0, -1).join("/") : "";

  return parseDicomdir(dicomdirFile, rootPrefix);
}
