import type { ReportAssistInput, ReportAssistOutput } from "@/lib/domain";
import { draftStructuredReport } from "@/lib/mock/repository";

export type ReportDraftAdapterResult = {
  provider: "local-model-service" | "mock-fallback";
  mode: "report-draft";
  output: ReportAssistOutput;
  fallbackUsed: boolean;
  errorMessage?: string;
  requestDurationMs: number;
  timeoutMs: number;
  serviceMode: string;
};

type RawModelResponse = Partial<ReportAssistOutput> & {
  output?: Partial<ReportAssistOutput>;
  serviceMode?: string;
};

type LocalModelServiceResult = {
  output: ReportAssistOutput;
  serviceMode: string;
};

const DEFAULT_MODEL_ENDPOINT = "http://localhost:8000/report-draft";
const DEFAULT_TIMEOUT_MS = 180000;

export async function draftReportWithModelAdapter(
  input: ReportAssistInput,
): Promise<ReportDraftAdapterResult> {
  const endpoint = process.env.REPORT_DRAFT_MODEL_URL ?? DEFAULT_MODEL_ENDPOINT;
  const enabled = process.env.MODEL_ADAPTER_ENABLED !== "false";
  const timeoutMs = getTimeoutMs();
  const startedAt = Date.now();

  if (!enabled) {
    return mockFallback(input, "Model adapter disabled by MODEL_ADAPTER_ENABLED=false.", startedAt, timeoutMs);
  }

  try {
    const result = await callLocalModelService(endpoint, input, timeoutMs);

    return {
      provider: "local-model-service",
      mode: "report-draft",
      output: result.output,
      fallbackUsed: false,
      requestDurationMs: Date.now() - startedAt,
      timeoutMs,
      serviceMode: result.serviceMode,
    };
  } catch (error) {
    return mockFallback(input, toErrorMessage(error, timeoutMs), startedAt, timeoutMs);
  }
}

async function callLocalModelService(
  endpoint: string,
  input: ReportAssistInput,
  timeoutMs: number,
): Promise<LocalModelServiceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Model service returned HTTP ${response.status}.`);
    }

    const raw = (await response.json()) as RawModelResponse;
    return {
      output: normalizeModelOutput(raw, input),
      serviceMode: typeof raw.serviceMode === "string" ? raw.serviceMode : "unknown",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeModelOutput(
  raw: RawModelResponse,
  input: ReportAssistInput,
): ReportAssistOutput {
  const candidate = raw.output ?? raw;

  if (typeof candidate.draftText !== "string" || candidate.draftText.trim().length === 0) {
    throw new Error("Model service response is missing draftText.");
  }

  return {
    section: input.currentSection,
    draftText: candidate.draftText,
    evidenceUsed: Array.isArray(candidate.evidenceUsed) ? candidate.evidenceUsed : [],
    uncertainty: typeof candidate.uncertainty === "string" ? candidate.uncertainty : undefined,
  };
}

function mockFallback(
  input: ReportAssistInput,
  errorMessage: string,
  startedAt: number,
  timeoutMs: number,
): ReportDraftAdapterResult {
  return {
    provider: "mock-fallback",
    mode: "report-draft",
    output: draftStructuredReport(input),
    fallbackUsed: true,
    errorMessage,
    requestDurationMs: Date.now() - startedAt,
    timeoutMs,
    serviceMode: "next-mock-fallback",
  };
}

function toErrorMessage(error: unknown, timeoutMs: number): string {
  if (error instanceof Error) {
    return error.name === "AbortError"
      ? `Model service request timed out after ${timeoutMs}ms.`
      : error.message;
  }

  return "Model service request failed.";
}

function getTimeoutMs(): number {
  const raw = Number(process.env.MODEL_ADAPTER_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}
