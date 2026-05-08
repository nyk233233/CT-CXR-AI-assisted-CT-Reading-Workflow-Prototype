import { getOrthancConfig, orthancFetchBytes, OrthancHttpError } from "@/lib/dicomweb/orthancClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    sopInstanceUid: string;
  }>;
};

const LIDC_CASE_002_STUDY_INSTANCE_UID =
  "1.3.6.1.4.1.14519.5.2.1.6279.6001.490157381160200744295382098329";
const LIDC_CASE_002_CT_SERIES_INSTANCE_UID =
  "1.3.6.1.4.1.14519.5.2.1.6279.6001.619372068417051974713149104919";

function buildOrthancWadoUri(sopInstanceUid: string): string {
  const { baseUrl } = getOrthancConfig();
  const url = new URL("/wado", baseUrl);
  url.searchParams.set("requestType", "WADO");
  url.searchParams.set("studyUID", LIDC_CASE_002_STUDY_INSTANCE_UID);
  url.searchParams.set("seriesUID", LIDC_CASE_002_CT_SERIES_INSTANCE_UID);
  url.searchParams.set("objectUID", sopInstanceUid);
  url.searchParams.set("contentType", "application/dicom");

  return url.toString();
}

function isUnavailableError(error: unknown): boolean {
  if (error instanceof OrthancHttpError) {
    return error.status === 503 || error.status === 502 || error.status === 504;
  }

  if (error instanceof TypeError) return true;

  const message = error instanceof Error ? error.message : String(error);
  return /ECONNREFUSED|fetch failed|connection/i.test(message);
}

export async function GET(_request: Request, context: RouteContext) {
  const { sopInstanceUid } = await context.params;

  if (!sopInstanceUid) {
    return Response.json(
      {
        error: "Missing SOPInstanceUID.",
      },
      { status: 400 },
    );
  }

  try {
    const dicomBytes = await orthancFetchBytes(buildOrthancWadoUri(sopInstanceUid));

    return new Response(dicomBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/dicom",
        "Content-Length": String(dicomBytes.byteLength),
        "Cache-Control": "no-store",
        "X-Source": "orthanc-dicomweb",
        "X-SOP-Instance-UID": sopInstanceUid,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    if (isUnavailableError(error)) {
      return Response.json(
        {
          error: "Orthanc DICOMweb source unavailable",
          detail,
          hint: "Start Orthanc with docker compose up -d.",
        },
        { status: 503 },
      );
    }

    if (error instanceof OrthancHttpError && error.status === 404) {
      return Response.json(
        {
          error: "Orthanc DICOM instance not found",
          sopInstanceUid,
          detail,
        },
        { status: 404 },
      );
    }

    return Response.json(
      {
        error: "Failed to proxy Orthanc DICOM instance",
        sopInstanceUid,
        detail,
      },
      { status: 502 },
    );
  }
}
