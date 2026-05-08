"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { CTMarkerOverlay } from "@/components/ct/CTMarkerOverlay";
import type { CTMarkerOverlayMarker } from "@/components/ct/CTMarkerOverlay";
import { CTStackViewer } from "@/components/ct/CTStackViewer";
import type {
  ActionLogEntry,
  Finding,
  ImageRef,
  MeasurementSummary,
  ReportAssistInput,
  ReportAssistOutput,
  ReportSectionKey,
  StudyBundle,
} from "@/lib/domain";

type ReportDraftResponse = {
  provider: "local-model-service" | "mock-fallback";
  serviceMode?: string;
  fallbackUsed: boolean;
  errorMessage?: string;
  requestDurationMs: number;
  timeoutMs: number;
  output: ReportAssistOutput;
};

function keyImageDisplayLabel(imageRef: ImageRef): string {
  if (imageRef.imageId.includes("upper")) return "Upper";
  if (imageRef.imageId.includes("middle")) return "Middle";
  if (imageRef.imageId.includes("lower")) return "Lower";

  return imageRef.imageId;
}

function findDefaultKeyImage(imageRefs: ImageRef[]): ImageRef | undefined {
  return imageRefs.find((item) => item.imageId.includes("middle")) ?? imageRefs[0];
}

function createLocalActionLog(
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

function estimateReportTextareaRows(text: string): number {
  const visualLineCount = text.split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 92)), 0);

  return Math.max(12, visualLineCount + 2);
}

function buildMarkerFromFinding(finding?: Finding): CTMarkerOverlayMarker | null {
  if (!finding?.marker) return null;

  return {
    ...finding.marker,
    status: finding.status,
    linkedSliceIndex: finding.linkedSliceIndex,
  };
}

function buildLocalReportAssistInput(
  bundle: StudyBundle,
  imageRefs: ImageRef[],
  currentSection: "findings" | "impression",
): ReportAssistInput {
  const includedFindings = bundle.findings.filter((finding) => {
    if (finding.status === "dismissed") return false;
    if (bundle.study.studyId === "study-lidc-002") return finding.status === "confirmed";
    return true;
  });
  const includedFindingIds = new Set(includedFindings.map((finding) => finding.findingId));

  return {
    caseId: `case-${bundle.study.studyId}`,
    studyId: bundle.study.studyId,
    imageRefs,
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
    measurements: bundle.measurements.filter((measurement) => includedFindingIds.has(measurement.findingId)),
    templateType: bundle.study.bodyPart === "Chest" ? "chest_ct" : "abdomen_ct",
    currentSection,
    priorSummary: bundle.study.historySummary,
    clinicalInfo: bundle.report.clinicalInfo.text,
  };
}

export function WorkstationClient({
  initialBundle,
  initialImageRefs = [],
}: {
  initialBundle: StudyBundle;
  initialImageRefs?: ImageRef[];
}) {
  const [bundle, setBundle] = useState(initialBundle);
  const [imageRefs] = useState(initialImageRefs);
  const [selectedFindingId, setSelectedFindingId] = useState<string | undefined>(initialBundle.findings[0]?.findingId);
  const [selectedImageId, setSelectedImageId] = useState<string | undefined>(
    () => findDefaultKeyImage(initialImageRefs)?.imageId,
  );
  const [currentSeriesId, setCurrentSeriesId] = useState<string>(initialBundle.series[0]?.seriesId ?? "");
  const [focusedSection, setFocusedSection] = useState<ReportSectionKey>("findings");
  const [agentMessage, setAgentMessage] = useState("Agent actions appear here.");
  const [aiInputPreview, setAiInputPreview] = useState<ReportAssistInput | null>(null);
  const [modelDraft, setModelDraft] = useState<ReportAssistOutput | null>(null);
  const [modelDraftMeta, setModelDraftMeta] = useState<ReportDraftResponse | null>(null);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [showFullTrace, setShowFullTrace] = useState(false);
  const [viewerMode, setViewerMode] = useState<"key-images" | "full-stack">("key-images");
  const [findingJumpNonce, setFindingJumpNonce] = useState(0);
  const centerWorkspaceRef = useRef<HTMLElement | null>(null);
  const [topWorkspaceHeight, setTopWorkspaceHeight] = useState<number | undefined>();

  const selectedFinding = useMemo(
    () => bundle.findings.find((item) => item.findingId === selectedFindingId),
    [bundle.findings, selectedFindingId],
  );
  const selectedFindingMarker = useMemo(
    () => buildMarkerFromFinding(selectedFinding),
    [selectedFinding],
  );

  const selectedMeasurement = useMemo<MeasurementSummary | undefined>(
    () => bundle.measurements.find((item) => item.findingId === selectedFindingId),
    [bundle.measurements, selectedFindingId],
  );

  const currentSeries = useMemo(
    () => bundle.series.find((item) => item.seriesId === currentSeriesId) ?? bundle.series[0],
    [bundle.series, currentSeriesId],
  );

  const confirmedFindings = useMemo(
    () => bundle.findings.filter((item) => item.status === "confirmed"),
    [bundle.findings],
  );

  const realKeyImages = useMemo(
    () => imageRefs.filter((item) => item.role === "key_image" && (item.format === "png" || item.format === "jpg")),
    [imageRefs],
  );

  const hasRealCtKeyImages = bundle.study.studyId === "study-lidc-002" && realKeyImages.length > 0;

  const selectedImage = useMemo(() => {
    if (!hasRealCtKeyImages) return undefined;

    return realKeyImages.find((item) => item.imageId === selectedImageId) ?? findDefaultKeyImage(realKeyImages);
  }, [hasRealCtKeyImages, realKeyImages, selectedImageId]);
  const keyImageMarkerVisible = Boolean(
    selectedFindingMarker &&
      selectedImage &&
      typeof selectedImage.sliceIndex === "number" &&
      selectedImage.sliceIndex === selectedFinding?.linkedSliceIndex,
  );
  const keyImageMarkerNote = selectedFinding
    ? selectedFindingMarker
      ? keyImageMarkerVisible
        ? "Mock marker overlay for workflow demonstration."
        : `Marker hidden: selected finding is linked to slice ${selectedFinding.linkedSliceIndex}.`
      : "No marker available for selected finding."
    : undefined;

  const draftReadinessMessage =
    confirmedFindings.length > 0
      ? "This drafts report text from current confirmed structured findings; it does not detect new findings."
      : "No confirmed finding is available for report drafting. Confirm a candidate first.";

  const selectedConfirmedFinding = selectedFinding?.status === "confirmed" ? selectedFinding : undefined;
  const selectedConfirmedMeasurement = selectedConfirmedFinding
    ? bundle.measurements.find((item) => item.findingId === selectedConfirmedFinding.findingId)
    : undefined;
  const aiDraftServiceLabel = modelDraftMeta?.serviceMode ?? modelDraftMeta?.provider ?? "not-run";
  const visibleActivityLogs = showFullTrace ? bundle.actionLogs : bundle.actionLogs.slice(0, 3);

  const dismissedFindingStillInFinalText = useMemo(() => {
    const finalText = bundle.report.findings.text.toLowerCase();

    return bundle.findings.some((finding) => {
      if (finding.status !== "dismissed") return false;
      return (
        finalText.includes(finding.label.toLowerCase()) ||
        finalText.includes(finding.narrative.toLowerCase())
      );
    });
  }, [bundle.findings, bundle.report.findings.text]);

  useEffect(() => {
    if (!hasRealCtKeyImages) return;
    if (viewerMode !== "key-images") return;

    const linkedImage = selectedFinding
      ? realKeyImages.find((item) => item.sliceIndex === selectedFinding.linkedSliceIndex)
      : undefined;
    const nextImage = linkedImage ?? findDefaultKeyImage(realKeyImages);

    if (nextImage) {
      setSelectedImageId(nextImage.imageId);
    }
  }, [hasRealCtKeyImages, realKeyImages, selectedFinding, viewerMode]);

  useEffect(() => {
    const centerElement = centerWorkspaceRef.current;
    if (!centerElement) return;

    const updateTopWorkspaceHeight = () => {
      const nextHeight = Math.ceil(centerElement.getBoundingClientRect().height);
      if (nextHeight > 0) setTopWorkspaceHeight(nextHeight);
    };

    updateTopWorkspaceHeight();

    const resizeObserver = new ResizeObserver(updateTopWorkspaceHeight);
    resizeObserver.observe(centerElement);
    window.addEventListener("resize", updateTopWorkspaceHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateTopWorkspaceHeight);
    };
  }, [selectedImageId, selectedFindingId, modelDraftMeta, aiInputPreview, bundle.report.findings.text, viewerMode]);

  async function refreshBundlePreservingReport() {
    const res = await fetch(`/api/studies/${bundle.study.studyId}`);
    const next = (await res.json()) as StudyBundle;
    setBundle((current) => ({
      ...next,
      report: current.report,
    }));
  }

  function appendLocalLog(actor: ActionLogEntry["actor"], actionType: string, message: string) {
    setBundle((current) => ({
      ...current,
      actionLogs: [createLocalActionLog(current.study.studyId, actor, actionType, message), ...current.actionLogs],
    }));
  }

  function focusFinding(findingId: string) {
    const finding = bundle.findings.find((item) => item.findingId === findingId);
    if (!finding) return;

    setSelectedFindingId(findingId);
    setCurrentSeriesId(finding.linkedSeriesId);
    setFocusedSection(finding.linkedReportSection);
    setFindingJumpNonce((value) => value + 1);

    if (viewerMode === "key-images" && hasRealCtKeyImages) {
      const linkedImage = realKeyImages.find((item) => item.sliceIndex === finding.linkedSliceIndex);
      if (linkedImage) setSelectedImageId(linkedImage.imageId);
    }
  }

  async function loadAiInputPreview(section: "findings" | "impression") {
    setAiInputPreview(buildLocalReportAssistInput(bundle, imageRefs, section));
  }

  async function generateDraftWithModelAdapter(section: "findings" | "impression") {
    if (confirmedFindings.length === 0) {
      setAgentMessage("No confirmed finding is available for report drafting. Confirm a candidate first.");
      return;
    }

    setIsGeneratingDraft(true);
    setModelDraft(null);
    setModelDraftMeta(null);

    try {
      const input = buildLocalReportAssistInput(bundle, imageRefs, section);
      setAiInputPreview(input);

      const draftRes = await fetch("/api/ai/report-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const data = (await draftRes.json()) as ReportDraftResponse;
      setModelDraft(data.output);
      setModelDraftMeta(data);
      setFocusedSection(data.output.section);
      appendLocalLog("agent", "generate_draft", "Generated findings draft from confirmed CT findings and measurements.");
    } finally {
      setIsGeneratingDraft(false);
    }
  }

  async function updateFindingStatus(findingId: string, status: "confirmed" | "dismissed") {
    const finding = bundle.findings.find((item) => item.findingId === findingId);
    const res = await fetch(
      `/api/studies/${bundle.study.studyId}/findings/${findingId}/${status === "confirmed" ? "confirm" : "dismiss"}`,
      { method: "POST" },
    );
    const data = (await res.json()) as Pick<StudyBundle, "findings" | "workflow">;

    setBundle((current) => ({
      ...current,
      findings: data.findings,
      workflow: data.workflow,
      actionLogs: [
        createLocalActionLog(
          current.study.studyId,
          "user",
          status === "confirmed" ? "confirm_finding" : "dismiss_finding",
          status === "confirmed"
            ? `Confirmed ${finding?.label ?? "selected finding"} for report drafting.`
            : `Dismissed ${finding?.label ?? "selected finding"}; it will be excluded from report drafting.`,
        ),
        ...current.actionLogs,
      ],
    }));

    if (status === "dismissed") {
      setModelDraft(null);
      setModelDraftMeta(null);
    }

    focusFinding(findingId);
  }

  function applyDraftToFindings() {
    if (!modelDraft) return;

    setBundle((current) => ({
      ...current,
      report: {
        ...current.report,
        findings: {
          ...current.report.findings,
          text: modelDraft.draftText,
          linkedFindingIds: Array.from(new Set([...current.report.findings.linkedFindingIds, ...modelDraft.evidenceUsed])),
        },
      },
    }));
    setFocusedSection("findings");
    appendLocalLog("user", "apply_draft_to_findings", "Applied generated draft preview to the final Findings text.");
  }

  async function patchSection(section: ReportSectionKey, text: string) {
    const res = await fetch(`/api/studies/${bundle.study.studyId}/report`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, text }),
    });
    const data = (await res.json()) as { report: StudyBundle["report"] };

    setBundle((current) => ({
      ...current,
      report: data.report,
      actionLogs:
          section === "findings"
          ? [
              createLocalActionLog(current.study.studyId, "user", "save_findings", "Saved Findings section."),
              ...current.actionLogs,
            ]
          : current.actionLogs,
    }));
  }

  async function runAgentAction(type: "focusFinding" | "draftReport" | "getMeasurementSummary") {
    const res = await fetch(`/api/studies/${bundle.study.studyId}/agent/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        type === "focusFinding"
          ? { type, input: { findingId: selectedFindingId } }
          : type === "getMeasurementSummary"
            ? { type, input: { findingId: selectedFindingId } }
            : { type, input: { scope: focusedSection === "impression" ? "impression" : "findings" } },
      ),
    });

    const data = (await res.json()) as {
      message: string;
      commands: Array<Record<string, string>>;
      measurement?: { longAxisMm: number; shortAxisMm: number; notes: string };
    };

    setAgentMessage(
      data.measurement
        ? `${data.message} ${data.measurement.longAxisMm} x ${data.measurement.shortAxisMm} mm. ${data.measurement.notes}`
        : data.message,
    );

    for (const command of data.commands) {
      if (command.type === "selectFinding" && command.findingId) setSelectedFindingId(command.findingId);
      if (command.type === "setSeries" && command.seriesId) setCurrentSeriesId(command.seriesId);
      if (command.type === "focusSection" && command.section) setFocusedSection(command.section as ReportSectionKey);
      if (command.type === "insertText" && command.section && command.text) {
        await patchSection(command.section as ReportSectionKey, command.text);
      }
    }

    await refreshBundlePreservingReport();
  }

  return (
    <div className="stack">
      <section className="panel" style={{ padding: 18 }}>
        <div className="split-row">
          <div>
            <h2 className="section-title">Workstation / Reading Workspace</h2>
            <p className="section-note">
              CT viewer evidence, structured AI candidate findings, report drafting, and action trace share one study context.
            </p>
          </div>
          <div className="badge-row">
            <span className="badge accent">{bundle.workflow.studyStatus}</span>
            <span className="badge">{bundle.workflow.reportStatus}</span>
            <Link className="button ghost" href={`/reports/${bundle.study.studyId}`}>Open Full Report Page</Link>
          </div>
        </div>
      </section>

      <div className="workstation-layout">
        <section
          className="top-workspace-grid"
          style={topWorkspaceHeight ? ({ "--top-workspace-height": `${topWorkspaceHeight}px` } as CSSProperties) : undefined}
        >
        <aside className="left-rail">
          <div className="left-rail-inner">
          <section className="panel" style={{ padding: 16 }}>
            <h3 className="section-title">Case Context</h3>
            <div className="stack" style={{ marginTop: 12 }}>
              <div className="panel-soft" style={{ padding: 12 }}>
                <div className="tiny">Study</div>
                <strong>{bundle.study.patient.patientName}</strong>
                <div className="tiny" style={{ marginTop: 6 }}>{bundle.study.description}</div>
                <div className="tiny" style={{ marginTop: 6 }}>{bundle.study.historySummary}</div>
                <div className="badge-row" style={{ marginTop: 10 }}>
                  <span className="badge">{bundle.study.modality}</span>
                  <span className="badge">{bundle.study.bodyPart}</span>
                  <span className="badge accent">{bundle.study.studyStatus}</span>
                  <span className="badge">{bundle.study.reportStatus}</span>
                </div>
              </div>

              <div className="panel-soft" style={{ padding: 12 }}>
                <div className="tiny">Active Series</div>
                <strong>{currentSeries?.description ?? "No active series"}</strong>
                <div className="tiny" style={{ marginTop: 6 }}>
                  1.25 mm / {currentSeries?.sliceCount ?? "-"} slices / preset {currentSeries?.viewportPreset ?? "-"}
                </div>
              </div>

              <div className="panel-soft" style={{ padding: 12 }}>
                <div className="tiny">Selected Finding</div>
                {selectedFinding ? (
                  <div className="tiny" style={{ lineHeight: 1.7, marginTop: 6 }}>
                    <strong style={{ color: "var(--text)" }}>{selectedFinding.label}</strong>
                    <br />
                    Status: {selectedFinding.status}
                    <br />
                    Size: {selectedFinding.sizeText}
                    <br />
                    Slice: {selectedFinding.linkedSliceIndex}
                    <br />
                    Measurement: {selectedMeasurement ? `${selectedMeasurement.longAxisMm} x ${selectedMeasurement.shortAxisMm} mm, mean HU ${selectedMeasurement.meanHU ?? "-"}` : "none"}
                  </div>
                ) : (
                  <div className="tiny" style={{ marginTop: 6 }}>No finding selected.</div>
                )}
              </div>
            </div>
          </section>

          <section className="panel" style={{ padding: 16 }}>
            <div className="split-row">
              <h3 className="section-title">Recent Activity</h3>
              <button className="link-button" onClick={() => setShowFullTrace((value) => !value)}>
                {showFullTrace ? "Show less" : "Show full trace"}
              </button>
            </div>
            <div className="stack recent-activity-list" style={{ marginTop: 12 }}>
              {visibleActivityLogs.map((item) => (
                <div key={item.logId} className="log-item">
                  <div className="split-row">
                    <strong>{item.actionType}</strong>
                  </div>
                  <div className="tiny" style={{ marginTop: 6 }}>{item.actor} / {item.message}</div>
                </div>
              ))}
            </div>
          </section>
          </div>
        </aside>

        <main ref={centerWorkspaceRef} className="center-workspace stack">
        <section className="viewer-area">
          <section className="panel viewer">
            <div className="split-row">
              <div>
                <h3 className="section-title" style={{ color: "#f8fafc" }}>Viewer Workspace</h3>
                <p className="section-note" style={{ color: "rgba(248,250,252,0.78)" }}>
                  {viewerMode === "full-stack"
                    ? "Full CT stack preview using local DICOM image API. Key image workflow remains the default for report drafting."
                    : hasRealCtKeyImages
                      ? "Real LIDC CT lung-window key images from DICOM preprocessing."
                      : "Mock CT viewport. It can later be replaced by a viewer adapter."}
                </p>
              </div>
              <div className="badge-row">
                <span className="badge">Series: {currentSeriesId}</span>
                <span className="badge accent">
                  {viewerMode === "full-stack" ? "Full Stack beta" : `Slice: ${selectedImage?.sliceIndex ?? selectedFinding?.linkedSliceIndex ?? "-"}`}
                </span>
              </div>
            </div>

            <div className="viewer-mode-toggle">
              <button
                className={`button ${viewerMode === "key-images" ? "primary" : "ghost"}`}
                onClick={() => setViewerMode("key-images")}
              >
                Key Images
              </button>
              <button
                className={`button ${viewerMode === "full-stack" ? "primary" : "ghost"}`}
                onClick={() => setViewerMode("full-stack")}
              >
                Full Stack beta
              </button>
            </div>

            {viewerMode === "full-stack" ? (
              <div className="stack" style={{ marginTop: 14 }}>
                <CTStackViewer
                  caseId="lidc_case_002"
                  compact
                  height="420px"
                  initialStackIndex={130}
                  marker={selectedFinding ? selectedFindingMarker : undefined}
                  showMetadata={false}
                  targetSliceIndex={selectedFinding?.linkedSliceIndex}
                  targetSliceKey={selectedFindingId ? `${selectedFindingId}:${findingJumpNonce}` : undefined}
                  targetSliceMode="instanceNumber"
                />
              </div>
            ) : hasRealCtKeyImages && selectedImage ? (
              <div className="stack" style={{ marginTop: 16 }}>
                <div className="split-row">
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{keyImageDisplayLabel(selectedImage)} lung key image</div>
                    <div className="tiny" style={{ color: "rgba(248,250,252,0.82)", marginTop: 6 }}>
                      {selectedImage.imageId} / sliceIndex {selectedImage.sliceIndex ?? "-"}
                    </div>
                    <div className="tiny" style={{ color: "rgba(248,250,252,0.82)", marginTop: 4 }}>
                      {selectedImage.note}
                    </div>
                  </div>
                  <div className="badge-row">
                    {realKeyImages.map((imageRef) => (
                      <button
                        key={imageRef.imageId}
                        className={`button ${selectedImage.imageId === imageRef.imageId ? "primary" : "ghost"}`}
                        onClick={() => setSelectedImageId(imageRef.imageId)}
                      >
                        {keyImageDisplayLabel(imageRef)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="key-image-frame">
                  <img
                    className="viewer-image"
                    src={`/api/images/${encodeURIComponent(selectedImage.imageId)}`}
                    alt={`${keyImageDisplayLabel(selectedImage)} lung-window CT key image`}
                  />
                  <CTMarkerOverlay
                    marker={selectedFindingMarker}
                    note={keyImageMarkerNote}
                    visible={keyImageMarkerVisible}
                  />
                </div>
              </div>
            ) : (
              <div className="viewer-stage">
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>Mock CT Viewport</div>
                  <div className="tiny" style={{ color: "rgba(248,250,252,0.8)", marginTop: 8 }}>Series: {currentSeriesId}</div>
                  <div className="tiny" style={{ color: "rgba(248,250,252,0.8)" }}>Finding: {selectedFinding?.label ?? "none"}</div>
                  <div className="tiny" style={{ color: "rgba(248,250,252,0.8)" }}>Slice: {selectedFinding?.linkedSliceIndex ?? "-"}</div>
                </div>
              </div>
            )}
          </section>
        </section>

        <section className="ai-draft-area">
          <section className="panel" style={{ padding: 16 }}>
            <div className="split-row">
              <div>
                <h3 className="section-title">AI Draft Assist</h3>
                <p className="section-note">{draftReadinessMessage}</p>
              </div>
              <span className={`badge ${modelDraftMeta?.fallbackUsed ? "warn" : "accent"}`}>{aiDraftServiceLabel}</span>
            </div>
            <div className="panel-soft" style={{ marginTop: 12, padding: 12 }}>
              <div className="badge-row">
                <span className="badge">confirmed findings: {confirmedFindings.length}</span>
                <span className="badge">draft section: findings</span>
                <span className="badge">evidence images: {imageRefs.length}</span>
                <span className="badge">linked slice: {selectedConfirmedFinding?.linkedSliceIndex ?? "-"}</span>
              </div>
              <div className="tiny" style={{ marginTop: 10 }}>
                Measurement: {selectedConfirmedMeasurement ? `${selectedConfirmedMeasurement.longAxisMm} x ${selectedConfirmedMeasurement.shortAxisMm} mm, mean HU ${selectedConfirmedMeasurement.meanHU ?? "-"}` : "No confirmed finding measurement selected."}
              </div>
              <div className="tiny" style={{ marginTop: 6 }}>
                Generate and review draft text inside Report Workspace / Findings.
              </div>
            </div>
            <details className="panel-soft" style={{ marginTop: 12, padding: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>Developer payload / debug</summary>
              <div className="toolbar" style={{ marginTop: 12 }}>
                <button className="button" onClick={() => void loadAiInputPreview("findings")}>Preview findings input</button>
                <button className="button ghost" onClick={() => void loadAiInputPreview("impression")}>Preview impression input</button>
                <Link className="button ghost" href="/research">Open CXR Research Page</Link>
              </div>
              {modelDraftMeta ? (
                <div className="panel-soft" style={{ marginTop: 12, padding: 12 }}>
                  <div className="tiny">Request duration: {modelDraftMeta.requestDurationMs}ms</div>
                  <div className="tiny">serviceMode: {modelDraftMeta.serviceMode ?? "unknown"}</div>
                  <div className="tiny">fallbackUsed: {modelDraftMeta.fallbackUsed ? "yes" : "no"}</div>
                  <div className="tiny">timeout: {modelDraftMeta.timeoutMs}ms</div>
                  {modelDraftMeta.errorMessage ? <div className="tiny">Fallback reason: {modelDraftMeta.errorMessage}</div> : null}
                </div>
              ) : null}
              <div className="panel-soft" style={{ marginTop: 12, padding: 12 }}>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>
                  {aiInputPreview ? JSON.stringify(aiInputPreview, null, 2) : "Click Preview to inspect ReportAssistInput."}
                </pre>
              </div>
            </details>
          </section>
        </section>
        </main>

        <aside className="right-rail">
          <div className="right-rail-inner">
          <section className="panel" style={{ padding: 16 }}>
            <h3 className="section-title">Findings Panel</h3>
            <p className="section-note">
              AI candidates are structured findings for review. They are not report text until drafted or applied.
            </p>
            <div className="stack findings-panel-list" style={{ marginTop: 12 }}>
              {bundle.findings.map((item) => (
                <div key={item.findingId} className={`finding-card finding-card-compact ${selectedFindingId === item.findingId ? "active" : ""}`}>
                  <button className="link-button" onClick={() => focusFinding(item.findingId)}><strong>{item.label}</strong></button>
                  <div className="tiny" style={{ marginTop: 6 }}>{item.category} / {item.sizeText} / risk {item.riskLevel} / conf {item.confidence}</div>
                  <div className="tiny" style={{ marginTop: 6 }}>{item.narrative}</div>
                  <div className="tiny" style={{ marginTop: 6 }}>
                    AI candidate finding. It is not generated by the report draft button.
                  </div>
                  <div className="badge-row" style={{ marginTop: 8 }}>
                    <span className={`badge ${item.status === "dismissed" ? "danger" : item.status === "confirmed" ? "accent" : "warn"}`}>{item.status}</span>
                    <button className="button" onClick={() => void updateFindingStatus(item.findingId, "confirmed")}>Confirm</button>
                    <button className="button ghost" onClick={() => void updateFindingStatus(item.findingId, "dismissed")}>Dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel" style={{ padding: 16 }}>
            <h3 className="section-title">Agent Action Panel</h3>
            <p className="section-note">Action orchestration is kept separate from model text generation.</p>
            <div className="toolbar" style={{ marginTop: 12 }}>
              <button className="button" onClick={() => void runAgentAction("focusFinding")}>focusFinding</button>
              <button className="button" onClick={() => void runAgentAction("draftReport")}>draftReport</button>
              <button className="button" onClick={() => void runAgentAction("getMeasurementSummary")}>getMeasurementSummary</button>
            </div>
            <div className="panel-soft" style={{ marginTop: 12, padding: 12 }}>
              <div className="tiny">{agentMessage}</div>
            </div>
          </section>
          </div>
        </aside>
        </section>

        <section className="panel report-workspace-full">
          <div className="split-row">
            <div>
              <h3 className="section-title">Report Workspace</h3>
              <p className="section-note">
                Structured findings, draft preview, and final report text are separate workflow layers.
              </p>
            </div>
            <span className="badge">wide authoring</span>
          </div>

          <div className="report-workspace-inner">
            <div className={`report-section report-authoring ${focusedSection === "findings" ? "active" : ""}`}>
              <button className="link-button" onClick={() => setFocusedSection("findings")}><strong>Findings Authoring</strong></button>
              <div className="tiny">Final report findings are saved only when you click Save Findings.</div>

              <div className="report-authoring-grid">
                <div className="panel-soft stack compact-panel">
                  <div>
                    <h4 className="section-title">Confirmed Structured Findings</h4>
                    <p className="section-note">
                      Reviewed finding objects that may be used as report-draft inputs. These are not final report text.
                    </p>
                  </div>
                  {confirmedFindings.length > 0 ? (
                    confirmedFindings.map((finding) => {
                      const measurement = bundle.measurements.find((item) => item.findingId === finding.findingId);

                      return (
                        <div key={finding.findingId} className="finding-card finding-card-compact">
                          <div className="split-row">
                            <strong>{finding.label}</strong>
                            <span className="badge accent">confirmed</span>
                          </div>
                          <div className="tiny" style={{ marginTop: 6 }}>
                            {finding.sizeText} / confidence {finding.confidence} / slice {finding.linkedSliceIndex}
                          </div>
                          <div className="tiny" style={{ marginTop: 6 }}>
                            Measurement: {measurement ? `${measurement.longAxisMm} x ${measurement.shortAxisMm} mm, meanHU ${measurement.meanHU ?? "-"}` : "none"}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="tiny">No confirmed findings yet. Confirm a candidate before drafting report text.</div>
                  )}
                </div>

                <div className="panel-soft stack compact-panel">
                  <div>
                    <h4 className="section-title">Draft Preview</h4>
                    <p className="section-note">Generated draft preview. Review before applying to the final report.</p>
                  </div>
                  <button
                    className="button primary"
                    onClick={() => void generateDraftWithModelAdapter("findings")}
                    disabled={isGeneratingDraft || confirmedFindings.length === 0}
                  >
                    {isGeneratingDraft ? "Generating..." : "Generate Draft from Confirmed Findings"}
                  </button>
                  {modelDraft ? (
                    <>
                      <div className="badge-row">
                        <span className="badge accent">section: {modelDraft.section}</span>
                        <span className={`badge ${modelDraftMeta?.fallbackUsed ? "warn" : "accent"}`}>
                          fallback: {modelDraftMeta?.fallbackUsed ? "yes" : "no"}
                        </span>
                        <span className="badge">service: {modelDraftMeta?.serviceMode ?? modelDraftMeta?.provider ?? "unknown"}</span>
                      </div>
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>{modelDraft.draftText}</pre>
                      <div>
                        <strong>evidenceUsed</strong>
                        <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", fontSize: 12 }}>
                          {JSON.stringify(modelDraft.evidenceUsed, null, 2)}
                        </pre>
                      </div>
                      <button className="button primary" onClick={applyDraftToFindings}>
                        Apply Draft to Final Findings
                      </button>
                    </>
                  ) : (
                    <div className="tiny">No draft preview yet. Generate a draft after confirming at least one finding.</div>
                  )}
                </div>
              </div>

              <div className="panel-soft stack compact-panel">
                <div>
                  <h4 className="section-title">Final Findings Text</h4>
                  <p className="section-note">This textarea is the final report section. Apply a draft or write manually.</p>
                </div>
                {dismissedFindingStillInFinalText ? (
                  <div className="badge warn">
                    Final report text may still contain a dismissed finding. Review before saving.
                  </div>
                ) : null}
                <textarea
                  className="editor final-findings-editor"
                  rows={estimateReportTextareaRows(bundle.report.findings.text)}
                  placeholder="Final report findings text. Apply a draft or write manually after confirming findings."
                  value={bundle.report.findings.text}
                  onChange={(event) => {
                    setBundle({
                      ...bundle,
                      report: {
                        ...bundle.report,
                        findings: { ...bundle.report.findings, text: event.target.value },
                      },
                    });
                  }}
                />
                <button className="button ghost" onClick={() => void patchSection("findings", bundle.report.findings.text)}>
                  Save Findings
                </button>
              </div>
            </div>

            <div className="report-metadata stack">
              <h4 className="section-title">Report Metadata</h4>
              {(["clinicalInfo", "technique", "impression"] as ReportSectionKey[]).map((sectionKey) => {
                const section = bundle.report[sectionKey];
                return (
                  <div key={sectionKey} className={`report-section ${focusedSection === sectionKey ? "active" : ""}`}>
                    <button className="link-button" onClick={() => setFocusedSection(sectionKey)}><strong>{section.title}</strong></button>
                    <div className="tiny">Focused section: {focusedSection === sectionKey ? "yes" : "no"}</div>
                    <textarea
                      className="editor metadata-editor"
                      value={section.text}
                      onChange={(event) => {
                        const nextReport = { ...bundle.report, [sectionKey]: { ...section, text: event.target.value } };
                        setBundle({ ...bundle, report: nextReport });
                      }}
                    />
                    <button className="button ghost" onClick={() => void patchSection(sectionKey, section.text)}>Save {section.title}</button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
