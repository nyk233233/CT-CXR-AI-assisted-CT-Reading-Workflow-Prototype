import { NextResponse } from "next/server";
import { getWorklist } from "@/lib/mock/repository";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const items = getWorklist({
    q: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
  });

  return NextResponse.json({ items });
}
