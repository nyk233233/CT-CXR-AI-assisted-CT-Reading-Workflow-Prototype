import { buildOrthancCtManifest } from "@/lib/dicomweb/normalize";
import { OrthancHttpError } from "@/lib/dicomweb/orthancClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIDC_CASE_002_STUDY_INSTANCE_UID =
  "1.3.6.1.4.1.14519.5.2.1.6279.6001.490157381160200744295382098329";
const LIDC_CASE_002_CT_SERIES_INSTANCE_UID =
  "1.3.6.1.4.1.14519.5.2.1.6279.6001.619372068417051974713149104919";

function isUnavailableError(error: unknown): boolean {
  if (error instanceof OrthancHttpError) {
    return error.status === 503 || error.status === 502 || error.status === 504;
  }

  if (error instanceof TypeError) return true;

  const message = error instanceof Error ? error.message : String(error);
  return /ECONNREFUSED|fetch failed|connection/i.test(message);
}

export async function GET() {
  try {
    const manifest = await buildOrthancCtManifest(
      LIDC_CASE_002_STUDY_INSTANCE_UID,
      LIDC_CASE_002_CT_SERIES_INSTANCE_UID,
    );

    return Response.json(manifest);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    if (isUnavailableError(error)) {
      return Response.json(
        {
          error: "Orthanc DICOMweb unavailable",
          detail,
          hint: "Start Orthanc with docker compose up -d in infra/orthanc",
        },
        { status: 503 },
      );
    }

    if (/series not found/i.test(detail)) {
      return Response.json(
        {
          error: "CT series not found",
          detail,
        },
        { status: 404 },
      );
    }

    if (/metadata is empty|No valid instances/i.test(detail)) {
      return Response.json(
        {
          error: "Orthanc DICOMweb metadata could not be normalized",
          detail,
        },
        { status: 502 },
      );
    }

    return Response.json(
      {
        error: "Failed to build Orthanc CT manifest",
        detail,
      },
      { status: 500 },
    );
  }
}
