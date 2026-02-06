import * as cornerstone from "@cornerstonejs/core";
import dicomParser from "dicom-parser";
import { getFile } from "@/lib/dicom/file-manager";

const IMAGE_SCHEME = "fileid";

// Store parsed metadata per imageId so the metadata provider can return it
const imageMetadataMap = new Map<string, Record<string, unknown>>();

function loadImage(imageId: string): { promise: Promise<Record<string, unknown>> } {
  const fileKey = imageId.replace(`${IMAGE_SCHEME}:`, "");

  const promise = (async () => {
    const file = getFile(fileKey);
    if (!file) throw new Error(`File not found: ${fileKey}`);

    const buffer = await file.arrayBuffer();
    const byteArray = new Uint8Array(buffer);
    const dataset = dicomParser.parseDicom(byteArray);

    const rows = dataset.uint16("x00280010") || 0;
    const columns = dataset.uint16("x00280011") || 0;
    if (!rows || !columns) throw new Error("Missing image dimensions");

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
    if (!pixelDataElement) throw new Error("No pixel data");

    const offset = pixelDataElement.dataOffset;
    const numPixels = rows * columns * samplesPerPixel;

    // Read raw pixel data and prescale to Hounsfield units
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
    let minVal = Infinity, maxVal = -Infinity;
    for (let i = 0; i < numPixels; i++) {
      const val = rawPixelData[i] * slope + intercept;
      pixelData[i] = val;
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }

    // Parse spacing
    const pixelSpacingStr = dataset.string("x00280030");
    let rowSpacing = 1, colSpacing = 1;
    if (pixelSpacingStr) {
      const parts = pixelSpacingStr.split("\\");
      rowSpacing = parseFloat(parts[0]) || 1;
      colSpacing = parseFloat(parts[1]) || 1;
    }

    // Parse position/orientation for metadata provider
    const ippStr = dataset.string("x00200032"); // ImagePositionPatient
    const ioStr = dataset.string("x00200037");  // ImageOrientationPatient
    const sliceThickness = parseFloat(dataset.string("x00180050") || "1");

    const imagePositionPatient = ippStr
      ? ippStr.split("\\").map(Number)
      : [0, 0, 0];
    const imageOrientationPatient = ioStr
      ? ioStr.split("\\").map(Number)
      : [1, 0, 0, 0, 1, 0];

    // Store metadata for the provider
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

    console.log(`[OpenCT loader] OK: ${rows}x${columns}, slope=${slope}, intercept=${intercept}`);

    return {
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
      columnPixelSpacing: colSpacing,
      rowPixelSpacing: rowSpacing,
      sliceThickness,
      sizeInBytes: pixelData.byteLength,
      invert: photometric === "MONOCHROME1",
      getPixelData: () => pixelData,
      getCanvas: undefined,
      numComps: samplesPerPixel,
      photometricInterpretation: photometric,
      voiLUTFunction: "LINEAR",
      preScale: {
        enabled: true,
        scaled: true,
      },
    };
  })();

  return { promise };
}

// Metadata provider for Cornerstone3D — it queries this for rendering info
function metadataProvider(type: string, imageId: string): Record<string, unknown> | undefined {
  const meta = imageMetadataMap.get(imageId);
  if (!meta) return undefined;

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
        rowCosines: (meta.imageOrientationPatient as number[]).slice(0, 3),
        columnCosines: (meta.imageOrientationPatient as number[]).slice(3, 6),
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
  if (registered) return;
  registered = true;
  cornerstone.imageLoader.registerImageLoader(
    IMAGE_SCHEME,
    loadImage as unknown as cornerstone.Types.ImageLoaderFn
  );
  cornerstone.metaData.addProvider(metadataProvider, 10000);
  console.log("[OpenCT] Registered fileid: image loader + metadata provider");
}

export function getImageId(fileKey: string): string {
  return `${IMAGE_SCHEME}:${fileKey}`;
}
