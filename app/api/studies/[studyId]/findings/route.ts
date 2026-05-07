import { NextResponse } from "next/server";
import { getStudyBundle } from "@/lib/mock/repository";

export async function GET(_: Request, context: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await context.params;
  const bundle = getStudyBundle(studyId);

  if (!bundle) {
    return NextResponse.json({ message: "Study not found" }, { status: 404 });
  }

  const groupedCounts = bundle.findings.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    findings: bundle.findings,
    measurements: bundle.measurements,
    groupedCounts: Object.entries(groupedCounts).map(([category, count]) => ({ category, count })),
  });
}
