import { AppShell } from "@/components/AppShell";
import { ResearchWorkbenchClient } from "@/components/ResearchWorkbenchClient";
import { getEvalCases, getEvalRunRecords } from "@/lib/mock/repository";

export default function ResearchPage() {
  return (
    <AppShell>
      <ResearchWorkbenchClient evalCases={getEvalCases()} records={getEvalRunRecords()} />
    </AppShell>
  );
}
