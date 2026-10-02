# 考古探方地层编目台（gbtrenchlog）

面向考古发掘工地的记录员与整理人员，把「探方 → 地层单位 → 堆积描述 → 层位关系 → 出土物」整理成一套可核对的编目档案，解决地层编号重复、打破与叠压关系记不清、出土物脱离层位上下文的问题。**纯前端单页应用**，全部数据保存在浏览器 IndexedDB，不依赖任何后端服务或外部接口。

## 一、Docker 一键启动（推荐）

```bash
cp .env.example .env      # 首次启动先复制环境变量文件
docker compose up -d --build
```

启动后访问：<http://localhost:21818>

```bash
docker compose ps        # 查看容器状态
docker compose logs -f   # 查看日志
docker compose down      # 停止并移除容器（数据在浏览器本地）
```

`.env` 可调：

```
COMPOSE_PROJECT_NAME=gbtrenchlog
FRONTEND_PORT=21818
```

## 二、技术栈

| 层次 | 选型 |
| --- | --- |
| 框架 | Vue 3（Composition API） |
| 语言 | TypeScript（`vue-tsc` 类型检查零错误） |
| UI 组件库 | Element Plus |
| 状态管理 | Zustand（`zustand/vanilla` createStore + Vue 响应式桥接） |
| 路由 | Vue Router 4（History 模式，nginx `try_files` 回落） |
| 构建 | Vite 6 |
| 本地存储 | IndexedDB（Dexie 封装，含 `schemaVersion` 与升级迁移） |
| 部署 | 多阶段 Dockerfile：`node:20-alpine` 构建 → `nginx:alpine` 托管 |

## 三、本地开发

```bash
cd frontend
npm install
npm run dev        # http://localhost:21818
npm run build      # 类型检查 + 生产构建
```

## 四、目录结构

```
sologsb-1118/
├── docker-compose.yml          # 顶层 name: gbtrenchlog，无 version 字段
├── .env.example                # COMPOSE_PROJECT_NAME / FRONTEND_PORT
├── frontend/
│   ├── Dockerfile              # 多阶段构建，nginx 阶段 chmod -R a+rX 静态资源
│   ├── nginx.conf              # try_files 前端路由回落 + gzip
│   ├── public/favicon.svg
│   └── src/
│       ├── types/              # trench.ts / stratum.ts / artifact.ts / relation.ts / index.ts
│       ├── stores/             # trenchStore / stratumStore / artifactStore / relationStore（Zustand）
│       ├── components/common/  # StratumDepthBar / RelationGraph / TrenchTag / UnitPicker
│       ├── hooks/              # useStratumOrder / useRelationGraph / usePersistentStore
│       ├── pages/              # TrenchesPage / StrataPage / ArtifactsPage / RelationsPage / SectionsPage
│       ├── router/index.ts
│       └── utils/              # graph.ts / export.ts / id.ts
```

## 五、数据模型与存储

| 模型 | 说明 | Dexie 表 |
| --- | --- | --- |
| Trench 探方 | 探方号、发掘区、规格、基点坐标、开口层位、发掘起止、负责人、四壁备注、是否回填 | `trenches` |
| Stratum 地层单位 | 单位号、类型（地层/灰坑/房址/沟/墓葬）、开口层位、上下界深度、土质土色、包含物、堆积成因、绘图拍照号；另含编目员维护的统一单位号、跨探方层位序号、裁定理由 | `strata`（共享视图） |
| Artifact 出土物 | 所属地层单位、器物编号、类别、件数、残整程度、探方内 X/Y/Z、出土日期、提取人、临时存放 | `artifacts` |
| Relation 层位关系 | 单位 A、关系类型（叠压/打破/共存）、单位 B、判定依据、记录人、备注 | `relations` |
| CatalogRecord 编目记录 | 与地层单位 1:1，编目员端拥有：统一单位号、手动层位序号、裁定理由 | `catalogRecords` |
| ArchiveConclusion 归档结论 | 编目员端拥有：标题、归档人、结论、状态（草稿/已归档/已挂起）、三核对结果 | `archiveConclusions` |
| OutboxItem 同步发件箱 | 两端同步队列：端、表、操作、状态（待同步/已同步/失败）、重试次数、错误信息 | `outbox` |

- 数据库名 `gbtrenchlog`，`meta` 表保存 `schemaVersion` 与 `ownershipMigrated`（首次打开迁移标记）；
- `version(2)` 升级迁移会为历史地层单位补齐「开口层位」字段并规范包含物数组；
- `version(3)` 新增编目记录、归档结论、同步发件箱三张表；首次打开时把无归属的历史数据迁移到记录员 / 编目员两端；
- 数据仅存于浏览器本地，容器无状态、不挂载命名卷。

## 六、主要页面

| 路由 | 功能 |
| --- | --- |
| `/trenches` | 探方清单：按「发掘区-探方号」校验唯一性，卡片显示单位数、出土物件数、关系数与发掘进度状态 |
| `/strata` | 地层单位编目表（记录员端）：维护原始观察（单位号、类型、上下界深度、土质土色、包含物等）；编目员给定的统一单位号只读展示，记录员不可改 |
| `/artifacts` | 出土物登记与清单：先锁定所属地层单位（级联选择器），带出深度区间并校验出土深度是否在该区间内 |
| `/relations` | 层位关系视图：SVG 有向图展示叠压/打破，点击节点高亮直接关系，新增关系前做环路检测 |
| `/catalog` | 编目台（编目员端）：给定统一单位号；跨探方层位序列按深度自动重算（手动置顶优先），裁定理由持久保留；归档前三核对（跨探方叠压 / 单位号重复 / 出土物深度越界），对不上即挂起 |
| `/sections` | 四壁剖面示意：按深度刻度绘制地层条带与厚度标注，叠加出土物投影点 |

## 八、两端分治（记录员 / 编目员）

编目台只有一份数据，记录员与编目员常在同一探方上互相覆盖。为此把数据按归属拆成两端，各写各的份，通过发件箱（outbox）同步合并：

| 端 | 拥有的字段 | 说明 |
| --- | --- | --- |
| 记录员端 `recorder` | 探方、地层单位原始字段（`code` / `type` / `openLayer` / `topDepth` / `bottomDepth` / `soil` / `inclusions` / `formation` / `date` / `drawingNo`）、出土物、层位关系 | 补录出土物、改动原始单位号不会带偏统一单位号 |
| 编目员端 `cataloger` | 统一单位号 `unifiedCode`、跨探方层位序号 `sequenceOrder`、裁定理由 `rationale`（编目记录 `catalogRecords`）、归档结论 `archiveConclusions` | 重排层位、写裁定理由不会冲掉原始观察 |

- **字段级合并**：同步时记录员端只写原始字段、编目员端只写编目字段（`RECORDER_STRATUM_KEYS` / `CATALOG_STRATUM_KEYS`），任何一端都不会覆盖另一端的份。
- **深度改动 → 序列重算、理由保留**：跨探方层位序列按记录员维护的上下界深度自动重算；编目员写下的裁定理由是持久化字段，重算不丢失。
- **归档前三核对**：归档前一起核对跨探方叠压（叠压/打破与深度是否矛盾）、单位号重复（同一探方内统一单位号）、出土物深度越界（Z 深度是否落入所属单位区间）；任一不过则归档挂起，列出问题，修正后可重新归档。
- **同步失败重试**：每端独立发件箱，本地编辑立即生效（乐观更新）再入箱同步；同步失败时该端标记「失败」，可按侧重试（该端字段在合并中优先），期间另一侧仍可正常编辑。侧栏「两端同步」面板可查看各端状态、同步/重试，并提供「模拟失败」开关演示重试流程。
- **首次打开迁移**：已有数据没有归属，首次打开时（`meta.ownershipMigrated` 标记）按每个地层单位的原始单位号播种一条编目记录（统一单位号），把数据迁移到两端后再启用。

## 七、校验规则

- 同一「发掘区-探方号」只允许一个探方；
- 同一探方内单位号不可重复（保存时拒绝）；
- 上界深度大于下界深度即为**层序倒置**，编目表整行标红并在顶部汇总；
- 若「A 叠压/打破 B」但 A 的上界深度大于 B，则提示层位关系与深度矛盾；
- 新增层位关系前做**环路检测**（DFS），会形成闭合矛盾的关系直接拒绝保存；
- 出土物的 Z（深度）必须落在其所属地层单位的深度区间内，否则给出层位核对提示。
