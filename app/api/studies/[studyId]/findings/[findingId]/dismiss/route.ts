import { NextResponse } from "next/server";
import { updateFindingStatus } from "@/lib/mock/repository";

export async function POST(_: Request, context: { params: Promise<{ studyId: string; findingId: string }> }) {
  const { studyId, findingId } = await context.params;
  const bundle = updateFindingStatus(studyId, findingId, "dismissed");

  if (!bundle) {
    return NextResponse.json({ message: "Unable to update finding" }, { status: 404 });
  }

  return NextResponse.json({ findings: bundle.findings, workflow: bundle.workflow });
}
