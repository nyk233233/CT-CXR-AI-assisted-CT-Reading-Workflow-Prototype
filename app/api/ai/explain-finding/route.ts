import { NextResponse } from "next/server";
import type { ExplainFindingInput } from "@/lib/domain";
import { explainStructuredFinding } from "@/lib/mock/repository";

export async function POST(request: Request) {
  const body = (await request.json()) as ExplainFindingInput;
  const output = explainStructuredFinding(body);

  return NextResponse.json({
    provider: "mock-local-adapter",
    mode: "explain-finding",
    output,
  });
}
