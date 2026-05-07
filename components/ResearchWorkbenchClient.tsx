"use client";

import { useMemo, useState } from "react";
import type {
  EvalCase,
  EvalRunRecord,
  ExplainFindingInput,
  ImageRef,
  ReportAssistInput,
  ReportAssistOutput,
} from "@/lib/domain";

type Props = {
  evalCases: EvalCase[];
  records: EvalRunRecord[];
};

type ReportDraftResponse = {
  provider: "local-model-service" | "mock-fallback";
  mode: "report-draft";
  fallbackUsed: boolean;
  errorMessage?: string;
  requestDurationMs: number;
  timeoutMs: number;
  serviceMode: string;
  output: ReportAssistOutput;
};

export function ResearchWorkbenchClient({ evalCases, records }: Props) {
  const [selectedEvalCaseId, setSelectedEvalCaseId] = useState(evalCases[0]?.evalCaseId ?? "");
  const [section, setSection] = useState<"findings" | "impression">(
    evalCases[0]?.input.currentSection ?? "findings",
  );
  const [draftResult, setDraftResult] = useState<ReportAssistOutput | null>(null);
  const [draftMeta, setDraftMeta] = useState<ReportDraftResponse | null>(null);
  const [draftError, setDraftError] = useState<string>("");
  const [imageError, setImageError] = useState<string>("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [explainResult, setExplainResult] = useState<string>("尚未执行 explain-finding。");

  const selectedCase = useMemo(
    () => evalCases.find((item) => item.evalCaseId === selectedEvalCaseId) ?? evalCases[0],
    [evalCases, selectedEvalCaseId],
  );

  const keyImage = selectedCase?.input.imageRefs[0];

  async function runDraft() {
    if (!selectedCase) return;

    const payload: ReportAssistInput = {
      ...selectedCase.input,
      currentSection: section,
    };

    setIsDrafting(true);
    setDraftError("");

    try {
      const res = await fetch("/api/ai/report-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`report-draft failed with HTTP ${res.status}`);
      }

      const data = (await res.json()) as ReportDraftResponse;
      setDraftResult(data.output);
      setDraftMeta(data);
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "report-draft request failed");
    } finally {
      setIsDrafting(false);
    }
  }

  async function runExplain() {
    if (!selectedCase || selectedCase.input.findings.length === 0) return;

    const finding = selectedCase.input.findings[0];
    const payload: ExplainFindingInput = {
      caseId: selectedCase.input.caseId,
      findingId: finding.findingId,
      imageRefs: selectedCase.input.imageRefs,
      finding,
      measurement: selectedCase.input.measurements.find((item) => item.findingId === finding.findingId),
    };

    const res = await fetch("/api/ai/explain-finding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { output: { explanation: string; caution?: string } };
    setExplainResult(
      data.output.caution ? `${data.output.explanation}\n注意: ${data.output.caution}` : data.output.explanation,
    );
  }

  function selectEvalCase(item: EvalCase) {
    setSelectedEvalCaseId(item.evalCaseId);
    setSection(item.input.currentSection);
    setDraftResult(null);
    setDraftMeta(null);
    setDraftError("");
    setImageError("");
  }

  if (!selectedCase) {
    return <div className="panel" style={{ padding: 20 }}>No eval cases configured yet.</div>;
  }

  return (
    <div className="stack">
      <section className="panel" style={{ padding: 20 }}>
        <div className="split-row">
          <div>
            <h2 className="section-title">AI Report Draft Minimal Demo</h2>
            <p className="section-note">
              研究页调用本地 base MedGemma service，展示 key image、Findings draft、耗时、service mode 和 gold-like target。
            </p>
          </div>
          <div className="badge-row">
            <span className="badge accent">ReportAssistInput</span>
            <span className="badge">ModelAdapter</span>
            <span className="badge">ReportAssistOutput</span>
          </div>
        </div>
      </section>

      <div className="grid-3">
        <section className="panel" style={{ padding: 16 }}>
          <h3 className="section-title">Fixed Eval Cases</h3>
          <p className="section-note">固定样例用于演示 base MedGemma 输出，并保留后续评估扩展空间。</p>
          <div className="stack" style={{ marginTop: 12 }}>
            {evalCases.map((item) => (
              <button
                key={item.evalCaseId}
                className={`series-item ${selectedEvalCaseId === item.evalCaseId ? "active" : ""}`}
                onClick={() => selectEvalCase(item)}
              >
                <strong>{item.title}</strong>
                <div className="tiny">{item.expectedFocus}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="panel" style={{ padding: 16 }}>
          <KeyImagePanel
            image={keyImage}
            imageError={imageError}
            onImageError={() => setImageError("Image failed to load from local proxy route.")}
          />

          <h3 className="section-title" style={{ marginTop: 16 }}>
            Structured Input
          </h3>
          <p className="section-note">这里展示会发送给本地 Python 模型服务的 payload。</p>
          <div className="toolbar" style={{ marginTop: 12 }}>
            <select value={section} onChange={(event) => setSection(event.target.value as "findings" | "impression")}>
              <option value="findings">findings</option>
              <option value="impression">impression</option>
            </select>
          </div>
          <div className="panel-soft" style={{ marginTop: 12, padding: 12 }}>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>
              {JSON.stringify({ ...selectedCase.input, currentSection: section }, null, 2)}
            </pre>
          </div>
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button className="button primary" onClick={() => void runDraft()} disabled={isDrafting}>
              {isDrafting ? "Generating..." : "POST /api/ai/report-draft"}
            </button>
            <button className="button ghost" onClick={() => void runExplain()}>
              POST /api/ai/explain-finding
            </button>
          </div>
          {draftError ? (
            <div className="badge danger" style={{ marginTop: 12 }}>
              {draftError}
            </div>
          ) : null}
        </section>

        <section className="stack">
          <section className="panel" style={{ padding: 16 }}>
            <div className="split-row">
              <div>
                <h3 className="section-title">Model Output</h3>
                <p className="section-note">这里显示 base service 返回的 Findings draft 和元信息。</p>
              </div>
              {draftMeta ? (
                <span className={`badge ${draftMeta.fallbackUsed ? "warn" : "accent"}`}>
                  {draftMeta.provider}
                </span>
              ) : null}
            </div>
            {draftMeta ? (
              <div className="panel-soft" style={{ marginTop: 12, padding: 12 }}>
                <div className="tiny">
                  Request duration: {draftMeta.requestDurationMs}ms / timeout: {draftMeta.timeoutMs}ms
                </div>
                <div className="tiny" style={{ marginTop: 6 }}>
                  Service mode: {draftMeta.serviceMode}
                </div>
                {draftMeta.errorMessage ? (
                  <div className="tiny" style={{ marginTop: 6 }}>
                    Fallback reason: {draftMeta.errorMessage}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="panel-soft" style={{ marginTop: 12, padding: 12 }}>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>
                {draftResult ? JSON.stringify(draftResult, null, 2) : "尚未执行 report-draft。"}
              </pre>
            </div>
            <div className="panel-soft" style={{ marginTop: 12, padding: 12 }}>
              <strong>Gold-like Target / Expected Target</strong>
              <pre style={{ margin: "10px 0 0", whiteSpace: "pre-wrap", fontSize: 12 }}>
                {selectedCase.goldDraft ?? selectedCase.expectedFocus}
              </pre>
            </div>
            <div className="panel-soft" style={{ marginTop: 12, padding: 12 }}>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>{explainResult}</pre>
            </div>
          </section>

          <section className="panel" style={{ padding: 16 }}>
            <h3 className="section-title">Eval Records</h3>
            <p className="section-note">最小评估记录先保留人工 note 和 1-5 分。</p>
            <div className="stack" style={{ marginTop: 12 }}>
              {records.map((item) => (
                <div key={item.runId} className="log-item">
                  <div className="split-row">
                    <strong>{item.modelLabel}</strong>
                    <span className="tiny">score {item.score}/5</span>
                  </div>
                  <div className="tiny" style={{ marginTop: 6 }}>
                    {item.promptLabel} / {item.section}
                  </div>
                  <div className="tiny" style={{ marginTop: 6 }}>{item.reviewerNote}</div>
                </div>
              ))}
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}

function KeyImagePanel({
  image,
  imageError,
  onImageError,
}: {
  image?: ImageRef;
  imageError: string;
  onImageError: () => void;
}) {
  if (!image) {
    return (
      <section>
        <h3 className="section-title">Key chest X-ray image</h3>
        <div className="panel-soft" style={{ marginTop: 12, padding: 12 }}>
          <div className="tiny">No key image is attached to this eval case.</div>
        </div>
      </section>
    );
  }

  const imageSrc = `/api/images/${encodeURIComponent(image.imageId)}`;

  return (
    <section>
      <h3 className="section-title">Key chest X-ray image</h3>
      <div className="panel-soft" style={{ marginTop: 12, padding: 12 }}>
        {imageError ? (
          <div className="tiny" style={{ lineHeight: 1.6 }}>
            {imageError}
            <br />
            imageId: {image.imageId}
            <br />
            uri: {image.uri}
          </div>
        ) : (
          <img
            key={image.imageId}
            src={imageSrc}
            alt="Key chest X-ray image"
            onError={onImageError}
            style={{
              width: "100%",
              maxHeight: 360,
              objectFit: "contain",
              display: "block",
              background: "#0f172a",
              borderRadius: 8,
            }}
          />
        )}
        <div className="tiny" style={{ marginTop: 8 }}>
          {image.note ?? image.uri}
        </div>
      </div>
    </section>
  );
}
