# 项目导览：从头熟悉当前项目

这份文档的目标不是讲“微调模型怎么接”，而是帮你先把**当前项目本身**看明白。

你可以把它当成一份“代码导游图”。

建议阅读顺序：

1. 先看根目录和整体分层
2. 再看页面路由怎么走
3. 再看页面背后用了哪些组件
4. 再看 `lib` 里的数据结构和 mock 数据
5. 最后看 API route 怎么把前端和数据层连起来

---

## 一、这个项目现在到底是什么

当前项目是一个：

**教学导向的最小版 AI Radiology Workstation 原型**

它现在还不是完整医疗影像系统，也不是完整 DICOM 工作站。

它当前的目标是先跑通一条最核心的产品链路：

`worklist -> workstation -> report -> research`

也就是：

- 从任务列表进入病例
- 在工作站里查看病例、finding、报告
- 进入报告页面看结构化报告
- 进入研究页面看“未来如何接模型”

---

## 二、先记住当前项目的分层

当前项目可以先粗略分成 6 层：

### 1. `app/`

这一层是 **Next.js App Router 页面和 API 路由层**。

它负责：

- 页面地址
- 页面入口
- 后端接口入口

你可以把它理解为“门面层”。

### 2. `components/`

这一层是 **页面真正显示出来的 UI 组件**。

它负责：

- 页面布局
- 交互逻辑
- 按钮点击后调 API

你可以把它理解为“界面层”。

### 3. `lib/domain/`

这一层是 **类型定义层**。

它负责：

- 规定 `Study` 是什么
- 规定 `Finding` 是什么
- 规定 `ReportAssistInput` 是什么

你可以把它理解为“全项目共用语言”。

### 4. `lib/mock/`

这一层是 **假数据和假后端逻辑层**。

它负责：

- 提供 mock 数据
- 模拟更新 finding
- 模拟生成报告草稿
- 模拟研究评测结果

你可以把它理解为“当前版本的假数据库 + 假服务层”。

### 5. `lib/ai/`

这一层是 **真实模型服务适配层**。

它负责：

- 把前端稳定的 `ReportAssistInput` 送到本地模型服务
- 把模型返回整理成 `ReportAssistOutput`
- 在模型服务不可用时回退到 mock 逻辑

你可以把它理解为“Next.js 和 Python 模型服务之间的转换器”。

### 6. `serve_report_draft.py`（本地 Python 模型服务）

这一层是 **可独立运行的本地推理/演示服务（推荐在 WSL 运行）**。

它负责：

- 提供 `POST /report-draft` 给 `ModelAdapter` 调用
- 支持 `mock / base / lora` 三种模式
- 当前对 Research 的胸片（`templateType: chest_xray_research`）做了更严格的 prompt 与后处理

你可以把它理解为“当前仓库内置的最小可跑通模型后端”。

---

## 三、根目录文件分别是干什么的

### [package.json](C:\Users\21258\Documents\New project\package.json)

作用：

- 定义项目名字
- 管理依赖
- 提供脚本命令

你最常用的是：

- `npm run dev`
- `npm run build`
- `npm run typecheck`

### [package-lock.json](C:\Users\21258\Documents\New project\package-lock.json)

作用：

- 锁定依赖版本

你一般不用手改它。

### [tsconfig.json](C:\Users\21258\Documents\New project\tsconfig.json)

作用：

- TypeScript 配置文件

这里最值得你注意的是：

- 开启了严格类型检查
- 配置了路径别名 `@/*`

所以你会看到代码里经常这样写：

```ts
import { getStudyBundle } from "@/lib/mock/repository";
```

### [next.config.ts](C:\Users\21258\Documents\New project\next.config.ts)

作用：

- Next.js 配置

现在内容很少，因为项目还很初级。

### [next-env.d.ts](C:\Users\21258\Documents\New project\next-env.d.ts)

作用：

- Next.js 自动生成的类型声明文件

不用手动改。

### [.gitignore](C:\Users\21258\Documents\New project\.gitignore)

作用：

- 告诉 Git 哪些文件不需要提交

比如：

- `node_modules`
- `.next`
- `tsconfig.tsbuildinfo`

### [README.md](C:\Users\21258\Documents\New project\README.md)

作用：

- 当前偏向“模型接入前准备”的学习说明

### [README_PROJECT_STRUCTURE.md](C:\Users\21258\Documents\New project\README_PROJECT_STRUCTURE.md)

作用：

- 也就是你现在正在看的这份
- 专门帮你熟悉当前项目结构

### [serve_report_draft.py](C:\Users\21258\Documents\New project\serve_report_draft.py)

作用：

- 本地 Python 模型服务（推荐在 WSL 运行）
- 对外提供 `POST /report-draft` 与 `GET /health`
- 目前主要用于 Research 页的胸片（CXR）报告草稿生成演示

---

## 四、页面路由怎么理解

这是你现在最需要熟悉的部分之一。

当前项目主要页面有这些：

### `/`

文件：

- [app/page.tsx](C:\Users\21258\Documents\New project\app\page.tsx)

作用：

- 根路径首页
- 这里没有真正页面内容
- 只是自动跳转到 `/worklist`

你可以理解成：

- 项目的真正入口不是首页，而是工作列表页

### `/worklist`

文件：

- [app/worklist/page.tsx](C:\Users\21258\Documents\New project\app\worklist\page.tsx)

作用：

- 任务列表页
- 用来展示有哪些病例
- 点击某一行后进入工作站页

你可以把它理解成：

- “病例入口页”

### `/workstation/[studyId]`

文件：

- [app/workstation/[studyId]/page.tsx](C:\Users\21258\Documents\New project\app\workstation\[studyId]\page.tsx)

作用：

- 某个具体病例的工作站页
- 根据 `studyId` 加载对应病例
- 把数据交给 `WorkstationClient`

你可以把它理解成：

- “病例主工作区入口”

这里的 `[studyId]` 是动态路由。

比如：

- `/workstation/study-ct-001`

### `/reports/[studyId]`

文件：

- [app/reports/[studyId]/page.tsx](C:\Users\21258\Documents\New project\app\reports\[studyId]\page.tsx)

作用：

- 某个病例的报告页
- 单独把结构化报告拉出来展示

你可以把它理解成：

- “报告单独查看页”

### `/research`

文件：

- [app/research/page.tsx](C:\Users\21258\Documents\New project\app\research\page.tsx)

作用：

- 模型接入前的研究页
- 展示固定测试样例、模型输入 payload、mock 输出、评估记录

你可以把它理解成：

- “研究工作台”

---

## 五、`app/` 目录每个文件的作用

### [app/layout.tsx](C:\Users\21258\Documents\New project\app\layout.tsx)

作用：

- 全局根布局
- 给整个应用包上 HTML 和 body
- 引入全局样式 `globals.css`

这是所有页面都会经过的一层。

### [app/globals.css](C:\Users\21258\Documents\New project\app\globals.css)

作用：

- 全局样式文件
- 定义颜色变量、按钮样式、面板样式、三栏布局、viewer 样式等

如果你想改：

- 整体配色
- 卡片样式
- 布局基础样式

就先看这个文件。

### [app/page.tsx](C:\Users\21258\Documents\New project\app\page.tsx)

作用：

- 根路由跳转到 `/worklist`

### [app/worklist/page.tsx](C:\Users\21258\Documents\New project\app\worklist\page.tsx)

作用：

- 渲染任务列表页
- 直接从 mock repository 取 worklist 数据
- 每条记录可以跳转到工作站

你读这个文件时重点看：

- 它怎么展示一个病例条目
- 它怎么把用户送到 `/workstation/[studyId]`

### [app/workstation/[studyId]/page.tsx](C:\Users\21258\Documents\New project\app\workstation\[studyId]\page.tsx)

作用：

- 根据 `studyId` 取单个病例 bundle
- 如果找不到，就走 `notFound`
- 如果找到了，就交给 `WorkstationClient`

这个文件自己很薄。

它的职责是：

- “拿数据”
- “把数据传给组件”

### [app/reports/[studyId]/page.tsx](C:\Users\21258\Documents\New project\app\reports\[studyId]\page.tsx)

作用：

- 根据 `studyId` 取单个病例 bundle
- 展示这个病例的结构化报告各 section

这个页目前还比较简单，重点在“把报告独立成单独页面”。

### [app/research/page.tsx](C:\Users\21258\Documents\New project\app\research\page.tsx)

作用：

- 加载评估样例和评估记录
- 交给 `ResearchWorkbenchClient`

这个文件和工作站页类似：

- 自己很薄
- 主要是“取数据 + 传给组件”

---

## 六、`components/` 目录每个文件的作用

当前组件很少，只有 3 个核心文件，所以很适合入门。

### [components/AppShell.tsx](C:\Users\21258\Documents\New project\components\AppShell.tsx)

作用：

- 整个应用的统一外壳
- 顶部导航栏就在这里

它负责：

- 显示项目标题
- 显示顶部导航链接
- 给当前页面高亮对应导航项

你可以把它理解成：

- “所有页面共用的头部框架”

### [components/WorkstationClient.tsx](C:\Users\21258\Documents\New project\components\WorkstationClient.tsx)

作用：

- 当前项目最核心的页面交互组件

它负责的事情很多：

- 管理当前选中的 finding
- 管理当前选中的 series
- 管理当前聚焦的 report section
- 调用 API 更新 finding 状态
- 调用 API 保存 report 文本
- 调用 API 插入 finding 到报告
- 调用 agent action 接口
- 调用 `ai-input` 接口预览模型输入

你可以把它理解成：

- “工作站页面的大脑”

这个文件内部主要分成几个区域：

- `Study Browser`
- `Series List`
- `Measurement Summary`
- `Viewer Workspace`
- `AI Input Readiness`
- `Action Log`
- `Findings Panel`
- `Report Workspace`
- `Agent Action Panel`

建议你读这个文件时，按这个顺序看：

1. 先看顶部 `useState`
2. 再看几个核心函数
3. 最后再看 return 里的布局

最值得先看的函数有：

- `refreshBundle`
- `focusFinding`
- `loadAiInputPreview`
- `updateFindingStatus`
- `insertFinding`
- `patchSection`
- `runAgentAction`

### [components/ResearchWorkbenchClient.tsx](C:\Users\21258\Documents\New project\components\ResearchWorkbenchClient.tsx)

作用：

- 研究页的主交互组件

它负责：

- 选择固定 eval case
- 选择当前要生成的是 `findings` 还是 `impression`
- 调用 `/api/ai/report-draft`
- 调用 `/api/ai/explain-finding`
- 展示输入 payload
- 展示输出结果
- 展示评估记录

你可以把它理解成：

- “模型研究实验台的前端控制器”

---

## 七、`lib/domain/` 目录做什么

### [lib/domain/index.ts](C:\Users\21258\Documents\New project\lib\domain\index.ts)

作用：

- 这里定义了项目最核心的 TypeScript 类型

你可以把它理解成：

- “全项目的数据字典”

当前最值得你先认识的类型分成两组。

### A. 工作站基础对象

- `Study`
- `Series`
- `Finding`
- `MeasurementSummary`
- `ReportSection`
- `ReportDraft`
- `WorkflowState`
- `ActionLogEntry`
- `StudyBundle`

它们负责描述：

- 一个病例是什么
- 一个序列是什么
- 一个 finding 是什么
- 报告长什么样
- 页面一次性加载的数据包长什么样

### B. 研究和模型接入对象

- `ImageRef`
- `FindingCardInput`
- `ReportAssistInput`
- `ReportAssistOutput`
- `ExplainFindingInput`
- `ExplainFindingOutput`
- `EvalCase`
- `EvalRunRecord`

它们负责描述：

- 模型吃什么
- 模型吐什么
- 评估样例长什么样
- 评估记录怎么记

如果你不知道该从哪里开始理解项目数据结构，先从：

- `StudyBundle`
- `ReportAssistInput`

这两个最有帮助。

---

## 八、`lib/mock/` 目录做什么

这层很重要，因为当前项目并没有真实数据库，也没有真实后端。

所以：

- 数据存在这里
- 假服务逻辑也在这里

### [lib/mock/data.ts](C:\Users\21258\Documents\New project\lib\mock\data.ts)

作用：

- 放所有 mock 原始数据

这里面现在有：

- `worklist`
- `studyBundles`
- `usReference`
- `imageRefsByStudy`
- `evalCases`
- `evalRunRecords`
- `aiInputExamples`

你可以把这个文件理解成：

- “项目的假数据库”

最值得你先看的几块是：

- `worklist`
- `studyBundles["study-ct-001"]`
- `evalCases`

因为它们最能代表当前项目的数据形状。

### [lib/mock/repository.ts](C:\Users\21258\Documents\New project\lib\mock\repository.ts)

作用：

- 对 mock 数据做“像后端一样”的操作

它负责：

- 读 worklist
- 读 study bundle
- 更新 finding 状态
- 更新 report section
- 往 report 插入 finding
- 生成模型输入
- mock 报告草稿输出
- mock finding 解释输出
- 返回评估样例和评估记录

你可以把它理解成：

- “假 service 层”

也就是：

- 页面和 API 不直接操作 `data.ts`
- 而是通过 `repository.ts`

这是一个很好的习惯，因为以后接真实数据库或真实模型时，替换成本更低。

---

## 九、`lib/ai/` 目录做什么

### [lib/ai/modelAdapter.ts](C:\Users\21258\Documents\New project\lib\ai\modelAdapter.ts)

作用：

- 当前最小真实模型接入层
- `/api/ai/report-draft` 会调用它
- 它会优先请求本地 Python 模型服务
- 如果模型服务失败，它会 fallback 到 `draftStructuredReport`

默认模型服务地址：

- `http://localhost:8000/report-draft`

对应本仓库内置的本地服务脚本：

- [serve_report_draft.py](C:\Users\21258\Documents\New project\serve_report_draft.py)

可以通过 `.env.local` 覆盖：

```bash
REPORT_DRAFT_MODEL_URL=http://localhost:8000/report-draft
MODEL_ADAPTER_TIMEOUT_MS=20000
MODEL_ADAPTER_ENABLED=true
```

---

## 十、API 路由怎么理解

现在你需要建立一个观念：

**`app/api/.../route.ts` 就是这个项目的后端接口入口。**

虽然它和前端写在同一个仓库里，但逻辑上它就是“接口层”。

---

## 十一、`app/api/` 目录每个文件的作用

### 1. worklist 相关

#### [app/api/worklist/route.ts](C:\Users\21258\Documents\New project\app\api\worklist\route.ts)

作用：

- 返回任务列表

对应页面：

- `/worklist`

---

### 2. study 主数据相关

#### [app/api/studies/[studyId]/route.ts](C:\Users\21258\Documents\New project\app\api\studies\[studyId]\route.ts)

作用：

- 返回单个病例的完整 bundle

这里的 bundle 包括：

- study
- series
- findings
- measurements
- report
- workflow
- actionLogs

这个接口非常重要，因为 `WorkstationClient` 会反复刷新它。

---

### 3. findings 相关

#### [app/api/studies/[studyId]/findings/route.ts](C:\Users\21258\Documents\New project\app\api\studies\[studyId]\findings\route.ts)

作用：

- 返回当前病例的 findings 列表和 grouped counts

#### [app/api/studies/[studyId]/findings/[findingId]/confirm/route.ts](C:\Users\21258\Documents\New project\app\api\studies\[studyId]\findings\[findingId]\confirm\route.ts)

作用：

- 把某个 finding 标记成 `confirmed`

#### [app/api/studies/[studyId]/findings/[findingId]/dismiss/route.ts](C:\Users\21258\Documents\New project\app\api\studies\[studyId]\findings\[findingId]\dismiss\route.ts)

作用：

- 把某个 finding 标记成 `dismissed`

---

### 4. report 相关

#### [app/api/studies/[studyId]/report/route.ts](C:\Users\21258\Documents\New project\app\api\studies\[studyId]\report\route.ts)

作用：

- `GET`：返回 report
- `PATCH`：更新某个 section 的文本

#### [app/api/studies/[studyId]/report/insert-finding/route.ts](C:\Users\21258\Documents\New project\app\api\studies\[studyId]\report\insert-finding\route.ts)

作用：

- 把某个 finding 的 narrative 插进 report findings section

---

### 5. agent 相关

#### [app/api/studies/[studyId]/agent/actions/route.ts](C:\Users\21258\Documents\New project\app\api\studies\[studyId]\agent\actions\route.ts)

作用：

- 接收 agent action 请求
- 当前支持：
  - `focusFinding`
  - `draftReport`
  - `getMeasurementSummary`

它现在本质上还是 mock，但已经把“动作接口”这个形状先立住了。

---

### 6. AI 输入准备相关

#### [app/api/studies/[studyId]/ai-input/route.ts](C:\Users\21258\Documents\New project\app\api\studies\[studyId]\ai-input\route.ts)

作用：

- 把一个 study 整理成模型可使用的输入

这个接口很重要，因为它是：

- 工作站对象层
- 模型输入层

之间的桥。

---

### 7. 研究 AI 接口相关

#### [app/api/ai/report-draft/route.ts](C:\Users\21258\Documents\New project\app\api\ai\report-draft\route.ts)

作用：

- 给定 `ReportAssistInput`
- 返回 `{ provider, fallbackUsed, requestDurationMs, serviceMode, output: ReportAssistOutput }`
- 当前通过 `lib/ai/modelAdapter.ts` 优先调用本地模型服务
- 模型服务不可用时自动回退到 mock 输出

#### [app/api/ai/explain-finding/route.ts](C:\Users\21258\Documents\New project\app\api\ai\explain-finding\route.ts)

作用：

- 给定单个 finding 的解释输入
- 返回解释结果

#### [app/api/ai/evals/route.ts](C:\Users\21258\Documents\New project\app\api\ai\evals\route.ts)

作用：

- 返回研究页用的固定 eval case 和 eval 记录

---

### 8. 研究图片代理相关

#### [app/api/images/[imageId]/route.ts](C:\Users\21258\Documents\New project\app\api\images\[imageId]\route.ts)

作用：

- Research 页预览胸片 key image 的本地代理接口
- 把 eval case 中形如 `file:///mnt/e/...` 的 URI 映射成 Windows 本地盘符（如 `E:\...`）并读文件返回
- 只用于 demo/研究阶段，避免前端直接访问本地文件系统路径

---

## 十二、项目现在的完整数据流是怎样的

这个部分你一定要搞清楚。

以工作站页为例，当前数据流是：

1. 浏览器打开 `/workstation/study-ct-001`
2. [app/workstation/[studyId]/page.tsx](C:\Users\21258\Documents\New project\app\workstation\[studyId]\page.tsx) 调用 `getStudyBundle`
3. `bundle` 被传给 [components/WorkstationClient.tsx](C:\Users\21258\Documents\New project\components\WorkstationClient.tsx)
4. 用户在页面里点按钮
5. `WorkstationClient` 调用 `/api/...`
6. API route 再去调用 [lib/mock/repository.ts](C:\Users\21258\Documents\New project\lib\mock\repository.ts)
7. `repository.ts` 修改或读取 [lib/mock/data.ts](C:\Users\21258\Documents\New project\lib\mock\data.ts) 里的 mock 数据
8. API 返回结果
9. 前端刷新 bundle 或更新局部状态

一句话总结：

**页面组件不直接改假数据，而是通过 API 和 repository 间接完成。**

这点很重要，因为以后替换成真实后端时更自然。

---

以 Research（胸片/CXR）为例，当前数据流是：

1. 浏览器打开 `/research`
2. [app/research/page.tsx](C:\Users\21258\Documents\New project\app\research\page.tsx) 加载固定 eval cases 与记录
3. [components/ResearchWorkbenchClient.tsx](C:\Users\21258\Documents\New project\components\ResearchWorkbenchClient.tsx) 选择样例并发起请求
4. 预览 key image：前端请求 `GET /api/images/[imageId]`，由 Next.js 读取本地图片并返回给 `<img>`
5. 生成草稿：前端 `POST /api/ai/report-draft`
6. [lib/ai/modelAdapter.ts](C:\Users\21258\Documents\New project\lib\ai\modelAdapter.ts) 转发到本地模型服务 `POST http://localhost:8000/report-draft`
7. 本地服务（[serve_report_draft.py](C:\Users\21258\Documents\New project\serve_report_draft.py)）返回 `ReportAssistOutput`（或失败时由 ModelAdapter fallback）
8. Research 页展示 `output` 与元信息（provider / serviceMode / duration / fallback reason）

---

## 十三、你现在最推荐的读代码顺序

如果你想从头到尾理解这个项目，我建议你按下面顺序读：

### 第一遍：先看“页面骨架”

1. [app/layout.tsx](C:\Users\21258\Documents\New project\app\layout.tsx)
2. [components/AppShell.tsx](C:\Users\21258\Documents\New project\components\AppShell.tsx)
3. [app/worklist/page.tsx](C:\Users\21258\Documents\New project\app\worklist\page.tsx)
4. [app/workstation/[studyId]/page.tsx](C:\Users\21258\Documents\New project\app\workstation\[studyId]\page.tsx)
5. [app/reports/[studyId]/page.tsx](C:\Users\21258\Documents\New project\app\reports\[studyId]\page.tsx)
6. [app/research/page.tsx](C:\Users\21258\Documents\New project\app\research\page.tsx)

目标：

- 先知道有哪些页面
- 每个页面负责什么

### 第二遍：看“页面核心交互”

1. [components/WorkstationClient.tsx](C:\Users\21258\Documents\New project\components\WorkstationClient.tsx)
2. [components/ResearchWorkbenchClient.tsx](C:\Users\21258\Documents\New project\components\ResearchWorkbenchClient.tsx)

目标：

- 先理解用户点击之后会发生什么

### 第三遍：看“数据长什么样”

1. [lib/domain/index.ts](C:\Users\21258\Documents\New project\lib\domain\index.ts)
2. [lib/mock/data.ts](C:\Users\21258\Documents\New project\lib\mock\data.ts)

目标：

- 先理解所有页面背后共用的数据结构

### 第四遍：看“假后端怎么工作”

1. [lib/mock/repository.ts](C:\Users\21258\Documents\New project\lib\mock\repository.ts)
2. [lib/ai/modelAdapter.ts](C:\Users\21258\Documents\New project\lib\ai\modelAdapter.ts)
3. `app/api/.../route.ts` 全部扫一遍

目标：

- 先理解接口层和数据层怎么连接

---

## 十四、当前项目最值得你先掌握的 6 个文件

如果你现在时间有限，只先吃透 6 个文件，我建议是：

1. [components/WorkstationClient.tsx](C:\Users\21258\Documents\New project\components\WorkstationClient.tsx)
2. [lib/domain/index.ts](C:\Users\21258\Documents\New project\lib\domain\index.ts)
3. [lib/mock/data.ts](C:\Users\21258\Documents\New project\lib\mock\data.ts)
4. [lib/mock/repository.ts](C:\Users\21258\Documents\New project\lib\mock\repository.ts)
5. [lib/ai/modelAdapter.ts](C:\Users\21258\Documents\New project\lib\ai\modelAdapter.ts)
6. [app/api/studies/[studyId]/route.ts](C:\Users\21258\Documents\New project\app\api\studies\[studyId]\route.ts)

原因是：

- 第 1 个让你理解 UI 主流程
- 第 2 个让你理解数据字典
- 第 3 个让你看到真实例子
- 第 4 个让你理解业务逻辑
- 第 5 个让你理解真实模型服务如何接入
- 第 6 个让你理解页面如何拿到 bundle

---

## 十五、你现在最容易混淆的几个点

### 1. 页面文件和组件文件不是一回事

比如：

- `app/workstation/[studyId]/page.tsx` 是页面入口
- `components/WorkstationClient.tsx` 是真正干活的 UI 组件

### 2. `data.ts` 和 `repository.ts` 不是一回事

- `data.ts` 放数据本身
- `repository.ts` 放“怎么操作这些数据”

### 3. `app/api/...` 是接口，不是普通工具函数

它们是页面会调用的后端入口。

### 4. `lib/domain/index.ts` 不是页面代码

它只是定义“对象长什么样”。

---

## 十六、你现在可以怎么自己练习熟悉项目

建议你按这个小练习顺序来：

1. 先打开 `/worklist`
2. 点进 `/workstation/study-ct-001`
3. 观察左中右三区分别对应哪个代码区域
4. 再去看 `WorkstationClient.tsx`
5. 找到“Confirm / Dismiss / Insert / draftReport”这些按钮对应的函数
6. 再去找这些函数调用了哪个 `/api/...`
7. 最后再去对应的 `repository.ts` 找真实逻辑

如果你这样走一遍，你对这个项目的基本结构会比直接硬读文件快很多。

---

## 十七、当前项目仍然是“最小版”

最后提醒一下：

当前项目是为了教学和研究起步而搭的最小骨架，所以它还没有这些东西：

- Zustand store
- 真正的 context bus
- 真正的 viewer adapter
- Cornerstone
- Orthanc / DICOMweb
- 真实数据库
- 真实模型服务

但这不妨碍它已经成为一个很好的学习底座。

因为你现在最需要的不是“大而全”，而是：

**先知道当前这套代码到底怎么组织、页面怎么跑、路由怎么串、数据怎么流。**

做到这一步之后，再继续往更复杂的工作站演进会轻松很多。
