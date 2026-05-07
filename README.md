# AI Radiology Workstation

教学导向的最小版影像工作站原型：工作站（CT）+ 研究页（胸片/CXR 真实模型接入）。

## 当前版本做了什么

- `worklist` 作为任务入口
- `workstation/[studyId]` 作为读片主页面
- `reports/[studyId]` 作为报告深编辑页
- mock `findings / report / workflow / action log`
- 非聊天式 `agent action panel`
- `research` 页面作为模型接入前的研究工作台（含胸片/CXR 固定 eval case + key image 展示）
- 真实本地模型服务脚本：`serve_report_draft.py`（WSL 下运行，提供 `POST /report-draft`）
- `GET /api/images/[imageId]`：把 eval case 里的 `file:///mnt/...` 图片 URI 映射为 Windows 本地盘符并代理输出给前端预览

## 为什么先做成这样

这版优先讲清楚工作站骨架和区域职责：

- 左侧是 `Study Browser / Series List`
- 中间是 `Viewer Workspace`
- 右侧上半是 `Findings Panel`
- 右侧下半是 `Report Workspace`
- 中下部是 `Action Log`

现在又额外补上了一层“模型接入前准备层”：

- 固定结构化输入
- 固定结构化输出
- 固定 AI API 边界
- 固定评估样例和评估记录
- 统一 `ModelAdapter`（`lib/ai/modelAdapter.ts`），优先调用本地 Python 模型服务，失败时回退到 mock

这样以后换成你自己微调的 Hulu-Med、MedGemma、M3D-LaMed 之类模型时，前端和工作站主流程不用推倒重来。

## 你现在最应该先学什么

如果你的目标是“自己轻量微调开源医疗多模态模型来辅助结构化报告”，优先级建议是：

1. 先学模型输入输出边界，不是先学 viewer
2. 先学结构化报告对象，不是先学聊天式交互
3. 先学图像引用与证据组织，不是先学大而全的 DICOM 系统
4. 先学评估样例和日志，不是先凭感觉判断模型好坏

一句话概括：

你现在最该掌握的是“工作站如何把病例整理成模型可吃的 payload，以及模型输出如何回落到结构化报告里”。

## 推荐学习顺序

### 第 1 层：先理解模型会吃什么

先看：

- [lib/domain/index.ts](C:\Users\21258\Documents\New project\lib\domain\index.ts)
- [lib/mock/data.ts](C:\Users\21258\Documents\New project\lib\mock\data.ts)

重点学习这些类型：

- `ImageRef`
- `FindingCardInput`
- `MeasurementSummary`
- `ReportAssistInput`
- `ReportAssistOutput`
- `ExplainFindingInput`
- `ExplainFindingOutput`

### 第 2 层：再理解工作站怎样整理这些输入

再看：

- [lib/mock/repository.ts](C:\Users\21258\Documents\New project\lib\mock\repository.ts)

重点函数：

- `buildReportAssistInput`
- `draftStructuredReport`
- `explainStructuredFinding`
- `getEvalCases`
- `getEvalRunRecords`

### 第 3 层：最后看 API 如何承接模型

再看：

- [app/api/ai/report-draft/route.ts](C:\Users\21258\Documents\New project\app\api\ai\report-draft\route.ts)
- [app/api/ai/explain-finding/route.ts](C:\Users\21258\Documents\New project\app\api\ai\explain-finding\route.ts)
- [app/api/ai/evals/route.ts](C:\Users\21258\Documents\New project\app\api\ai\evals\route.ts)
- [app/api/studies/[studyId]/ai-input/route.ts](C:\Users\21258\Documents\New project\app\api\studies\[studyId]\ai-input\route.ts)

## 未来微调模型前，你最需要明确的数据结构

### 1. 图像输入格式 `ImageRef`

你不能只说“给模型几张图”。你必须明确每张图是什么、来自哪里、在任务里扮演什么角色。

当前项目里定义为：

```ts
type ImageInputFormat = "png" | "jpg" | "dicom-instance-ref" | "dicom-series-key-image";

interface ImageRef {
  imageId: string;
  studyId: string;
  seriesId?: string;
  instanceId?: string;
  sliceIndex?: number;
  format: ImageInputFormat;
  uri: string;
  role: "key_image" | "roi_evidence" | "overview";
  note?: string;
}
```

你需要重点理解：

- `format`：模型吃的是截图、导出图，还是 DICOM 实例引用
- `uri`：未来真实模型服务如何定位图像
- `role`：这张图是总览图、关键图，还是 ROI 证据图
- `sliceIndex`：对 CT 很关键，因为报告往往和层面位置有关

### 2. finding 结构 `FindingCardInput`

模型不要直接吃 UI 卡片，而要吃经过整理的 finding 对象。

```ts
interface FindingCardInput {
  findingId: string;
  label: string;
  category: string;
  status: "detected" | "confirmed" | "dismissed";
  source: "ai" | "manual";
  narrative: string;
  sizeText?: string;
  riskLevel?: "low" | "medium" | "high";
  confidence?: number;
  linkedSeriesId: string;
  linkedSliceIndex: number;
}
```

你需要重点理解：

- `status`：微调时要不要把 dismissed 的 finding 喂给模型
- `source`：模型是否需要知道这个 finding 是 AI 提议还是人工确认
- `narrative`：这是接近报告语言的中间层，非常重要
- `linkedSeriesId / linkedSliceIndex`：帮助模型和 viewer / 证据位置对齐

### 3. measurement 结构 `MeasurementSummary`

measurement 必须是独立对象，不能埋在文本里。

```ts
interface MeasurementSummary {
  measurementId: string;
  findingId: string;
  longAxisMm: number;
  shortAxisMm: number;
  areaMm2?: number;
  volumeMm3?: number;
  meanHU?: number;
  notes: string;
}
```

你需要重点理解：

- 哪些测量值是训练/推理时真正有用的
- 哪些值只是 viewer 层信息
- `findingId` 绑定关系必须稳定

对胸部 CT 来说，`longAxisMm / shortAxisMm / meanHU` 往往是比较值得优先整理的字段。

### 4. 结构化报告输入 `ReportAssistInput`

这是最重要的类型之一。

```ts
interface ReportAssistInput {
  caseId: string;
  studyId: string;
  imageRefs: ImageRef[];
  findings: FindingCardInput[];
  measurements: MeasurementSummary[];
  templateType: "chest_ct" | "pet_ct" | "abdomen_ct" | "chest_xray_research";
  currentSection: "findings" | "impression";
  priorSummary?: string;
  clinicalInfo?: string;
}
```

你需要重点理解：

- 这不是“聊天输入”，这是“报告辅助输入”
- `templateType` 决定模型生成风格和术语边界
- `currentSection` 决定模型当前只生成哪个 section
- `priorSummary` 和 `clinicalInfo` 是非常有价值的非图像上下文

### 5. 结构化报告输出 `ReportAssistOutput`

模型输出也不能是一大段无约束自然语言。

```ts
interface ReportAssistOutput {
  section: "findings" | "impression";
  draftText: string;
  evidenceUsed: string[];
  uncertainty?: string;
}
```

你需要重点理解：

- `section`：输出必须知道该落到哪一段
- `draftText`：这是供医生编辑的草稿，不是最终定稿
- `evidenceUsed`：以后做可解释性、trace 和审计很有用
- `uncertainty`：非常适合医疗场景，帮助避免模型装得太确定

## 未来微调模型前，你要优先理解的接口

### 1. `POST /api/ai/report-draft`

作用：

- 给定结构化输入
- 只生成 `findings` 或 `impression` 的草稿
- 不直接改数据库，不直接强写 report

当前文件：

- [app/api/ai/report-draft/route.ts](C:\Users\21258\Documents\New project\app\api\ai\report-draft\route.ts)

为什么重要：

- 以后最容易替换成真实模型服务
- 前端不需要知道模型是本地 Python、FastAPI、vLLM 还是远程服务

### 2. `POST /api/ai/explain-finding`

作用：

- 对单个 finding 做解释
- 返回它用到了哪些证据

当前文件：

- [app/api/ai/explain-finding/route.ts](C:\Users\21258\Documents\New project\app\api\ai\explain-finding\route.ts)

为什么重要：

- 这是“辅助理解”接口，不是“报告生成”接口
- 以后可以单独做模型解释能力测试

### 3. `GET /api/studies/[studyId]/ai-input`

作用：

- 把当前 study 整理成模型可用输入
- 帮你验证工作站内部状态是否真的能转成结构化 payload

当前文件：

- [app/api/studies/[studyId]/ai-input/route.ts](C:\Users\21258\Documents\New project\app\api\studies\[studyId]\ai-input\route.ts)

为什么重要：

- 这是“工作站对象层”和“模型层”之间的桥

## 当前 ModelAdapter MVP

当前已经新增：

- [lib/ai/modelAdapter.ts](C:\Users\21258\Documents\New project\lib\ai\modelAdapter.ts)

它现在做 3 件事：

- 接收前端已有的 `ReportAssistInput`
- 优先请求本地模型服务 `POST http://localhost:8000/report-draft`
- 如果模型服务不可用、超时、返回格式不对，就 fallback 到现有 mock draft

默认配置写在：

- [.env.example](C:\Users\21258\Documents\New project\.env.example)

```bash
REPORT_DRAFT_MODEL_URL=http://localhost:8000/report-draft
MODEL_ADAPTER_TIMEOUT_MS=180000
MODEL_ADAPTER_ENABLED=true
```

本地开发时可以创建 `.env.local` 覆盖这些值。`.env.local` 已经加入 `.gitignore`，不会被提交。

### 当前已接入的本地 Python 服务

本仓库已包含一个可直接运行的本地服务脚本：

- [serve_report_draft.py](C:\Users\21258\Documents\New project\serve_report_draft.py)

它的定位是：

- 作为 `REPORT_DRAFT_MODEL_URL` 指向的本地模型服务
- 支持 `mock / base / lora` 三种模式
- 当前对 `templateType: "chest_xray_research"` 的 `findings` 生成做了更严格的 prompt 和后处理（用于 Research 胸片演示）

### Python 服务需要返回什么

模型服务（`POST /report-draft`）最小返回格式（直接返回 `ReportAssistOutput`）：

```json
{
  "section": "findings",
  "draftText": "Generated findings draft...",
  "evidenceUsed": ["fd-001", "img-001"],
  "uncertainty": "Optional caution text."
}
```

也支持包一层：

```json
{
  "output": {
    "section": "findings",
    "draftText": "Generated findings draft...",
    "evidenceUsed": ["fd-001"]
  }
}
```

注意：页面实际调用的是 `POST /api/ai/report-draft`（Next.js API）。该接口会再包一层元信息，形状类似：

```json
{
  "provider": "local-model-service",
  "fallbackUsed": false,
  "requestDurationMs": 1234,
  "timeoutMs": 180000,
  "serviceMode": "base",
  "output": {
    "section": "findings",
    "draftText": "FINDINGS:\n...",
    "evidenceUsed": ["cxr-001-finding-001", "img-cxr-001"]
  }
}
```

### 当前演示路径

最小演示路径有两条：

1. `/research` 选择固定 eval case，点击 `POST /api/ai/report-draft`，右侧显示模型或 fallback 输出
2. `/workstation/study-ct-001` 点击 `Generate Findings Draft`，中间显示 draft，再点击 `Insert Draft Into Report`

如果本地 Python 服务没有启动，页面会显示 `mock-fallback`，这说明前端链路仍然能演示完整闭环。

### 4. `GET /api/ai/evals`

作用：

- 返回固定测试样例和评估记录

当前文件：

- [app/api/ai/evals/route.ts](C:\Users\21258\Documents\New project\app\api\ai\evals\route.ts)

为什么重要：

- 帮你把“模型研究”从随手试玩变成可比较的实验

## 你未来接真实模型时，最应该保持稳定的部分

尽量不要频繁改下面这几层：

- `ReportAssistInput`
- `ReportAssistOutput`
- `POST /api/ai/report-draft`
- `POST /api/ai/explain-finding`

以后真正变化的地方，最好主要在：

- mock 实现换成真实模型适配器
- 图像读取策略
- prompt 或 instruction 模板
- 模型后处理逻辑

## 当前项目里你可以怎么学习

### 1. 从工作站页学

看：

- [components/WorkstationClient.tsx](C:\Users\21258\Documents\New project\components\WorkstationClient.tsx)

重点看两个区域：

- `Measurement Summary`
- `AI Input Readiness`

这两个区域就是“未来接微调模型前必须先准备好的对象层”。

### 2. 从研究页学

看：

- [app/research/page.tsx](C:\Users\21258\Documents\New project\app\research\page.tsx)
- [components/ResearchWorkbenchClient.tsx](C:\Users\21258\Documents\New project\components\ResearchWorkbenchClient.tsx)

这个页面的作用是：

- 选固定样例
- 看真实 payload
- 调用 `POST /api/ai/report-draft`（通过 `ModelAdapter` 转发到本地 Python 服务，不可用则 fallback）
- 通过 `GET /api/images/[imageId]` 预览胸片 key image（把 `file:///mnt/...` URI 映射为 Windows 本地盘符）
- 看结构化输出
- 看最小评估记录

这就是你之后做模型实验时最应该保留的一套研究工作台。

## 一个很重要的判断：现在还缺什么

虽然现在已经比之前更适合接模型了，但如果你下一步真要开始做“自己微调医疗多模态模型”，还缺下面这些东西：

### 1. 可复现实验的运行方式

当前 Python 服务已可跑通端到端演示，但如果要长期迭代，需要进一步把下面这些固化：

- 稳定的 Python 环境（requirements/uv/conda 等）
- 数据与模型路径的约定（尤其是 Windows/WSL 的 `/mnt/<drive>/...` 映射）
- 服务的启动方式（如固定端口/健康检查、可选 warmup、日志与错误定位）

### 2. 更贴近训练数据集的 schema

当前 schema 适合教学和原型，但后面你可能还要补：

- body part / laterality
- anatomy labels
- pathology labels
- evidence frame selection strategy
- prompt version / model version

### 3. 真正的评估维度

现在只有最小评估记录，后面至少还可以加：

- section completeness
- hallucination risk
- terminology consistency
- evidence grounding
- physician edit distance

## 运行

```bash
npm install
npm run dev
```

如果要启用本地模型服务（推荐在 WSL 运行），另起一个终端：

```bash
python3 serve_report_draft.py --mode base --host 0.0.0.0 --port 8000
```

如果本地 Python 服务没有启动，页面会显示 `mock-fallback`，说明前端链路仍可演示完整闭环。

## 下一步最推荐做什么

如果你接下来继续开发，最推荐的顺序是：

1. 先把 `serve_report_draft.py` 的运行环境与数据/模型路径固化成可复现的一键启动方式
2. 再补 5 到 10 个胸片/CXR 固定 eval case（带 gold-like target），让研究页能稳定对比
3. 再把同一条链路扩展到 CT case（或 impression 生成），逐步扩大 `templateType` 覆盖面
4. 最后再考虑更复杂的 viewer / DICOM 接入与真实数据源

这样你会始终围绕“结构化报告辅助”这个研究目标推进，而不会被系统外壳牵着走。
