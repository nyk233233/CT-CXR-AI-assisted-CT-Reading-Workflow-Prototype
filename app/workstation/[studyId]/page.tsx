import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { WorkstationClient } from "@/components/WorkstationClient";
import { getImageRefs, getStudyBundle } from "@/lib/mock/repository";

export default async function WorkstationPage({
  params,
}: {
  params: Promise<{ studyId: string }>;
}) {
  const { studyId } = await params;
  const bundle = getStudyBundle(studyId);
  const imageRefs = getImageRefs(studyId);

  if (!bundle) notFound();

  return (
    <AppShell>
      <WorkstationClient initialBundle={bundle} initialImageRefs={imageRefs} />
    </AppShell>
  );
}
