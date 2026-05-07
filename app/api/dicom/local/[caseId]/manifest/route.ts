import { readFile } from "fs/promises";
import { existsSync } from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    caseId: string;
  }>;
};

const MANIFEST_PATHS_BY_CASE: Record<string, string[]> = {
  lidc_case_002: [
    "E:/med_data/ct_demo/derived/lidc_case_002/ct_stack_manifest.json",
    "/mnt/e/med_data/ct_demo/derived/lidc_case_002/ct_stack_manifest.json",
  ],
};

function resolveExistingPath(paths: string[]): string | null {
  for (const candidate of paths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export async function GET(_request: Request, context: RouteContext) {
  const { caseId } = await context.params;

  const candidates = MANIFEST_PATHS_BY_CASE[caseId];

  if (!candidates) {
    return Response.json(
      {
        error: "Unknown local DICOM case.",
        caseId,
      },
      { status: 404 },
    );
  }

  const manifestPath = resolveExistingPath(candidates);

  if (!manifestPath) {
    return Response.json(
      {
        error: "CT stack manifest not found.",
        caseId,
        searchedPaths: candidates,
      },
      { status: 404 },
    );
  }

  const raw = await readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(raw);

  return Response.json({
    ...manifest,
    localApi: {
      caseId,
      manifestPath,
      sliceUrlPattern: `/api/dicom/local/${caseId}/{stackIndex}`,
    },
  });
}
