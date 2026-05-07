import type {
  ActionLogEntry,
  EvalCase,
  EvalRunRecord,
  Finding,
  ExplainFindingInput,
  ExplainFindingOutput,
  ImageRef,
  MeasurementSummary,
  ReportDraft,
  ReportAssistInput,
  ReportAssistOutput,
  ReportSectionKey,
  Study,
  StudyBundle,
} from "@/lib/domain";
import { aiInputExamples, evalCases, evalRunRecords, imageRefsByStudy, studyBundles, worklist } from "@/lib/mock/data";

type AgentRequest =
  | { type: "focusFinding"; input: { findingId: string } }
  | { type: "draftReport"; input: { scope: "findings" | "impression" } }
  | { type: "getMeasurementSummary"; input: { findingId: string } };

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function getWorklist(query?: { q?: string; status?: string; priority?: string }): Study[] {
  return worklist.filter((item) => {
    const matchQ =
      !query?.q ||
      `${item.patient.patientName} ${item.description}`.toLowerCase().includes(query.q.toLowerCase());
    const matchStatus = !query?.status || item.studyStatus === query.status;
    const matchPriority = !query?.priority || item.priority === query.priority;
    return matchQ && matchStatus && matchPriority;
  });
}

export function getStudyBundle(studyId: string): StudyBundle | null {
  const bundle = studyBundles[studyId];
  return bundle ? clone(bundle) : null;
}

export function getImageRefs(studyId: string): ImageRef[] {
  return clone(imageRefsByStudy[studyId] ?? []);
}

export function buildReportAssistInput(
  studyId: string,
  currentSection: "findings" | "impression",
): ReportAssistInput | null {
  const bundle = studyBundles[studyId];
  if (!bundle) return null;

  const input = aiInputExamples[studyId];
  if (input) {
    const includedFindings = input.findings.filter((finding) => finding.status !== "dismissed");
    const includedFindingIds = new Set(includedFindings.map((finding) => finding.findingId));

    return clone({
      ...input,
      currentSection,
      findings: includedFindings,
      measurements: input.measurements.filter((measurement) => includedFindingIds.has(measurement.findingId)),
    });
  }

  const includedFindings = bundle.findings.filter((finding) => {
    if (finding.status === "dismissed") return false;
    if (studyId === "study-lidc-002") return finding.status === "confirmed";
    return true;
  });
  const includedFindingIds = new Set(includedFindings.map((finding) => finding.findingId));

  return {
    caseId: `case-${studyId}`,
    studyId,
    imageRefs: getImageRefs(studyId),
    findings: includedFindings.map((finding) => ({
      findingId: finding.findingId,
      label: finding.label,
      category: finding.category,
      status: finding.status,
      source: finding.source,
      narrative: finding.narrative,
      sizeText: finding.sizeText,
      riskLevel: finding.riskLevel,
      confidence: finding.confidence,
      linkedSeriesId: finding.linkedSeriesId,
      linkedSliceIndex: finding.linkedSliceIndex,
    })),
    measurements: clone(bundle.measurements.filter((measurement) => includedFindingIds.has(measurement.findingId))),
    templateType: bundle.study.bodyPart === "Chest" ? "chest_ct" : "abdomen_ct",
    currentSection,
    priorSummary: bundle.study.historySummary,
    clinicalInfo: bundle.report.clinicalInfo.text,
  };
}

export function updateFindingStatus(
  studyId: string,
  findingId: string,
  status: Finding["status"],
): StudyBundle | null {
  const bundle = studyBundles[studyId];
  if (!bundle) return null;

  bundle.findings = bundle.findings.map((finding) =>
    finding.findingId === findingId ? { ...finding, status } : finding,
  );

  bundle.actionLogs.unshift(createLog(studyId, "user", `finding_${status}`, `Finding ${findingId} -> ${status}`));
  return clone(bundle);
}

export function updateReportSection(
  studyId: string,
  section: ReportSectionKey,
  text: string,
): ReportDraft | null {
  const bundle = studyBundles[studyId];
  if (!bundle) return null;

  bundle.report = { ...bundle.report, [section]: { ...bundle.report[section], text } };
  bundle.actionLogs.unshift(createLog(studyId, "user", "report_text_inserted", `Updated ${section} section text.`));
  return clone(bundle.report);
}

export function insertFindingIntoReport(studyId: string, findingId: string): ReportDraft | null {
  const bundle = studyBundles[studyId];
  if (!bundle) return null;

  const finding = bundle.findings.find((item) => item.findingId === findingId);
  if (!finding) return null;

  const nextText = [bundle.report.findings.text, `- ${finding.narrative}`].filter(Boolean).join("\n");
  const linkedFindingIds = Array.from(new Set([...bundle.report.findings.linkedFindingIds, findingId]));

  bundle.report.findings = { ...bundle.report.findings, text: nextText, linkedFindingIds };
  bundle.actionLogs.unshift(createLog(studyId, "user", "report_text_inserted", `Inserted ${finding.label} into findings section.`));
  return clone(bundle.report);
}

export function executeAgentAction(
  studyId: string,
  request: AgentRequest,
): {
  message: string;
  commands: Array<Record<string, string>>;
  measurement?: MeasurementSummary;
} | null {
  const bundle = studyBundles[studyId];
  if (!bundle) return null;

  if (request.type === "focusFinding") {
    const finding = bundle.findings.find((item) => item.findingId === request.input.findingId);
    if (!finding) return null;
    bundle.actionLogs.unshift(createLog(studyId, "agent", "agent_focus_finding", `Agent focused ${finding.label}.`));
    return {
      message: `Agent focused ${finding.label}.`,
      commands: [
        { type: "selectFinding", findingId: finding.findingId },
        { type: "setSeries", seriesId: finding.linkedSeriesId },
        { type: "focusSection", section: finding.linkedReportSection },
      ],
    };
  }

  if (request.type === "draftReport") {
    const summaryText =
      request.input.scope === "impression"
        ? "Suspicious right upper lobe nodule. Recommend clinical correlation and follow-up."
        : bundle.findings.filter((item) => item.status !== "dismissed").map((item) => `- ${item.narrative}`).join("\n");

    bundle.actionLogs.unshift(createLog(studyId, "agent", "agent_draft_report", `Agent drafted ${request.input.scope}.`));
    return {
      message: `Agent drafted ${request.input.scope}.`,
      commands: [{ type: "insertText", section: request.input.scope, text: summaryText }],
    };
  }

  const measurement = bundle.measurements.find((item) => item.findingId === request.input.findingId);
  bundle.actionLogs.unshift(createLog(studyId, "agent", "agent_measurement_summary", "Agent summarized measurement."));
  return {
    message: measurement ? "Measurement summary ready." : "No measurement available.",
    commands: [],
    measurement,
  };
}

export function draftStructuredReport(input: ReportAssistInput): ReportAssistOutput {
  const noduleFinding = input.findings.find((item) => item.category === "Lung Nodule");
  const keyFinding = noduleFinding ?? input.findings[0];
  const matchedMeasurement = input.measurements.find((item) => item.findingId === keyFinding?.findingId);

  if (input.currentSection === "impression") {
    return {
      section: "impression",
      draftText: keyFinding
        ? `${keyFinding.label} remains the leading abnormality. ${matchedMeasurement ? `Measured about ${matchedMeasurement.longAxisMm} x ${matchedMeasurement.shortAxisMm} mm. ` : ""}Recommend correlation with clinical history and follow-up planning.`
        : "No dominant abnormality was provided in the current structured input.",
      evidenceUsed: [keyFinding?.findingId, matchedMeasurement?.measurementId, input.imageRefs[0]?.imageId].filter(
        Boolean,
      ) as string[],
      uncertainty: input.imageRefs.length === 0 ? "No representative image references were attached." : undefined,
    };
  }

  const findingLines = input.findings.length
    ? input.findings
        .filter((item) => item.status !== "dismissed")
        .map((item) => `- ${item.label}: ${item.narrative}`)
        .join("\n")
    : "- No explicit structured finding cards were attached.";

  return {
    section: "findings",
    draftText: findingLines,
    evidenceUsed: input.findings.map((item) => item.findingId),
    uncertainty: input.measurements.length === 0 ? "No measurement summaries were provided." : undefined,
  };
}

export function explainStructuredFinding(input: ExplainFindingInput): ExplainFindingOutput {
  return {
    findingId: input.findingId,
    explanation: `${input.finding.label} is linked to slice ${input.finding.linkedSliceIndex}. ${
      input.measurement
        ? `Current measurement is ${input.measurement.longAxisMm} x ${input.measurement.shortAxisMm} mm.`
        : "No measurement summary is attached."
    } Narrative: ${input.finding.narrative}`,
    evidenceUsed: [input.findingId, ...input.imageRefs.map((item) => item.imageId)],
    caution: input.imageRefs.length === 0 ? "This explanation was generated without image evidence references." : undefined,
  };
}

export function getEvalCases(): EvalCase[] {
  return clone(evalCases);
}

export function getEvalRunRecords(): EvalRunRecord[] {
  return clone(evalRunRecords);
}

function createLog(
  studyId: string,
  actor: ActionLogEntry["actor"],
  actionType: string,
  message: string,
): ActionLogEntry {
  return {
    logId: `${actionType}-${Date.now()}`,
    studyId,
    actor,
    actionType,
    message,
    createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
  };
}
