import { NextResponse } from "next/server";
import type { ReportAssistInput } from "@/lib/domain";
import { draftReportWithModelAdapter } from "@/lib/ai/modelAdapter";

export async function POST(request: Request) {
  const body = (await request.json()) as ReportAssistInput;
  const result = await draftReportWithModelAdapter(body);

  return NextResponse.json({
    provider: result.provider,
    mode: result.mode,
    fallbackUsed: result.fallbackUsed,
    errorMessage: result.errorMessage,
    requestDurationMs: result.requestDurationMs,
    timeoutMs: result.timeoutMs,
    serviceMode: result.serviceMode,
    inputEcho: {
      caseId: body.caseId,
      studyId: body.studyId,
      section: body.currentSection,
      imageCount: body.imageRefs.length,
      findingCount: body.findings.length,
      measurementCount: body.measurements.length,
    },
    output: result.output,
  });
}
