import { readFile } from "fs/promises";
import { existsSync } from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CtStackSlice = {
  stackIndex: number;
  sliceIndex: number;
  instanceNumber?: number;
  zPosition?: number;
  filePath: string;
  sopInstanceUid?: string;
};

type CtStackManifest = {
  caseId: string;
  numSlices: number;
  slices: CtStackSlice[];
};

type RouteContext = {
  params: Promise<{
    caseId: string;
    stackIndex: string;
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

function normalizeLocalDicomPath(filePath: string): string {
  // Manifest was generated in WSL and may contain /mnt/e paths.
  // The Next.js dev server currently runs in Windows PowerShell,
  // so convert /mnt/e/... to E:/...
  if (filePath.startsWith("/mnt/e/")) {
    return `E:/${filePath.slice("/mnt/e/".length)}`;
  }

  if (filePath.startsWith("/mnt/d/")) {
    return `D:/${filePath.slice("/mnt/d/".length)}`;
  }

  if (filePath.startsWith("file:///")) {
    return filePath.replace("file:///", "");
  }

  return filePath;
}

async function loadManifest(caseId: string): Promise<{
  manifest: CtStackManifest;
  manifestPath: string;
} | null> {
  const candidates = MANIFEST_PATHS_BY_CASE[caseId];

  if (!candidates) {
    return null;
  }

  const manifestPath = resolveExistingPath(candidates);

  if (!manifestPath) {
    return null;
  }

  const raw = await readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(raw) as CtStackManifest;

  return {
    manifest,
    manifestPath,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { caseId, stackIndex } = await context.params;

  const parsedStackIndex = Number.parseInt(stackIndex, 10);

  if (!Number.isInteger(parsedStackIndex) || parsedStackIndex < 0) {
    return Response.json(
      {
        error: "Invalid stackIndex.",
        caseId,
        stackIndex,
      },
      { status: 400 },
    );
  }

  const loaded = await loadManifest(caseId);

  if (!loaded) {
    return Response.json(
      {
        error: "CT stack manifest not found or unknown case.",
        caseId,
      },
      { status: 404 },
    );
  }

  const { manifest } = loaded;

  const slice = manifest.slices.find(
    (item) => item.stackIndex === parsedStackIndex,
  );

  if (!slice) {
    return Response.json(
      {
        error: "Slice not found in CT stack manifest.",
        caseId,
        stackIndex: parsedStackIndex,
        numSlices: manifest.numSlices,
      },
      { status: 404 },
    );
  }

  const localDicomPath = normalizeLocalDicomPath(slice.filePath);

  if (!existsSync(localDicomPath)) {
    return Response.json(
      {
        error: "DICOM file not found on local filesystem.",
        caseId,
        stackIndex: parsedStackIndex,
        manifestFilePath: slice.filePath,
        resolvedLocalPath: localDicomPath,
      },
      { status: 404 },
    );
  }

  const dicomBytes = await readFile(localDicomPath);

  return new Response(new Uint8Array(dicomBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/dicom",
      "Content-Length": String(dicomBytes.byteLength),
      "Cache-Control": "no-store",
      "X-Case-Id": caseId,
      "X-Stack-Index": String(slice.stackIndex),
      "X-Instance-Number": String(slice.instanceNumber ?? ""),
      "X-Z-Position": String(slice.zPosition ?? ""),
      "X-SOP-Instance-UID": slice.sopInstanceUid ?? "",
    },
  });
}
