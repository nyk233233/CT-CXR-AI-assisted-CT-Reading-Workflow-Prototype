import { NextResponse } from "next/server";
import { getStudyBundle } from "@/lib/mock/repository";

export async function GET(_: Request, context: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await context.params;
  const bundle = getStudyBundle(studyId);

  if (!bundle) {
    return NextResponse.json({ message: "Study not found" }, { status: 404 });
  }

  return NextResponse.json(bundle);
}
