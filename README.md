1. 项目定位：
   AI-assisted radiology workstation prototype，不是完整 PACS，不是 3D Slicer 替代品，不是自动诊断系统。

2. 当前 CT Workflow v1 已完成：

- Integrated LIDC-IDRI Case 002 into the workstation mock domain.
- Displayed real lung-window CT key images exported from DICOM preprocessing.
- Added upper / middle / lower key image switching.
- Linked AI candidate findings to CT key images through sliceIndex.
- Added measurements such as long axis, short axis, mean HU.
- Implemented human-in-the-loop review states: detected, confirmed, dismissed.
- Connected confirmed CT findings to report draft workflow.
- Added Draft Preview, Apply Draft to Final Findings, and Save Findings.
- Added action trace / recent activity.

3. 技术栈：
   Next.js, TypeScript, Tailwind, mock repository, local image API, ReportAssistInput / ReportAssistOutput.

4. 当前 non-goals：

- Not full DICOM scrolling viewer yet.
- Not Cornerstone3D integration yet.
- Not Orthanc / DICOMweb yet.
- Not automatic diagnosis.
- Not CT AI perception model training yet.

5. Next steps：

- Cornerstone3D stack viewer.
- Orthanc + DICOMweb.
- SEG/SR parsing.
- CT AI candidate service.
- Stronger report assist model integration.

保持 README 简洁、适合作品集展示。
