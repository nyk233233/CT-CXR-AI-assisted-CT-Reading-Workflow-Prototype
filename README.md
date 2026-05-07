````md
# CT-CXR AI-assisted Radiology Workstation Prototype

一个面向医学影像工作流的 AI 辅助放射科工作站原型，重点探索 CT 读片流程、结构化 finding、影像证据联动、报告草稿生成和最终报告编辑之间的关系。

本项目不是完整 PACS，不是 3D Slicer 替代品，也不是自动诊断系统。  
当前目标是构建一个轻量级 Web 工作站原型，用于展示真实医学影像数据如何进入前端工作流，并与 AI candidate finding、measurement 和 structured report authoring 结合。

---

## 项目定位

本项目聚焦于以下工作流：

```text
真实 CT DICOM 预处理结果
→ CT key image viewer
→ AI candidate findings
→ 医生 confirm / dismiss
→ measurement summary
→ report draft preview
→ final report text
```
````

核心理念是：

> AI 不直接替代医生做最终诊断，而是提供结构化候选 finding 和报告草稿；医生负责审阅、确认、拒绝、编辑和最终报告签署。

---

## CT Workflow v1

当前版本已将真实 LIDC-IDRI CT case 接入工作站流程，并完成一个最小可演示的 CT reading workflow。

### 已完成功能

- 将 **LIDC-IDRI Case 002** 接入 workstation mock domain。
- 显示由 DICOM preprocessing 导出的真实 **lung-window CT key images**。
- 支持 upper / middle / lower 三张 CT key image 切换。
- 通过 `sliceIndex` 将 AI candidate finding 绑定到对应 CT key image。
- 支持基础 measurement 展示：
  - long axis
  - short axis
  - area
  - mean HU

- 实现 AI candidate finding 的 human-in-the-loop review 状态：
  - `detected`
  - `confirmed`
  - `dismissed`

- 将 confirmed CT findings 接入 report draft workflow。
- 实现：
  - Confirmed Structured Findings
  - Draft Preview
  - Apply Draft to Final Findings
  - Save Final Findings

- 增加 Recent Activity / Action Trace，用于记录关键工作流动作。

---

## 当前工作流

```text
LIDC CT DICOM preprocessing
→ CT key image export
→ workstation mock domain
→ CT key image viewer
→ AI candidate findings
→ confirm / dismiss
→ confirmed findings + measurements
→ report draft generation
→ final findings text
```

---

## 技术栈

- Next.js
- TypeScript
- Tailwind CSS
- Mock repository layer
- Local image API
- ReportAssistInput / ReportAssistOutput
- Local report-draft service interface

---

## 当前版本的非目标

当前版本暂不实现：

- 完整 DICOM scrolling viewer
- Cornerstone3D viewer 集成
- Orthanc / DICOMweb
- 完整 PACS 行为
- 自动诊断
- CT AI perception model training
- 3D reconstruction / 3D Slicer-like 功能

---

## 后续计划

- 集成 Cornerstone3D stack viewer。
- 接入 Orthanc + DICOMweb。
- 解析 LIDC SEG / SR 对象。
- 将 mock AI candidate 替换为 CT AI candidate service。
- 增强 report assist model integration。
- 实现更强的 image-finding-report 双向联动。
- 引入更完整的 workflow state 和 action audit trail。

---

## 为什么做这个项目

很多医学 AI demo 停留在“模型输出”或“影像展示”层面。
本项目更关注工作流层：AI finding 如何被医生审阅，如何与影像证据和 measurement 绑定，如何进入报告草稿，并最终由医生编辑保存。

项目重点不是单独训练一个模型，而是探索：

```text
medical imaging data
+ structured findings
+ AI assistance
+ radiology workflow
+ report authoring
```

如何在一个 Web-based workstation prototype 中形成闭环。

---

## Screenshots

后续将补充以下截图：

1. CT Sandbox preprocessing preview
2. CT Workstation viewer with candidate findings
3. Report drafting workflow

```

```
