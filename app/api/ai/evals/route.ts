import { NextResponse } from "next/server";
import { getEvalCases, getEvalRunRecords } from "@/lib/mock/repository";

export async function GET() {
  return NextResponse.json({
    evalCases: getEvalCases(),
    records: getEvalRunRecords(),
  });
}
