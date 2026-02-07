import dicomParser from "dicom-parser";
import type { StudyTree, Study, Series, Instance } from "./types";
import { generateFileKey } from "./file-manager";
import { getFileRelativePath } from "./file-path";

async function isDicomFile(file: File): Promise<boolean> {
  if (file.size < 132) return false;
  const header = await file.slice(128, 132).arrayBuffer();
  const magic = new Uint8Array(header);
  // DICM magic at offset 128
  return magic[0] === 68 && magic[1] === 73 && magic[2] === 67 && magic[3] === 77;
}

interface ParsedHeader {
  studyInstanceUID: string;
  seriesInstanceUID: string;
  sopInstanceUID: string;
  studyDate: string;
  studyDescription: string;
  seriesDescription: string;
  seriesNumber: number;
  instanceNumber: number;
  modality: string;
  patientName: string;
  patientID: string;
}

async function parseHeader(file: File): Promise<ParsedHeader | null> {
  try {
    // Read enough for headers (first 64KB usually sufficient)
    const chunk = await file.slice(0, 65536).arrayBuffer();
    const byteArray = new Uint8Array(chunk);
    const dataset = dicomParser.parseDicom(byteArray, {
      untilTag: "x7fe00010", // Stop before PixelData
    });

    const studyUID = dataset.string("x0020000d");
    const seriesUID = dataset.string("x0020000e");
    if (!studyUID || !seriesUID) return null;

    return {
      studyInstanceUID: studyUID,
      seriesInstanceUID: seriesUID,
      sopInstanceUID: dataset.string("x00080018") || "",
      studyDate: dataset.string("x00080020") || "",
      studyDescription: dataset.string("x00081030") || "Unnamed Study",
      seriesDescription: dataset.string("x0008103e") || "Unnamed Series",
      seriesNumber: dataset.intString("x00200011") ?? 0,
      instanceNumber: dataset.intString("x00200013") ?? 0,
      modality: dataset.string("x00080060") || "OT",
      patientName: dataset.string("x00100010") || "Unknown",
      patientID: dataset.string("x00100020") || "",
    };
  } catch {
    return null;
  }
}

export async function parseFilesWithoutDicomdir(
  files: File[],
  onProgress?: (done: number, total: number) => void
): Promise<StudyTree> {
  const studyMap = new Map<string, Study>();
  const seriesMap = new Map<string, Series>();

  let processed = 0;
  const total = files.length;

  // Process files in batches to avoid blocking UI
  const BATCH_SIZE = 50;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (file) => {
        processed++;
        if (onProgress && processed % 100 === 0) {
          onProgress(processed, total);
        }

        const isDcm = await isDicomFile(file);
        if (!isDcm) return;

        const header = await parseHeader(file);
        if (!header) return;

        const path = getFileRelativePath(file);
        const fileKey = generateFileKey(path);

        // Ensure study exists
        if (!studyMap.has(header.studyInstanceUID)) {
          studyMap.set(header.studyInstanceUID, {
            studyInstanceUID: header.studyInstanceUID,
            studyDate: header.studyDate,
            studyDescription: header.studyDescription,
            patientName: header.patientName,
            patientID: header.patientID,
            series: [],
          });
        }

        // Ensure series exists
        if (!seriesMap.has(header.seriesInstanceUID)) {
          const series: Series = {
            seriesInstanceUID: header.seriesInstanceUID,
            seriesNumber: header.seriesNumber,
            seriesDescription: header.seriesDescription,
            modality: header.modality,
            instances: [],
          };
          seriesMap.set(header.seriesInstanceUID, series);
          studyMap.get(header.studyInstanceUID)!.series.push(series);
        }

        const instance: Instance = {
          fileKey,
          sopInstanceUID: header.sopInstanceUID || fileKey,
          instanceNumber: header.instanceNumber,
          file,
        };
        seriesMap.get(header.seriesInstanceUID)!.instances.push(instance);
      })
    );
  }

  onProgress?.(total, total);

  const studies = Array.from(studyMap.values());
  for (const study of studies) {
    study.series.sort((a, b) => a.seriesNumber - b.seriesNumber);
    for (const series of study.series) {
      series.instances.sort((a, b) => a.instanceNumber - b.instanceNumber);
    }
    study.series = study.series.filter((s) => s.instances.length > 0);
  }

  return { studies: studies.filter((s) => s.series.length > 0) };
}
