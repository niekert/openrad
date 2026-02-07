import * as cornerstone from "@cornerstonejs/core";
import dicomParser from "dicom-parser";
import { getActiveFileSession, getFile } from "@/lib/dicom/file-manager";

const IMAGE_SCHEME = "fileid";

export interface ImageMetadata {
  rows: number;
  columns: number;
  bitsAllocated: number;
  bitsStored: number;
  highBit: number;
  pixelRepresentation: number;
  samplesPerPixel: number;
  photometricInterpretation: string;
  slope: number;
  intercept: number;
  windowCenter: number;
  windowWidth: number;
  rowPixelSpacing: number;
  columnPixelSpacing: number;
  sliceThickness: number;
  imagePositionPatient: [number, number, number];
  imageOrientationPatient: [number, number, number, number, number, number];
}

const imageMetadataMap = new Map<string, ImageMetadata>();

function parseImageId(imageId: string): { sessionId: string; fileKey: string } {
  const prefix = `${IMAGE_SCHEME}:`;
  if (!imageId.startsWith(prefix)) {
    return {
      sessionId: getActiveFileSession(),
      fileKey: imageId,
    };
  }

  const rest = imageId.slice(prefix.length);
  const divider = rest.indexOf(":");
  if (divider === -1) {
    return {
      sessionId: getActiveFileSession(),
      fileKey: rest,
    };
  }

  return {
    sessionId: rest.slice(0, divider),
    fileKey: rest.slice(divider + 1),
  };
}

function parseThreeVector(raw: string | undefined, fallback: [number, number, number]): [number, number, number] {
  if (!raw) {
    return fallback;
  }

  const parts = raw.split("\\").map(Number);
  if (parts.length < 3 || parts.some((value) => !Number.isFinite(value))) {
    return fallback;
  }

  return [parts[0], parts[1], parts[2]];
}

function parseSixVector(
  raw: string | undefined,
  fallback: [number, number, number, number, number, number]
): [number, number, number, number, number, number] {
  if (!raw) {
    return fallback;
  }

  const parts = raw.split("\\").map(Number);
  if (parts.length < 6 || parts.some((value) => !Number.isFinite(value))) {
    return fallback;
  }

  return [parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]];
}

function loadImage(imageId: string): { promise: Promise<cornerstone.Types.IImage> } {
  const { sessionId, fileKey } = parseImageId(imageId);

  const promise = (async () => {
    const file = getFile(fileKey, sessionId);
    if (!file) {
      throw new Error(`File not found: ${fileKey}`);
    }

    const buffer = await file.arrayBuffer();
    const byteArray = new Uint8Array(buffer);
    const dataset = dicomParser.parseDicom(byteArray);

    const rows = dataset.uint16("x00280010") || 0;
    const columns = dataset.uint16("x00280011") || 0;
    if (!rows || !columns) {
      throw new Error("Missing image dimensions");
    }

    const bitsAllocated = dataset.uint16("x00280100") || 16;
    const bitsStored = dataset.uint16("x00280101") || bitsAllocated;
    const highBit = dataset.uint16("x00280102") ?? bitsStored - 1;
    const pixelRepresentation = dataset.uint16("x00280103") || 0;
    const samplesPerPixel = dataset.uint16("x00280002") || 1;
    const photometric = dataset.string("x00280004") || "MONOCHROME2";
    const slope = parseFloat(dataset.string("x00281053") || "1");
    const intercept = parseFloat(dataset.string("x00281052") || "0");
    const windowCenter = parseFloat(dataset.string("x00281050") || "40");
    const windowWidth = parseFloat(dataset.string("x00281051") || "400");

    const pixelDataElement = dataset.elements["x7fe00010"];
    if (!pixelDataElement) {
      throw new Error("No pixel data");
    }

    const offset = pixelDataElement.dataOffset;
    const numPixels = rows * columns * samplesPerPixel;

    let rawPixelData: Int16Array | Uint16Array | Uint8Array;
    if (bitsAllocated === 16) {
      if (pixelRepresentation === 1) {
        rawPixelData = new Int16Array(buffer, offset, numPixels);
      } else {
        rawPixelData = new Uint16Array(buffer, offset, numPixels);
      }
    } else {
      rawPixelData = new Uint8Array(buffer, offset, numPixels);
    }

    const pixelData = new Float32Array(numPixels);
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (let i = 0; i < numPixels; i++) {
      const val = rawPixelData[i] * slope + intercept;
      pixelData[i] = val;
      if (val < minVal) {
        minVal = val;
      }
      if (val > maxVal) {
        maxVal = val;
      }
    }

    const pixelSpacingStr = dataset.string("x00280030");
    let rowSpacing = 1;
    let colSpacing = 1;
    if (pixelSpacingStr) {
      const parts = pixelSpacingStr.split("\\");
      rowSpacing = parseFloat(parts[0]) || 1;
      colSpacing = parseFloat(parts[1]) || 1;
    }

    const imagePositionPatient = parseThreeVector(dataset.string("x00200032"), [0, 0, 0]);
    const imageOrientationPatient = parseSixVector(dataset.string("x00200037"), [1, 0, 0, 0, 1, 0]);
    const sliceThickness = parseFloat(dataset.string("x00180050") || "1");

    imageMetadataMap.set(imageId, {
      rows,
      columns,
      bitsAllocated,
      bitsStored,
      highBit,
      pixelRepresentation,
      samplesPerPixel,
      photometricInterpretation: photometric,
      slope,
      intercept,
      windowCenter,
      windowWidth,
      rowPixelSpacing: rowSpacing,
      columnPixelSpacing: colSpacing,
      sliceThickness,
      imagePositionPatient,
      imageOrientationPatient,
    });

    const image: cornerstone.Types.IImage = {
      imageId,
      minPixelValue: minVal,
      maxPixelValue: maxVal,
      slope,
      intercept,
      windowCenter,
      windowWidth,
      rows,
      columns,
      height: rows,
      width: columns,
      color: samplesPerPixel > 1,
      rgba: false,
      numberOfComponents: samplesPerPixel,
      columnPixelSpacing: colSpacing,
      rowPixelSpacing: rowSpacing,
      sliceThickness,
      sizeInBytes: pixelData.byteLength,
      invert: photometric === "MONOCHROME1",
      getPixelData: () => pixelData,
      getCanvas: () => document.createElement("canvas"),
      photometricInterpretation: photometric,
      dataType: "Float32Array",
      voiLUTFunction: cornerstone.Enums.VOILUTFunctionType.LINEAR,
      preScale: {
        enabled: true,
        scaled: true,
      },
    };

    return image;
  })();

  return { promise };
}

function metadataProvider(
  type: string,
  imageId: string
): Record<string, unknown> | undefined {
  const meta = imageMetadataMap.get(imageId);
  if (!meta) {
    return undefined;
  }

  switch (type) {
    case "imagePixelModule":
      return {
        bitsAllocated: meta.bitsAllocated,
        bitsStored: meta.bitsStored,
        highBit: meta.highBit,
        pixelRepresentation: meta.pixelRepresentation,
        samplesPerPixel: meta.samplesPerPixel,
        photometricInterpretation: meta.photometricInterpretation,
        rows: meta.rows,
        columns: meta.columns,
      };
    case "imagePlaneModule":
      return {
        rowPixelSpacing: meta.rowPixelSpacing,
        columnPixelSpacing: meta.columnPixelSpacing,
        imagePositionPatient: meta.imagePositionPatient,
        imageOrientationPatient: meta.imageOrientationPatient,
        sliceThickness: meta.sliceThickness,
        rowCosines: meta.imageOrientationPatient.slice(0, 3),
        columnCosines: meta.imageOrientationPatient.slice(3, 6),
      };
    case "voiLutModule":
      return {
        windowCenter: [meta.windowCenter],
        windowWidth: [meta.windowWidth],
      };
    case "modalityLutModule":
      return {
        rescaleIntercept: meta.intercept,
        rescaleSlope: meta.slope,
        rescaleType: "HU",
      };
    case "generalSeriesModule":
      return { modality: "CT" };
    default:
      return undefined;
  }
}

let registered = false;

export function registerFileImageLoader(): void {
  if (registered) {
    return;
  }
  registered = true;
  cornerstone.imageLoader.registerImageLoader(IMAGE_SCHEME, loadImage);
  cornerstone.metaData.addProvider(metadataProvider, 10000);
}

export function getImageId(fileKey: string, sessionId = getActiveFileSession()): string {
  return `${IMAGE_SCHEME}:${sessionId}:${fileKey}`;
}

export function getImageMetadata(imageId: string): ImageMetadata | undefined {
  return imageMetadataMap.get(imageId);
}

export function clearImageMetadataForSession(sessionId: string): void {
  const prefix = `${IMAGE_SCHEME}:${sessionId}:`;
  for (const imageId of imageMetadataMap.keys()) {
    if (imageId.startsWith(prefix)) {
      imageMetadataMap.delete(imageId);
    }
  }
}
