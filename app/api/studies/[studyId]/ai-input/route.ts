import { NextResponse } from "next/server";
import { buildReportAssistInput } from "@/lib/mock/repository";

export async function GET(request: Request, context: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await context.params;
  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section") === "impression" ? "impression" : "findings";
  const input = buildReportAssistInput(studyId, section);

  if (!input) {
    return NextResponse.json({ message: "Study not found" }, { status: 404 });
  }

  return NextResponse.json({ input });
}
