## 1. 高阶总结 (TL;DR)

- **影响程度:** [中等] - 引入了对 Orthanc DICOMweb 的支持，并为 CT 图像查看器添加了数据源切换功能，增强了系统集成外部 DICOM 服务的能力。
- **核心变更:**
  - **UI 切换:** 在 `CornerstoneStackViewerLab` 中添加了数据源切换按钮，允许用户在本地 API (`local`) 和 Orthanc DICOMweb (`orthanc-dicomweb`) 之间进行无缝切换。
  - **视图组件升级:** `CTStackViewer` 内部重构，新增了对 Orthanc 数据源清单（Manifest）的解析、URL 构建与标准化映射支持。
  - **API 代理:** 新增了一个 Next.js API 路由，利用 WADO 协议安全地从 Orthanc 服务器代理获取二进制格式的 DICOM 实例数据。
  - **客户端支持:** 在 `orthancClient` 中扩展了 `orthancFetchBytes` 方法，专门用于处理 DICOM 二进制文件的拉取。

## 2. 视觉概览 (代码与逻辑映射)

```mermaid
graph TD
  subgraph UI ["用户界面 (CornerstoneStackViewerLab.tsx)"]
    A["点击数据源切换按钮"] -->|setDataSource()| B["CTStackViewer 组件"]
  end

  subgraph Viewer ["视图逻辑 (CTStackViewer.tsx)"]
    B --> C{"buildManifestUrl()"}
    C -->|"local"| D["获取本地 Manifest"]
    C -->|"orthanc-dicomweb"| E["获取 Orthanc Manifest"]

    D --> F["normalizeLocalManifest()"]
    E --> G["normalizeOrthancManifest()"]
  end

  subgraph API ["后端代理与客户端 (route.ts & orthancClient.ts)"]
    G --> H["请求 DICOM 实例"]
    H --> I["API 路由 (GET)"]
    I -->|buildOrthancWadoUri()| J["orthancFetchBytes()"]
    J --> K[("Orthanc 服务器")]
  end

  classDef ui fill:#bbdefb,color:#0d47a1,stroke:#0d47a1,stroke-width:2px;
  classDef viewer fill:#c8e6c9,color:#1a5e20,stroke:#1a5e20,stroke-width:2px;
  classDef api fill:#fff3e0,color:#e65100,stroke:#e65100,stroke-width:2px;

  class UI,A,B ui;
  class Viewer,C,D,E,F,G viewer;
  class API,H,I,J,K api;
```

## 3. 详细变更分析

### 🎨 UI 与样式 (`CornerstoneStackViewerLab.tsx`, `globals.css`)

- **变更内容:** 引入了 `dataSource` 状态。增加了一组切换按钮，并在切换时改变传递给 `CTStackViewer` 的 `key`（利用 React 特性强制组件重新挂载）。新增了 `.viewer-lab-source-toggle` CSS 类来优化按钮组布局。

### 🧩 核心查看器逻辑 (`CTStackViewer.tsx`)

- **变更内容:** 重构了 Manifest 的加载与标准化逻辑，以兼容不同的数据源格式。引入了 `normalizeLocalManifest` 和 `normalizeOrthancManifest` 来将不同来源的数据统一为标准的 `CtStackManifest` 结构。
- **数据结构变更:**

| 类型/接口                   | 新增/修改内容                     | 描述                                                |
| --------------------------- | --------------------------------- | --------------------------------------------------- |
| `CtStackDataSource`         | `"local"` \| `"orthanc-dicomweb"` | 联合类型，定义了系统支持的数据源类型                |
| `CtStackManifest`           | `source?: CtStackDataSource`      | 标识当前解析后的数据源类型                          |
| `OrthancCtManifestResponse` | 全新类型定义                      | 强类型定义了从 Orthanc 接口返回的清单结构及实例字段 |

### 🌐 后端 API 与客户端 (`route.ts`, `orthancClient.ts`)

- **变更内容:**
  - `orthancClient.ts`: 新增了 `orthancFetchBytes` 方法。与现有的 JSON 请求不同，它专门设置 `Accept: application/dicom` 头，并返回 `ArrayBuffer` 以处理二进制数据。
  - `route.ts`: 新增了用于获取具体 DICOM 实例的代理路由，路径为 `app/api/dicomweb/lidc-case-002/instances/[sopInstanceUid]/dicom/route.ts`。
- **API 代理参数映射:**

| WADO 参数     | 值/来源                         | 描述                            |
| ------------- | ------------------------------- | ------------------------------- |
| `requestType` | `"WADO"`                        | 指定 Orthanc 请求协议类型       |
| `studyUID`    | `1.3.6.1.4.1.14519...` (硬编码) | LIDC-Case-002 的特定 Study UID  |
| `seriesUID`   | `1.3.6.1.4.1.14519...` (硬编码) | LIDC-Case-002 的特定 Series UID |
| `objectUID`   | 动态路由参数 `sopInstanceUid`   | 从 URL 中提取的当前切片实例 UID |
| `contentType` | `"application/dicom"`           | 指定响应的数据格式              |

## 4. 影响与风险评估

- ⚠️ **潜在限制:** 新增的 Orthanc 代理路由中硬编码了 `StudyInstanceUID` 和 `SeriesInstanceUID`。这在目前 `lidc-case-002` 的专属实验场景下是合理的，但如果未来需要将 Orthanc 支持推广到动态 Case，需将此路由重构为支持动态 UID 提取。
- ✨ **容错机制优化:** 代理路由中增加了完善的错误捕获机制 (`isUnavailableError`)，针对 502/503/504 以及 `ECONNREFUSED` 连接拒绝错误，前端将收到友好的 503 状态和提示语（例如：`"Start Orthanc with docker compose up -d."`），有效避免了应用直接崩溃。
- 🧪 **测试建议:**
  1. 验证在 **"Local API"** 和 **"Orthanc DICOMweb beta"** 之间频繁切换时，CT 图像序列能否正确加载且不产生内存/渲染上下文泄漏。
  2. 手动停止本地的 Orthanc Docker 容器，并选择 Orthanc 数据源，验证前端控制台和 UI 是否能优雅地捕获并展示 503 错误提示。
  3. 确认在 Orthanc 数据源模式下，切片滑动、窗宽窗位调整等所有 Cornerstone 交互工具均能正常运作。
