import { NextResponse } from "next/server";
import { getStudyBundle, updateReportSection } from "@/lib/mock/repository";

export async function GET(_: Request, context: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await context.params;
  const bundle = getStudyBundle(studyId);

  if (!bundle) {
    return NextResponse.json({ message: "Study not found" }, { status: 404 });
  }

  return NextResponse.json({ report: bundle.report });
}

export async function PATCH(request: Request, context: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await context.params;
  const body = (await request.json()) as { section: "clinicalInfo" | "technique" | "findings" | "impression"; text: string };
  const report = updateReportSection(studyId, body.section, body.text);

  if (!report) {
    return NextResponse.json({ message: "Unable to update report" }, { status: 404 });
  }

  return NextResponse.json({ report });
}
