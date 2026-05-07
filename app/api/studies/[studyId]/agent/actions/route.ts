import { NextResponse } from "next/server";
import { executeAgentAction } from "@/lib/mock/repository";

export async function POST(request: Request, context: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await context.params;
  const body = (await request.json()) as
    | { type: "focusFinding"; input: { findingId: string } }
    | { type: "draftReport"; input: { scope: "findings" | "impression" } }
    | { type: "getMeasurementSummary"; input: { findingId: string } };

  const result = executeAgentAction(studyId, body);

  if (!result) {
    return NextResponse.json({ message: "Unable to execute action" }, { status: 404 });
  }

  return NextResponse.json(result);
}
