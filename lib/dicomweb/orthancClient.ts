import type { DicomWebDataset } from "@/lib/dicomweb/dicomTags";

export type OrthancConfig = {
  baseUrl: string;
  username: string;
  password: string;
};

export class OrthancHttpError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`Orthanc request failed with status ${status}: ${detail}`);
    this.name = "OrthancHttpError";
    this.status = status;
    this.detail = detail;
  }
}

export function getOrthancConfig(): OrthancConfig {
  return {
    baseUrl: (process.env.ORTHANC_BASE_URL ?? "http://localhost:8042").replace(/\/$/, ""),
    username: process.env.ORTHANC_USERNAME ?? "orthanc",
    password: process.env.ORTHANC_PASSWORD ?? "orthanc",
  };
}

function buildAuthHeader(config: OrthancConfig): string {
  return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
}

function buildUrl(path: string, config = getOrthancConfig()): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  return `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function orthancFetchJson<T = DicomWebDataset[]>(
  path: string,
  accept = "application/dicom+json",
): Promise<T> {
  const config = getOrthancConfig();
  const response = await fetch(buildUrl(path, config), {
    cache: "no-store",
    headers: {
      Accept: accept,
      Authorization: buildAuthHeader(config),
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new OrthancHttpError(response.status, detail || response.statusText);
  }

  return (await response.json()) as T;
}

export async function orthancFetchBytes(
  path: string,
  accept = "application/dicom",
): Promise<ArrayBuffer> {
  const config = getOrthancConfig();
  const response = await fetch(buildUrl(path, config), {
    cache: "no-store",
    headers: {
      Accept: accept,
      Authorization: buildAuthHeader(config),
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new OrthancHttpError(response.status, detail || response.statusText);
  }

  return response.arrayBuffer();
}

export function queryStudies(): Promise<DicomWebDataset[]> {
  return orthancFetchJson<DicomWebDataset[]>("/dicom-web/studies");
}

export function querySeries(studyInstanceUid: string): Promise<DicomWebDataset[]> {
  return orthancFetchJson<DicomWebDataset[]>(
    `/dicom-web/studies/${encodeURIComponent(studyInstanceUid)}/series`,
  );
}

export function queryInstances(
  studyInstanceUid: string,
  seriesInstanceUid: string,
): Promise<DicomWebDataset[]> {
  return orthancFetchJson<DicomWebDataset[]>(
    `/dicom-web/studies/${encodeURIComponent(studyInstanceUid)}/series/${encodeURIComponent(seriesInstanceUid)}/instances`,
  );
}

export function getSeriesMetadata(
  studyInstanceUid: string,
  seriesInstanceUid: string,
): Promise<DicomWebDataset[]> {
  return orthancFetchJson<DicomWebDataset[]>(
    `/dicom-web/studies/${encodeURIComponent(studyInstanceUid)}/series/${encodeURIComponent(seriesInstanceUid)}/metadata`,
  );
}
