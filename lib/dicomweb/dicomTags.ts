export type DicomWebTagValue = {
  vr?: string;
  Value?: unknown[];
  InlineBinary?: string;
  BulkDataURI?: string;
};

export type DicomWebDataset = Record<string, DicomWebTagValue | undefined>;

export const DICOM_TAGS = {
  PatientID: "00100020",
  StudyInstanceUID: "0020000D",
  SeriesInstanceUID: "0020000E",
  SOPInstanceUID: "00080018",
  Modality: "00080060",
  SeriesDescription: "0008103E",
  SeriesNumber: "00200011",
  InstanceNumber: "00200013",
  NumberOfSeriesRelatedInstances: "00201209",
  ImagePositionPatient: "00200032",
  ImageOrientationPatient: "00200037",
  Rows: "00280010",
  Columns: "00280011",
  PixelSpacing: "00280030",
  SliceThickness: "00180050",
  RescaleIntercept: "00281052",
  RescaleSlope: "00281053",
  WindowCenter: "00281050",
  WindowWidth: "00281051",
  RetrieveURL: "00081190",
} as const;

function unwrapDicomValue(value: unknown): unknown {
  if (value && typeof value === "object" && "Alphabetic" in value) {
    return (value as { Alphabetic?: unknown }).Alphabetic;
  }

  return value;
}

export function getTagValue(item: DicomWebDataset, tag: string): unknown[] | undefined {
  return item[tag]?.Value;
}

export function getFirstTagValue(item: DicomWebDataset, tag: string): unknown {
  return getTagValue(item, tag)?.[0];
}

export function getStringTagValue(item: DicomWebDataset, tag: string): string | null {
  const value = unwrapDicomValue(getFirstTagValue(item, tag));

  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);

  return null;
}

export function getNumberTagValue(item: DicomWebDataset, tag: string): number | null {
  const value = unwrapDicomValue(getFirstTagValue(item, tag));

  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function getListTagValue(item: DicomWebDataset, tag: string): Array<string | number> | null {
  const values = getTagValue(item, tag);

  if (!values || values.length === 0) return null;

  return values
    .map(unwrapDicomValue)
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number");
}
