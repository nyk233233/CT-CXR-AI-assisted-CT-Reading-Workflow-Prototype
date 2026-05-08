export type ID = string;

export type Modality = "CT" | "US";
export type StudyStatus =
  | "scheduled"
  | "acquired"
  | "reading"
  | "drafted"
  | "reviewed"
  | "finalized";
export type ReportStatus =
  | "empty"
  | "draft"
  | "pending_review"
  | "signed"
  | "published";
export type FindingStatus = "detected" | "confirmed" | "dismissed";
export type ReportSectionKey =
  | "clinicalInfo"
  | "technique"
  | "findings"
  | "impression";

export interface PatientRef {
  patientId: ID;
  patientName: string;
  sex: "M" | "F";
  age: number;
}

export interface Study {
  studyId: ID;
  patient: PatientRef;
  modality: Modality;
  studyDate: string;
  description: string;
  bodyPart: string;
  priority: "routine" | "urgent" | "stat";
  studyStatus: StudyStatus;
  reportStatus: ReportStatus;
  tags: string[];
  seriesCount: number;
  findingCount: number;
  unread: boolean;
  historySummary: string;
}

export interface Series {
  seriesId: ID;
  studyId: ID;
  description: string;
  seriesNumber: number;
  sliceCount: number;
  viewportPreset: "lung" | "mediastinal" | "softTissue";
}

export interface MeasurementSummary {
  measurementId: ID;
  findingId: ID;
  longAxisMm: number;
  shortAxisMm: number;
  areaMm2?: number;
  volumeMm3?: number;
  meanHU?: number;
  notes: string;
}

export type FindingMarkerShape = "crosshair" | "circle" | "box";

export interface FindingMarker {
  x: number;
  y: number;
  radius?: number;
  shape?: FindingMarkerShape;
  label?: string;
}

export interface Finding {
  findingId: ID;
  studyId: ID;
  label: string;
  category: string;
  source: "ai" | "manual";
  status: FindingStatus;
  linkedSeriesId: ID;
  linkedSliceIndex: number;
  sizeText: string;
  riskLevel: "low" | "medium" | "high";
  confidence: number;
  linkedReportSection: ReportSectionKey;
  narrative: string;
  features: string[];
  marker?: FindingMarker;
}

export interface ReportSection {
  key: ReportSectionKey;
  title: string;
  text: string;
  linkedFindingIds: ID[];
}

export interface ReportDraft {
  reportId: ID;
  studyId: ID;
  reportStatus: ReportStatus;
  clinicalInfo: ReportSection;
  technique: ReportSection;
  findings: ReportSection;
  impression: ReportSection;
}

export interface WorkflowState {
  studyId: ID;
  studyStatus: StudyStatus;
  reportStatus: ReportStatus;
  allowedActions: string[];
}

export interface ActionLogEntry {
  logId: ID;
  studyId: ID;
  actor: "user" | "agent" | "system";
  actionType: string;
  message: string;
  createdAt: string;
}

export interface StudyBundle {
  study: Study;
  series: Series[];
  findings: Finding[];
  measurements: MeasurementSummary[];
  report: ReportDraft;
  workflow: WorkflowState;
  actionLogs: ActionLogEntry[];
}

export type ImageInputFormat = "png" | "jpg" | "dicom-instance-ref" | "dicom-series-key-image";
export type ReportTemplateType = "chest_ct" | "pet_ct" | "abdomen_ct" | "chest_xray_research";

export interface ImageRef {
  imageId: ID;
  studyId: ID;
  seriesId?: ID;
  instanceId?: ID;
  sliceIndex?: number;
  format: ImageInputFormat;
  uri: string;
  role: "key_image" | "roi_evidence" | "overview";
  note?: string;
}

export interface FindingCardInput {
  findingId: ID;
  label: string;
  category: string;
  status: FindingStatus;
  source: "ai" | "manual";
  narrative: string;
  sizeText?: string;
  riskLevel?: "low" | "medium" | "high";
  confidence?: number;
  linkedSeriesId: ID;
  linkedSliceIndex: number;
}

export interface ReportAssistInput {
  caseId: ID;
  studyId: ID;
  imageRefs: ImageRef[];
  findings: FindingCardInput[];
  measurements: MeasurementSummary[];
  templateType: ReportTemplateType;
  currentSection: "findings" | "impression";
  priorSummary?: string;
  clinicalInfo?: string;
}

export interface ReportAssistOutput {
  section: "findings" | "impression";
  draftText: string;
  evidenceUsed: string[];
  uncertainty?: string;
}

export interface ExplainFindingInput {
  caseId: ID;
  findingId: ID;
  imageRefs: ImageRef[];
  finding: FindingCardInput;
  measurement?: MeasurementSummary;
}

export interface ExplainFindingOutput {
  findingId: ID;
  explanation: string;
  evidenceUsed: string[];
  caution?: string;
}

export interface EvalCase {
  evalCaseId: ID;
  title: string;
  studyId: ID;
  input: ReportAssistInput;
  expectedFocus: string;
  goldDraft?: string;
}

export interface EvalRunRecord {
  runId: ID;
  evalCaseId: ID;
  modelLabel: string;
  promptLabel: string;
  section: "findings" | "impression";
  output: ReportAssistOutput;
  reviewerNote: string;
  score: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
}
