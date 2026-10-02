# 考古探方地层编目台（gbtrenchlog）

面向考古发掘工地的记录员与整理人员，把「探方 → 地层单位 → 堆积描述 → 层位关系 → 出土物」整理成一套可核对的编目档案，解决地层编号重复、打破与叠压关系记不清、出土物脱离层位上下文的问题。**纯前端单页应用**，全部数据保存在浏览器 IndexedDB，不依赖任何后端服务或外部接口。

> **双端数据分离**：工地记录员与整理室编目员各有一份数据库，只写各自拥有的表，对方数据以只读镜像存在，物理上无法互相覆盖。两个同步方向独立记账、失败后只重试本侧，另一侧照常能改。

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
│       ├── db/                  # fieldDb / officeDb / legacyDb（旧库只读）+ repo 仓储函数
│       ├── services/            # syncEngine 双向同步 / migration 首次迁移 / archiveCheck 归档核对 / demoData
│       ├── types/              # trench.ts / stratum.ts / artifact.ts / relation.ts / catalog.ts / index.ts
│       ├── stores/             # trench / stratum / artifact / relation（工地）+ office + fieldShadow + sync（Zustand）
│       ├── components/common/  # StratumDepthBar / RelationGraph / TrenchTag / UnitPicker / SyncBadge / MigrationOverlay
│       ├── hooks/              # useStratumOrder / useRelationGraph / usePersistentStore(仅 Vue 桥接)
│       ├── pages/              # Trenches / Strata / Artifacts / Relations / Sections（记录员）+ Catalog / Archive（编目员）+ Sync
│       ├── router/index.ts
│       └── utils/              # graph.ts / export.ts / id.ts
```

## 五、数据模型与存储（双端分离）

数据按归属拆成两个 IndexedDB 数据库，从根上解决「一个探方互相覆盖」：

| 库 | 拥有者 | 自有表（可写） | 对方镜像表（只读） |
| --- | --- | --- | --- |
| `gbtrenchlog-field` 工地库 | 工地记录员 | `trenches` 探方、`strata` 地层单位、`artifacts` 出土物、`relations` 层位关系 | `catalogShadows` 统一号/序号/理由 |
| `gbtrenchlog-office` 整理库 | 整理室编目员 | `unitCatalogs` 统一单位号·层位序号·裁定理由、`archives` 归档结论 | `trenchShadows` / `stratumShadows` / `artifactShadows` / `relationShadows` |

- 记录员补录出土物只写工地库，不可能带偏编目员定过的统一单位号；编目员重排层位只写整理库，不会冲掉刚录的原始观察。
- 同步方向有两条，各自独立状态机（`syncing/success/failed`）：
  - **工地 → 整理室**：写四张镜像表；若上下界深度有改动，**自动按深度重算跨探方层位序列序号**，编目员已写的统一单位号与**裁定理由原样保留**。
  - **整理室 → 工地**：只写 `catalogShadows`。
- 一侧同步失败只重试这一侧（同步中心「重试本侧」，可用故障注入开关演示），另一侧不锁定、照改不误；改动始终保存在各自库中，恢复后补推即可。
- **首次打开迁移**：旧的单库 `gbtrenchlog` 中缺归属的数据，先按归属分别写入两库（探方/地层/出土物/关系 → 工地库；为每个单位建编目行，统一号沿用工地号、序号按深度排、理由留空 → 整理库），两库都打上 `splitMigrated` 标记后才启用；旧库保留不动作为备份。全新用户则写入演示数据。
- 历史单库的 `version(2)` 升级（补齐「开口层位」）在遗留库连接中保留，以保证能正确读出旧数据。

## 六、主要页面

| 路由 | 归属 | 功能 |
| --- | --- | --- |
| `/trenches` | 记录员 | 探方清单：按「发掘区-探方号」校验唯一性，卡片显示单位数、出土物件数、关系数与发掘进度状态 |
| `/strata` | 记录员 | 地层单位编目表：按类型与深度区间筛选，层序倒置与单位号重复即时高亮；另只读展示整理室裁定的统一单位号 |
| `/artifacts` | 记录员 | 出土物登记与清单：先锁定所属地层单位（级联选择器），带出深度区间并校验出土深度是否在该区间内 |
| `/relations` | 记录员 | 层位关系视图：SVG 有向图展示叠压/打破，点击节点高亮直接关系，新增关系前做环路检测 |
| `/sections` | 记录员 | 四壁剖面示意：按深度刻度绘制地层条带与厚度标注，叠加出土物投影点 |
| `/catalog` | 编目员 | 跨探方统一编目：裁定统一单位号、查看自动重算的层位序号、写裁定理由；工地原始观察只读 |
| `/archive` | 编目员 | 归档结论：归档前三合一核对，对不上即挂起留痕，修正后重新核对解除 |
| `/sync` | 系统 | 同步中心：两侧独立同步、按侧重试、故障注入演示 |

## 七、校验规则

**保存即时校验（工地侧）**

- 同一「发掘区-探方号」只允许一个探方；
- 同一探方内单位号不可重复（保存时拒绝）；
- 上界深度大于下界深度即为**层序倒置**，编目表整行标红并在顶部汇总；
- 若「A 叠压/打破 B」但 A 的上界深度大于 B，则提示层位关系与深度矛盾；
- 新增层位关系前做**环路检测**（DFS），会形成闭合矛盾的关系直接拒绝保存；
- 出土物的 Z（深度）必须落在其所属地层单位的深度区间内，否则给出层位核对提示。

**归档前核对（整理室 `/archive`，三类问题任一存在即整单挂起）**

1. **跨探方叠压**：叠压/打破关系双方分属不同探方，且「压人者」的上界反而更深 → 矛盾；
2. **统一单位号重复 / 缺失**：统一单位号必须跨探方唯一，空号按缺失处理；
3. **出土物深度越界**：Z 不在所属单位上下界区间内（倒置写法取 min/max）。

附带检查悬空引用（关系或出土物指向已删单位、编目行对应工地单位已删除）。核对通过才能「归档」，否则只能「挂起留痕」；问题清单与归档结论随归档单一起保存，可对挂起单「重新核对」解除。
