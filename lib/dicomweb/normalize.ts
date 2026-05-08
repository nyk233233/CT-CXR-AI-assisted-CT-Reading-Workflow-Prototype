import {
  DICOM_TAGS,
  getListTagValue,
  getNumberTagValue,
  getStringTagValue,
} from "@/lib/dicomweb/dicomTags";
import type { DicomWebDataset } from "@/lib/dicomweb/dicomTags";
import { getOrthancConfig, getSeriesMetadata, querySeries } from "@/lib/dicomweb/orthancClient";

export type DicomWebSeriesSummary = {
  modality: string;
  seriesDescription?: string | null;
  seriesInstanceUid: string;
  seriesNumber?: number | null;
  instanceCount?: number | null;
  retrieveUrl?: string | null;
};

export type DicomWebInstanceSummary = {
  sopInstanceUid: string;
  instanceNumber?: number | null;
  imagePositionPatient?: Array<string | number> | null;
  zPosition?: number | null;
  imageOrientationPatient?: Array<string | number> | null;
  rows?: number | null;
  columns?: number | null;
  pixelSpacing?: [number, number] | null;
  sliceThickness?: number | null;
  rescaleSlope?: number | null;
  rescaleIntercept?: number | null;
  windowCenter?: number | null;
  windowWidth?: number | null;
  wadoUri: string;
  wadorsInstanceUrl: string;
};

export type OrthancCtManifest = {
  source: "orthanc-dicomweb";
  orthancBaseUrl: string;
  caseId: "lidc_case_002";
  patientId: "LIDC-IDRI-0002";
  studyInstanceUid: string;
  ctSeriesInstanceUid: string;
  series: DicomWebSeriesSummary[];
  instances: DicomWebInstanceSummary[];
  count: number;
  rows?: number | null;
  columns?: number | null;
  pixelSpacing?: [number, number] | null;
  sliceThickness?: number | null;
  zMin?: number | null;
  zMax?: number | null;
};

function asNumber(value: string | number | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toNumberPair(values: Array<string | number> | null): [number, number] | null {
  if (!values || values.length < 2) return null;

  const first = asNumber(values[0]);
  const second = asNumber(values[1]);

  return first !== null && second !== null ? [first, second] : null;
}

function buildWadoUri(orthancBaseUrl: string, studyUid: string, seriesUid: string, sopInstanceUid: string): string {
  const url = new URL("/wado", orthancBaseUrl);
  url.searchParams.set("requestType", "WADO");
  url.searchParams.set("studyUID", studyUid);
  url.searchParams.set("seriesUID", seriesUid);
  url.searchParams.set("objectUID", sopInstanceUid);
  url.searchParams.set("contentType", "application/dicom");

  return url.toString();
}

function buildWadorsInstanceUrl(
  orthancBaseUrl: string,
  studyUid: string,
  seriesUid: string,
  sopInstanceUid: string,
): string {
  return `${orthancBaseUrl}/dicom-web/studies/${encodeURIComponent(studyUid)}/series/${encodeURIComponent(seriesUid)}/instances/${encodeURIComponent(sopInstanceUid)}`;
}

export function normalizeSeries(item: DicomWebDataset): DicomWebSeriesSummary {
  return {
    modality: getStringTagValue(item, DICOM_TAGS.Modality) ?? "unknown",
    seriesDescription: getStringTagValue(item, DICOM_TAGS.SeriesDescription),
    seriesInstanceUid: getStringTagValue(item, DICOM_TAGS.SeriesInstanceUID) ?? "",
    seriesNumber: getNumberTagValue(item, DICOM_TAGS.SeriesNumber),
    instanceCount: getNumberTagValue(item, DICOM_TAGS.NumberOfSeriesRelatedInstances),
    retrieveUrl: getStringTagValue(item, DICOM_TAGS.RetrieveURL),
  };
}

export function normalizeInstance(
  item: DicomWebDataset,
  studyUid: string,
  seriesUid: string,
  orthancBaseUrl: string,
): DicomWebInstanceSummary {
  const sopInstanceUid = getStringTagValue(item, DICOM_TAGS.SOPInstanceUID) ?? "";
  const imagePositionPatient = getListTagValue(item, DICOM_TAGS.ImagePositionPatient);
  const zPosition = asNumber(imagePositionPatient?.[2]);

  return {
    sopInstanceUid,
    instanceNumber: getNumberTagValue(item, DICOM_TAGS.InstanceNumber),
    imagePositionPatient,
    zPosition,
    imageOrientationPatient: getListTagValue(item, DICOM_TAGS.ImageOrientationPatient),
    rows: getNumberTagValue(item, DICOM_TAGS.Rows),
    columns: getNumberTagValue(item, DICOM_TAGS.Columns),
    pixelSpacing: toNumberPair(getListTagValue(item, DICOM_TAGS.PixelSpacing)),
    sliceThickness: getNumberTagValue(item, DICOM_TAGS.SliceThickness),
    rescaleSlope: getNumberTagValue(item, DICOM_TAGS.RescaleSlope),
    rescaleIntercept: getNumberTagValue(item, DICOM_TAGS.RescaleIntercept),
    windowCenter: getNumberTagValue(item, DICOM_TAGS.WindowCenter),
    windowWidth: getNumberTagValue(item, DICOM_TAGS.WindowWidth),
    wadoUri: buildWadoUri(orthancBaseUrl, studyUid, seriesUid, sopInstanceUid),
    wadorsInstanceUrl: buildWadorsInstanceUrl(orthancBaseUrl, studyUid, seriesUid, sopInstanceUid),
  };
}

function sortInstances(instances: DicomWebInstanceSummary[]): DicomWebInstanceSummary[] {
  return [...instances].sort((a, b) => {
    if (typeof a.zPosition === "number" && typeof b.zPosition === "number") {
      return a.zPosition - b.zPosition;
    }

    return (a.instanceNumber ?? 0) - (b.instanceNumber ?? 0);
  });
}

export async function buildOrthancCtManifest(
  studyUid: string,
  seriesUid: string,
): Promise<OrthancCtManifest> {
  const { baseUrl } = getOrthancConfig();
  const series = (await querySeries(studyUid)).map(normalizeSeries);
  const ctSeries = series.find((item) => item.seriesInstanceUid === seriesUid);

  if (!ctSeries) {
    throw new Error(`CT series not found in Orthanc DICOMweb response: ${seriesUid}`);
  }

  const metadata = await getSeriesMetadata(studyUid, seriesUid);
  if (!metadata || metadata.length === 0) {
    throw new Error(`Series metadata is empty for ${seriesUid}`);
  }

  const instances = sortInstances(
    metadata
      .map((item) => normalizeInstance(item, studyUid, seriesUid, baseUrl))
      .filter((item) => item.sopInstanceUid),
  );

  if (instances.length === 0) {
    throw new Error(`No valid instances were normalized for ${seriesUid}`);
  }

  const zPositions = instances
    .map((item) => item.zPosition)
    .filter((value): value is number => typeof value === "number");
  const representative = instances.find((item) => item.rows && item.columns) ?? instances[0];

  return {
    source: "orthanc-dicomweb",
    orthancBaseUrl: baseUrl,
    caseId: "lidc_case_002",
    patientId: "LIDC-IDRI-0002",
    studyInstanceUid: studyUid,
    ctSeriesInstanceUid: seriesUid,
    series,
    instances,
    count: instances.length,
    rows: representative.rows ?? null,
    columns: representative.columns ?? null,
    pixelSpacing: representative.pixelSpacing ?? null,
    sliceThickness: representative.sliceThickness ?? null,
    zMin: zPositions.length > 0 ? Math.min(...zPositions) : null,
    zMax: zPositions.length > 0 ? Math.max(...zPositions) : null,
  };
}
