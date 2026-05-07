#!/usr/bin/env python3
"""
【教学视角：AI 医疗报告生成服务】
本脚本实现了一个轻量级的本地服务，用于 AI 放射学工作站演示。
它展示了如何将结构化发现（Structured Findings）和医学影像（Medical Images）
结合，通过视觉语言模型（VLM）生成放射学报告草稿。

核心特性：
1. 多模式运行：支持 Mock（无模型）、Base（预训练模型）、LoRA（微调模型）。
2. 本地部署：使用 Hugging Face Transformers 和 PEFT 库。
3. 容错处理：当模型推理失败时，自动降级到确定性 Mock 输出。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import traceback
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse


# --- 全局常量与配置 ---
# 默认模型与数据路径，通常指向挂载的存储卷（如 WSL 中的 /mnt/e/）
DEFAULT_MODEL_PATH = "/mnt/e/med_data/models/medgemma-1.5-4b-it"
DEFAULT_LORA_PATH = "/mnt/e/med_data/outputs/medgemma_lora_exp1_smoke"
DEFAULT_SAMPLE_IMAGE = (
    "/mnt/e/med_data/raw/mimic-cxr-jpg/files/p10/p10000764/"
    "s57375967/096052b7-d256dc40-453a102b-fa7d01c6-1b22c6b4.jpg"
)

# 案例影像映射：用于演示目的，当输入特定的 caseId 时，强制指向特定的本地文件
CASE_IMAGE_OVERRIDES = {
    "case_57375967_096052b7": DEFAULT_SAMPLE_IMAGE,
    "case-cxr-57375967-096052b7": DEFAULT_SAMPLE_IMAGE,
}

# 类型别名：增强代码可读性，明确输入输出的数据结构
ReportAssistInput = Dict[str, Any]
ReportAssistOutput = Dict[str, Any]


@dataclass
class ServiceConfig:
    """
    【教学点：数据类 (Dataclass)】
    使用 @dataclass 可以自动生成 __init__、__repr__ 等方法。
    在配置管理中，这比普通类更简洁，且能提供更好的类型提示。
    """
    mode: str
    model_path: str
    lora_path: str
    sample_image: str
    max_new_tokens: int


class ReportDraftEngine:
    """
    【架构解析：引擎类】
    该类负责模型生命周期管理（加载、热身）和核心推理逻辑。
    通过解耦配置（ServiceConfig）与执行，实现了灵活的模式切换。
    """
    def __init__(self, config: ServiceConfig):
        self.config = config
        self._pipe = None  # Transformers 管道，封装了模型和处理器
        self._processor = None
        self._model = None

    def warmup(self) -> None:
        """模型预热：在服务启动时提前加载模型到显存，避免首次请求延迟。"""
        if self.config.mode == "mock":
            return

        self._load_model()

    def draft(self, payload: ReportAssistInput) -> ReportAssistOutput:
        """
        生成报告草稿的主入口。
        体现了‘优雅降级’的设计思想：如果模型推理失败，返回 Mock 结果以保证前端可用。
        """
        if self.config.mode == "mock":
            return build_mock_output(payload)

        try:
            return self._draft_with_model(payload)
        except Exception as exc:
            # 保持演示可用性，即使路径错误或显存不足
            fallback = build_mock_output(payload)
            fallback["uncertainty"] = (
                f"Model inference failed and service returned deterministic fallback: {exc}"
            )
            return fallback

    def _load_model(self) -> None:
        """
        【技术细节：动态模型加载】
        根据运行模式选择性地加载 LoRA 适配器。使用 bfloat16 以平衡精度和显存占用。
        """
        if self._pipe is not None:
            return

        try:
            import torch
            from transformers import pipeline
        except Exception as exc:
            raise RuntimeError(
                "base/lora mode requires torch and transformers in the active WSL Python environment."
            ) from exc

        model_arg: Any = self.config.model_path

        if self.config.mode == "lora":
            # LoRA 加载流程：1. 加载处理器 2. 加载基础模型 3. 合并 LoRA 权重
            try:
                from peft import PeftModel
                from transformers import AutoModelForImageTextToText, AutoProcessor
            except Exception as exc:
                raise RuntimeError("lora mode requires peft in the active WSL Python environment.") from exc

            print(f"[service] loading processor: {self.config.model_path}", flush=True)
            self._processor = AutoProcessor.from_pretrained(
                self.config.model_path,
                local_files_only=True,
            )

            print(f"[service] loading base model: {self.config.model_path}", flush=True)
            base_model = AutoModelForImageTextToText.from_pretrained(
                self.config.model_path,
                torch_dtype=torch.bfloat16,
                device_map="auto",
                local_files_only=True,
            )

            print(f"[service] loading LoRA adapter: {self.config.lora_path}", flush=True)
            self._model = PeftModel.from_pretrained(
                base_model,
                self.config.lora_path,
                local_files_only=True,
            )
            model_arg = self._model

        print(f"[service] creating image-text-to-text pipeline in {self.config.mode} mode", flush=True)
        self._pipe = pipeline(
            task="image-text-to-text",
            model=model_arg,
            tokenizer=self._processor,
            image_processor=self._processor,
            dtype=torch.bfloat16,
            device_map="auto",
        )

    def _draft_with_model(self, payload: ReportAssistInput) -> ReportAssistOutput:
        """
        【执行流：模型推理】
        1. 解析影像路径。
        2. 构建提示词（Prompt Engineering）。
        3. 调用 VLM 进行多模态推理。
        4. 后处理输出文本。
        """
        self._load_model()

        from PIL import Image

        image_path = resolve_image_path(payload, self.config.sample_image)
        prompt = build_prompt(payload)

        print(f"[service] running inference for case={payload.get('caseId')} image={image_path}", flush=True)
        image = Image.open(image_path).convert("RGB")
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": prompt},
                ],
            }
        ]

        result = self._pipe(text=messages, max_new_tokens=self.config.max_new_tokens)
        draft_text = extract_generated_text(result)
        section = normalize_section(payload.get("currentSection"))
        # 模型输出往往带有杂质（如 JSON 标记、重复输入），需要通过后处理清洗
        draft_text, deterministic_fallback_used = postprocess_model_text(draft_text, section, payload)

        return {
            "section": section,
            "draftText": draft_text,
            "evidenceUsed": collect_evidence_ids(payload),
            "uncertainty": build_uncertainty(self.config.mode, section, deterministic_fallback_used),
            "serviceMode": self.config.mode,
        }


def build_mock_output(payload: ReportAssistInput) -> ReportAssistOutput:
    """
    【开发工具：Mock 输出】
    在没有 GPU 或模型未准备好时，通过简单的业务逻辑生成‘伪草稿’。
    这对于前端独立开发和测试后端集成非常关键。
    """
    section = normalize_section(payload.get("currentSection"))
    findings = payload.get("findings") or []
    measurements = payload.get("measurements") or []

    if section == "impression":
        key_finding = first_non_dismissed_finding(findings)
        measurement = find_measurement_for_finding(measurements, key_finding)
        if key_finding:
            measurement_text = ""
            if measurement:
                measurement_text = (
                    f" It measures approximately {measurement.get('longAxisMm')} x "
                    f"{measurement.get('shortAxisMm')} mm."
                )
            draft = (
                f"{key_finding.get('label', 'Dominant finding')} is the main abnormality."
                f"{measurement_text} Correlate with clinical context and prior imaging."
            )
        else:
            draft = "No dominant structured abnormality was provided for impression drafting."
    else:
        active_findings = [item for item in findings if item.get("status") != "dismissed"]
        if active_findings:
            draft = "\n".join(
                f"- {item.get('label', 'Finding')}: {item.get('narrative', '').strip()}"
                for item in active_findings
            )
        else:
            draft = "- No active structured findings were provided."

    return {
        "section": section,
        "draftText": draft,
        "evidenceUsed": collect_evidence_ids(payload),
        "uncertainty": "Generated by local mock mode; no model inference was run.",
        "serviceMode": "mock",
    }


def build_prompt(payload: ReportAssistInput) -> str:
    """
    【核心技术：提示词工程 (Prompt Engineering)】
    针对医学报告生成的特定任务，构建结构化提示词。
    包含：角色设定（Reporting Assistant）、上下文（影像、结构化发现）、任务描述（Task）和严格约束（Strict Rules）。
    """
    section = normalize_section(payload.get("currentSection"))
    findings_json = json.dumps(payload.get("findings") or [], ensure_ascii=False, indent=2)
    measurements_json = json.dumps(payload.get("measurements") or [], ensure_ascii=False, indent=2)
    template_type = payload.get("templateType", "unknown")

    if template_type == "chest_xray_research" and section == "findings":
        return build_chest_xray_findings_prompt(payload, findings_json)

    if section == "impression":
        task = "Write only the Impression section draft."
        rules = [
            "Output only one section: IMPRESSION",
            "Summarize the most important supported abnormality",
            "Do not invent diagnosis, staging, or treatment",
        ]
    else:
        task = "Write only the Findings section draft."
        rules = [
            "Output only one section: FINDINGS",
            "Use structured, objective, radiology-style language",
            "Do not add unsupported normal or negative statements",
        ]

    return f"""You are a structured reporting assistant for a medical imaging workstation.

Input:
- one key image if available
- structured findings
- measurement summaries
- currentSection = {section}
- templateType = {template_type}

Clinical info:
{payload.get("clinicalInfo") or "Not provided"}

Prior summary:
{payload.get("priorSummary") or "Not provided"}

Task:
{task}

Strict rules:
{chr(10).join(f"- {rule}" for rule in rules)}
- Prefer the provided structured findings over speculation
- Keep the wording concise

Structured findings:
{findings_json}

Measurements:
{measurements_json}
""".strip()


def build_chest_xray_findings_prompt(payload: ReportAssistInput, findings_json: str) -> str:
    return f"""You are a structured reporting assistant for a chest X-ray research demo.

Input:
- one chest X-ray image
- structured findings
- currentSection = findings
- templateType = chest_xray_research

Task:
Write the Findings section draft.

Strict rules:
- Output exactly one section: FINDINGS.
- Do not output JSON.
- Do not repeat structured findings.
- Do not output IMPRESSION.
- Do not output recommendation.
- Use concise radiology-style sentences.
- Use only information supported by the image and structured findings.

Structured findings:
{findings_json}
""".strip()


def resolve_image_path(payload: ReportAssistInput, sample_image: str) -> str:
    """
    【教学点：资源定位逻辑】
    在分布式或跨平台（如 Windows/WSL）开发中，文件路径的解析至关重要。
    该函数尝试多种策略定位影像：
    1. 优先使用 payload 中的 imageRefs（转换为本地路径）。
    2. 其次根据 caseId 进行硬编码映射。
    3. 最后降级到默认的示例影像。
    """
    image_refs = payload.get("imageRefs") or []
    for image_ref in image_refs:
        uri = str(image_ref.get("uri") or "")
        candidate = uri_to_path(uri)
        if candidate and Path(candidate).exists():
            return candidate

    case_id = str(payload.get("caseId") or "")
    mapped_path = CASE_IMAGE_OVERRIDES.get(case_id)
    if mapped_path and Path(mapped_path).exists():
        return mapped_path

    # 当前前端 Mock 使用 dicom:// URIs，虽然有用但不可直接加载为图片。
    # 使用已知本地样本以确保模型推理流程能跑通。
    if Path(sample_image).exists():
        return sample_image

    raise FileNotFoundError(
        "No loadable image path found. Provide file:///mnt/... imageRefs or set --sample-image."
    )


def uri_to_path(uri: str) -> Optional[str]:
    """将 file:// URI 协议头移除，转换为标准的 Linux 路径"""
    if uri.startswith("file://"):
        return uri.removeprefix("file://")
    if uri.startswith("/mnt/"):
        return uri
    return None


def postprocess_model_text(text: str, section: str, payload: ReportAssistInput) -> tuple[str, bool]:
    """
    【教学点：后处理管道 (Post-processing Pipeline)】
    模型输出往往是“原始的”，包含幻觉、重复或格式错误。
    此管道包含以下步骤：
    1. 规范化换行符。
    2. 如果是胸片研究且模型重复了 JSON 输入，触发“确定性兜底”。
    3. 提取特定章节（Findings/Impression）。
    4. 移除模型常见的冗余建议（如建议复查）。
    5. 强制添加章节标题。
    """
    cleaned = normalize_generated_text(text)

    if section != "findings":
        return force_section_header(cleaned, "IMPRESSION"), False

    # 检测模型是否只是简单地复读了输入数据（常见于未充分训练的小模型）
    if is_chest_xray_research(payload) and repeats_structured_input(cleaned):
        return build_deterministic_cxr_findings(payload), True

    findings_text = extract_findings_only(cleaned)
    # 移除类似 "Recommend clinical correlation" 的句子，保持 Findings 的纯净
    findings_text = remove_recommendation_sentences(findings_text)
    findings_text = strip_section_headers(findings_text)
    findings_text = findings_text.strip()

    if not findings_text:
        findings_text = "No supported findings text was generated."

    return f"FINDINGS:\n{findings_text}", False


def normalize_generated_text(text: str) -> str:
    return str(text or "").replace("\r\n", "\n").replace("\r", "\n").strip()


def extract_findings_only(text: str) -> str:
    impression_match = re.search(r"(?im)^\s*IMPRESSION\s*:", text)
    if impression_match:
        text = text[: impression_match.start()]

    findings_match = re.search(r"(?im)^\s*FINDINGS\s*:", text)
    if findings_match:
        text = text[findings_match.end() :]

    return text.strip()


def remove_recommendation_sentences(text: str) -> str:
    fragments = split_text_fragments(text)
    kept = [fragment for fragment in fragments if not is_recommendation_fragment(fragment)]
    return " ".join(kept).strip()


def split_text_fragments(text: str) -> List[str]:
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return []
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", normalized) if part.strip()]


def is_recommendation_fragment(fragment: str) -> bool:
    return re.search(r"\b(recommend|follow[- ]?up|diagnosis|impression)\b", fragment, re.IGNORECASE) is not None


def strip_section_headers(text: str) -> str:
    text = re.sub(r"(?im)^\s*FINDINGS\s*:\s*", "", text)
    text = re.sub(r"(?im)^\s*IMPRESSION\s*:\s*", "", text)
    return text


def force_section_header(text: str, header: str) -> str:
    stripped = strip_section_headers(text).strip()
    return f"{header}:\n{stripped}" if stripped else f"{header}:\nNo supported text was generated."


def repeats_structured_input(text: str) -> bool:
    return re.search(
        r"(findingId|linkedSeriesId|linkedSliceIndex|narrative|\"findings\"|\{|\}|\[|\])",
        text,
        re.IGNORECASE,
    ) is not None


def is_chest_xray_research(payload: ReportAssistInput) -> bool:
    return payload.get("templateType") == "chest_xray_research"


def build_deterministic_cxr_findings(payload: ReportAssistInput) -> str:
    findings = payload.get("findings") or []
    positive = []
    uncertain = []
    other = []

    for finding in findings:
        sentence = str(finding.get("narrative") or "").strip()
        if not sentence:
            continue

        category = str(finding.get("category") or "").lower()
        label = str(finding.get("label") or "").lower()
        if "positive" in category or finding.get("status") == "confirmed":
            positive.append(sentence)
        elif "uncertain" in category or "possible" in sentence.lower() or "pneumonia" in label:
            uncertain.append(sentence)
        else:
            other.append(sentence)

    body = " ".join(positive + uncertain + other).strip()
    if not body:
        body = "No supported chest X-ray findings were provided."

    return f"FINDINGS:\n{body}"


def build_uncertainty(mode: str, section: str, deterministic_fallback_used: bool) -> str:
    if deterministic_fallback_used and mode == "base":
        return (
            "Generated by local MedGemma base service; deterministic CXR fallback was applied "
            "because model output repeated structured input."
        )
    if deterministic_fallback_used:
        return (
            "Generated by local MedGemma service; deterministic CXR fallback was applied "
            "because model output repeated structured input."
        )
    if mode == "base" and section == "findings":
        return "Generated by local MedGemma base service; postprocessed for findings-only output."
    if mode == "base":
        return "Generated by local MedGemma base service. Review before clinical use."
    if mode == "lora" and section == "findings":
        return (
            "Generated by local MedGemma service with smoke LoRA adapter; "
            "postprocessed for findings-only output. Adapter is not quality-validated."
        )
    return "Generated by local MedGemma service with smoke LoRA adapter. Adapter is not quality-validated."


def extract_generated_text(result: Any) -> str:
    try:
        generated = result[0]["generated_text"]
        if isinstance(generated, list):
            last_message = generated[-1]
            if isinstance(last_message, dict):
                content = last_message.get("content")
                if isinstance(content, str):
                    return content
                if isinstance(content, list):
                    texts = [item.get("text", "") for item in content if isinstance(item, dict)]
                    return "\n".join(texts)
        if isinstance(generated, str):
            return generated
    except Exception:
        pass

    return str(result)


def collect_evidence_ids(payload: ReportAssistInput) -> List[str]:
    """
    【教学点：闭环引用 (Evidence Linking)】
    医疗 AI 不应只是生成文本，还应指明生成文本的依据。
    此函数从 payload 中收集所有相关的 findingId、measurementId 和 imageId。
    这些 ID 返回给前端后，可以实现“点击报告文字，高亮对应的影像标注”功能。
    """
    evidence: List[str] = []
    for finding in payload.get("findings") or []:
        finding_id = finding.get("findingId")
        if finding_id:
            evidence.append(str(finding_id))
    for measurement in payload.get("measurements") or []:
        measurement_id = measurement.get("measurementId")
        if measurement_id:
            evidence.append(str(measurement_id))
    for image_ref in payload.get("imageRefs") or []:
        image_id = image_ref.get("imageId")
        if image_id:
            evidence.append(str(image_id))
    return sorted(set(evidence))


def first_non_dismissed_finding(findings: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    for finding in findings:
        if finding.get("status") != "dismissed":
            return finding
    return None


def find_measurement_for_finding(
    measurements: List[Dict[str, Any]],
    finding: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    if not finding:
        return None
    finding_id = finding.get("findingId")
    for measurement in measurements:
        if measurement.get("findingId") == finding_id:
            return measurement
    return None


def normalize_section(section: Any) -> str:
    return "impression" if section == "impression" else "findings"


class ReportDraftHandler(BaseHTTPRequestHandler):
    """
    【接口层：HTTP 请求处理器】
    继承自 Python 标准库的 BaseHTTPRequestHandler。
    虽然简单，但完整展示了 REST API 的基本模式：
    1. 路由解析 (do_GET, do_POST)
    2. JSON 解析 (_read_json)
    3. 业务逻辑调用 (engine.draft)
    4. 响应封装 (_send_json)
    """
    engine: ReportDraftEngine

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send_json(
                {
                    "ok": True,
                    "mode": self.engine.config.mode,
                    "modelPath": self.engine.config.model_path,
                    "loraPath": self.engine.config.lora_path,
                }
            )
            return

        self._send_json({"message": "Use POST /report-draft"}, status=404)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/report-draft":
            self._send_json({"message": "Not found"}, status=404)
            return

        try:
            payload = self._read_json()
            output = self.engine.draft(payload)
            self._send_json(output)
        except Exception as exc:
            traceback.print_exc()
            self._send_json(
                {
                    "section": "findings",
                    "draftText": "",
                    "evidenceUsed": [],
                    "uncertainty": f"Service error: {exc}",
                    "serviceMode": self.engine.config.mode,
                },
                status=500,
            )

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stdout.write("[http] " + fmt % args + "\n")
        sys.stdout.flush()

    def _read_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw) if raw else {}

    def _send_json(self, payload: Dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def parse_args() -> argparse.Namespace:
    """
    【教学点：参数化与环境感知】
    使用 argparse 处理命令行参数，并结合 os.getenv 提供环境变量默认值。
    这种模式使得服务既可以手动启动，也易于集成到 Docker/Kubernetes 等容器化环境中。
    """
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["mock", "base", "lora"], default=os.getenv("REPORT_SERVICE_MODE", "mock"))
    parser.add_argument("--host", default=os.getenv("REPORT_SERVICE_HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.getenv("REPORT_SERVICE_PORT", "8000")))
    parser.add_argument("--model-path", default=os.getenv("MEDGEMMA_MODEL_PATH", DEFAULT_MODEL_PATH))
    parser.add_argument("--lora-path", default=os.getenv("MEDGEMMA_LORA_PATH", DEFAULT_LORA_PATH))
    parser.add_argument("--sample-image", default=os.getenv("REPORT_SERVICE_SAMPLE_IMAGE", DEFAULT_SAMPLE_IMAGE))
    parser.add_argument("--max-new-tokens", type=int, default=int(os.getenv("REPORT_SERVICE_MAX_NEW_TOKENS", "80")))
    parser.add_argument("--no-warmup", action="store_true")
    return parser.parse_args()


def main() -> None:
    """
    【教学点：入口函数设计】
    1. 解析配置。
    2. 初始化引擎。
    3. 执行预热。
    4. 启动多线程 HTTP 服务。
    使用 ThreadingHTTPServer 可以处理并发请求，虽然在单显卡推理场景下并发有限。
    """
    args = parse_args()
    config = ServiceConfig(
        mode=args.mode,
        model_path=args.model_path,
        lora_path=args.lora_path,
        sample_image=args.sample_image,
        max_new_tokens=args.max_new_tokens,
    )

    engine = ReportDraftEngine(config)
    if not args.no_warmup:
        print(f"[service] warming up in {args.mode} mode...", flush=True)
        engine.warmup()

    ReportDraftHandler.engine = engine
    server_address = (args.host, args.port)
    httpd = ThreadingHTTPServer(server_address, ReportDraftHandler)
    print(f"[service] serving at http://{args.host}:{args.port}/", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[service] shutting down", flush=True)
        httpd.server_close()


if __name__ == "__main__":
    main()
