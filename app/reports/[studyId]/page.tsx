import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getStudyBundle } from "@/lib/mock/repository";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ studyId: string }>;
}) {
  const { studyId } = await params;
  const bundle = getStudyBundle(studyId);

  if (!bundle) notFound();

  const sections = [
    bundle.report.clinicalInfo,
    bundle.report.technique,
    bundle.report.findings,
    bundle.report.impression,
  ];

  return (
    <AppShell>
      <section className="panel" style={{ padding: 20 }}>
        <h2 className="section-title">Report Workspace / 深编辑页</h2>
        <p className="section-note">
          这个页面把报告单独拉出来，模拟你规划里的 `/reports/[studyId]`。教学重点是说明报告工作区可以独立存在，但仍共享同一 clinical model。
        </p>
        <div className="stack" style={{ marginTop: 18 }}>
          {sections.map((section) => (
            <div key={section.key} className="report-section active">
              <div className="split-row">
                <strong>{section.title}</strong>
                <span className="tiny">linked findings: {section.linkedFindingIds.length}</span>
              </div>
              <div style={{ whiteSpace: "pre-wrap", marginTop: 10, lineHeight: 1.6 }}>{section.text || "Empty"}</div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
