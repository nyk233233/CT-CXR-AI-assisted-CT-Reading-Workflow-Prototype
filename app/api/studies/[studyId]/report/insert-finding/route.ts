import { NextResponse } from "next/server";
import { insertFindingIntoReport } from "@/lib/mock/repository";

export async function POST(request: Request, context: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await context.params;
  const body = (await request.json()) as { findingId: string };
  const report = insertFindingIntoReport(studyId, body.findingId);

  if (!report) {
    return NextResponse.json({ message: "Unable to insert finding" }, { status: 404 });
  }

  return NextResponse.json({ report });
}
