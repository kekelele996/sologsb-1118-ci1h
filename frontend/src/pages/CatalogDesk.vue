<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { ArchiveCheck, ArchiveConclusion, Stratum } from '@/types'
import { useStore } from '@/hooks/usePersistentStore'
import { useLayerSequence, type LayerSequenceItem } from '@/hooks/useLayerSequence'
import { stratumStore } from '@/stores/stratumStore'
import { trenchStore } from '@/stores/trenchStore'
import { artifactStore } from '@/stores/artifactStore'
import { relationStore } from '@/stores/relationStore'
import { catalogerStore } from '@/stores/catalogerStore'
import { runArchiveChecks } from '@/utils/archiveChecks'
import { uid } from '@/utils/id'

const stratumState = useStore(stratumStore)
const trenchState = useStore(trenchStore)
const artifactState = useStore(artifactStore)
const relationState = useStore(relationStore)
const catalogerState = useStore(catalogerStore)

const activeTab = ref('codes')

const { items: sequence, autoCount, manualCount } = useLayerSequence(
  computed(() => stratumState.strata),
  computed(() => catalogerState.catalogs)
)

function trenchLabel(trenchId: string): string {
  const trench = trenchState.trenches.find((item) => item.id === trenchId)
  return trench ? `${trench.area} · ${trench.code}` : '未知探方'
}

/** 编目草稿（统一单位号 / 裁定理由 / 手动序号），按地层单位 id 暂存 */
const drafts = reactive<Record<string, { unifiedCode: string; rationale: string; sequenceOrder: number | null }>>({})
function draftOf(stratum: Stratum) {
  if (!drafts[stratum.id]) {
    const catalog = catalogerState.catalogs.find((item) => item.stratumId === stratum.id)
    drafts[stratum.id] = {
      unifiedCode: catalog?.unifiedCode ?? stratum.code,
      rationale: catalog?.rationale ?? '',
      sequenceOrder: catalog?.sequenceOrder ?? null
    }
  }
  return drafts[stratum.id]
}

async function saveCatalog(stratum: Stratum): Promise<void> {
  const draft = draftOf(stratum)
  await catalogerStore.getState().saveCatalog({
    id: stratum.id,
    stratumId: stratum.id,
    unifiedCode: draft.unifiedCode.trim() || stratum.code,
    sequenceOrder: draft.sequenceOrder,
    rationale: draft.rationale,
    updatedAt: Date.now()
  })
  ElMessage.success(`已保存 ${stratum.code} 的编目成果`)
}

function pin(stratum: Stratum, order: number): void {
  draftOf(stratum).sequenceOrder = order
}
function unpin(stratum: Stratum): void {
  draftOf(stratum).sequenceOrder = null
}

/** 归档三核对 */
const checks = ref<ArchiveCheck[]>([])
function refreshChecks(): void {
  checks.value = runArchiveChecks(stratumState.strata, artifactState.artifacts, relationState.relations)
}
function checkType(check: ArchiveCheck): 'success' | 'danger' {
  return check.passed ? 'success' : 'danger'
}

/** 归档结论 */
const conclusionForm = reactive({ title: '', archivist: '', content: '' })
function resetConclusionForm(): void {
  conclusionForm.title = ''
  conclusionForm.archivist = ''
  conclusionForm.content = ''
}
async function createConclusion(): Promise<void> {
  if (!conclusionForm.title.trim()) {
    ElMessage.warning('请填写归档标题')
    return
  }
  const now = Date.now()
  const row: ArchiveConclusion = {
    id: uid('ar'),
    title: conclusionForm.title.trim(),
    content: conclusionForm.content.trim(),
    archivist: conclusionForm.archivist.trim(),
    status: 'draft',
    checks: [],
    createdAt: now,
    updatedAt: now,
    archivedAt: null
  }
  await catalogerStore.getState().saveConclusion(row)
  ElMessage.success('归档结论草稿已保存')
  resetConclusionForm()
}

async function archiveConclusion(conclusion: ArchiveConclusion): Promise<void> {
  const result = await catalogerStore.getState().archive(conclusion.id)
  if (result.ok) {
    ElMessage.success(`「${conclusion.title}」三核对通过，已归档`)
  } else {
    const failed = result.checks.filter((item) => !item.passed).map((item) => item.label)
    ElMessage.warning(`「${conclusion.title}」核对未通过（${failed.join('、')}），已挂起，请修正后重新归档`)
  }
}

const statusTag: Record<ArchiveConclusion['status'], { label: string; type: 'success' | 'warning' | 'info' }> = {
  draft: { label: '草稿', type: 'info' },
  archived: { label: '已归档', type: 'success' },
  suspended: { label: '已挂起', type: 'warning' }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">编目台</h2>
        <p class="page-sub">
          编目员专管统一单位号、跨探方层位序列与归档结论；原始观察（探方 / 地层 / 出土物 / 层位关系）由记录员维护，两端各写各的份，互不覆盖。
        </p>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="tabs">
      <!-- 统一单位号 -->
      <el-tab-pane label="统一单位号" name="codes">
        <el-alert
          class="alert"
          type="info"
          :closable="false"
          show-icon
          title="统一单位号由编目员给定，跨探方统一编号；记录员补录出土物、改动原始单位号不会带偏这里。"
        />
        <el-table :data="stratumState.strata" border stripe row-key="id">
          <el-table-column label="探方" width="150">
            <template #default="{ row }: { row: Stratum }">
              <span class="mono">{{ trenchLabel(row.trenchId) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="原始单位号（记录员）" width="170">
            <template #default="{ row }: { row: Stratum }">
              <span class="mono">{{ row.code }}</span>
              <el-tag size="small" effect="plain" type="info" class="mini">记录员</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="90" prop="type" />
          <el-table-column label="深度区间(m)" width="140">
            <template #default="{ row }: { row: Stratum }">
              <span class="mono">{{ row.topDepth }} – {{ row.bottomDepth }}</span>
            </template>
          </el-table-column>
          <el-table-column label="统一单位号（编目员）" min-width="200">
            <template #default="{ row }: { row: Stratum }">
              <el-input
                :model-value="draftOf(row).unifiedCode"
                placeholder="如 H12、L03"
                @update:model-value="(value: string) => (draftOf(row).unifiedCode = value)"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="110" fixed="right">
            <template #default="{ row }: { row: Stratum }">
              <el-button link type="primary" size="small" @click="saveCatalog(row)">保存</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 跨探方层位序列 -->
      <el-tab-pane name="sequence">
        <el-alert
          class="alert"
          type="info"
          :closable="false"
          show-icon
          :title="`跨探方层位序列按深度自动重算（自动 ${autoCount} 个 / 手动 ${manualCount} 个）：记录员一改上下界深度，序列立即重算；编目员写下的裁定理由照旧留着。`"
        />
        <el-table :data="sequence" border stripe row-key="stratum.id">
          <el-table-column label="序号" width="70">
            <template #default="{ row }: { row: LayerSequenceItem }">
              <b>{{ row.order }}</b>
            </template>
          </el-table-column>
          <el-table-column label="探方" width="150">
            <template #default="{ row }: { row: LayerSequenceItem }">
              <span class="mono">{{ trenchLabel(row.stratum.trenchId) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="原始单位号" width="110">
            <template #default="{ row }: { row: LayerSequenceItem }">
              <span class="mono">{{ row.stratum.code }}</span>
            </template>
          </el-table-column>
          <el-table-column label="统一单位号" width="130">
            <template #default="{ row }: { row: LayerSequenceItem }">
              <span class="mono">{{ row.unifiedCode }}</span>
            </template>
          </el-table-column>
          <el-table-column label="深度区间(m)" width="130">
            <template #default="{ row }: { row: LayerSequenceItem }">
              <span class="mono">{{ row.stratum.topDepth }} – {{ row.stratum.bottomDepth }}</span>
            </template>
          </el-table-column>
          <el-table-column label="排序方式" width="100">
            <template #default="{ row }: { row: LayerSequenceItem }">
              <el-tag v-if="row.manual" size="small" type="warning" effect="dark">手动</el-tag>
              <el-tag v-else size="small" type="success" effect="plain">自动</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="裁定理由（编目员）" min-width="240">
            <template #default="{ row }: { row: LayerSequenceItem }">
              <el-input
                type="textarea"
                :rows="2"
                :model-value="draftOf(row.stratum).rationale"
                placeholder="如 依据北壁剖面叠压关系，定为本区第②层"
                @update:model-value="(value: string) => (draftOf(row.stratum).rationale = value)"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="170" fixed="right">
            <template #default="{ row }: { row: LayerSequenceItem }">
              <el-button v-if="!row.manual" link type="primary" size="small" @click="pin(row.stratum, row.order)">置顶</el-button>
              <el-button v-else link type="info" size="small" @click="unpin(row.stratum)">取消手动</el-button>
              <el-button link type="primary" size="small" @click="saveCatalog(row.stratum)">保存理由</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 归档结论 -->
      <el-tab-pane label="归档结论" name="archive">
        <div class="archive-head">
          <el-button type="primary" plain @click="refreshChecks">重新核对</el-button>
          <span class="muted">归档前核对：跨探方叠压、单位号重复、出土物深度越界；对不上即挂起。</span>
        </div>

        <div v-if="checks.length > 0" class="check-grid">
          <el-card v-for="check in checks" :key="check.key" shadow="never" class="check-card">
            <div class="check-head">
              <span>{{ check.label }}</span>
              <el-tag :type="checkType(check)" size="small" effect="dark">
                {{ check.passed ? '通过' : '未通过' }}
              </el-tag>
            </div>
            <ul v-if="!check.passed" class="issue-list">
              <li v-for="(issue, index) in check.issues" :key="index">{{ issue }}</li>
            </ul>
            <p v-else class="muted">未发现问题</p>
          </el-card>
        </div>

        <el-card shadow="never" class="conclusion-form">
          <template #header>新增归档结论</template>
          <el-form label-width="90px">
            <el-form-item label="标题" required>
              <el-input v-model="conclusionForm.title" placeholder="如 Ⅱ区 T0501–T0502 地层归档" />
            </el-form-item>
            <el-form-item label="归档人">
              <el-input v-model="conclusionForm.archivist" placeholder="编目员署名" />
            </el-form-item>
            <el-form-item label="结论">
              <el-input v-model="conclusionForm.content" type="textarea" :rows="3" placeholder="归档结论说明" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="createConclusion">保存草稿</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never" class="conclusion-list">
          <template #header>归档结论清单（{{ catalogerState.conclusions.length }}）</template>
          <ul class="conclusion-items">
            <li v-for="conclusion in catalogerState.conclusions" :key="conclusion.id" class="conclusion-item">
              <div class="conclusion-top">
                <span class="conclusion-title">{{ conclusion.title }}</span>
                <el-tag :type="statusTag[conclusion.status].type" size="small" effect="plain">
                  {{ statusTag[conclusion.status].label }}
                </el-tag>
              </div>
              <p class="muted conclusion-meta">
                {{ conclusion.archivist || '未署名' }} · 更新于 {{ new Date(conclusion.updatedAt).toLocaleString('zh-CN') }}
              </p>
              <p v-if="conclusion.content" class="conclusion-content">{{ conclusion.content }}</p>
              <ul v-if="conclusion.status === 'suspended' && conclusion.checks.length" class="issue-list">
                <li v-for="check in conclusion.checks.filter((item) => !item.passed)" :key="check.key">
                  {{ check.label }}：{{ check.issues.join('；') }}
                </li>
              </ul>
              <div class="conclusion-ops">
                <el-button type="primary" size="small" @click="archiveConclusion(conclusion)">归档</el-button>
              </div>
            </li>
            <li v-if="catalogerState.conclusions.length === 0" class="muted">暂无归档结论</li>
          </ul>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.alert {
  margin-bottom: 14px;
}
.tabs {
  background: #fff;
  border-radius: 12px;
  padding: 12px 16px;
}
.mini {
  margin-left: 6px;
}
.archive-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.check-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.check-card {
  border-radius: 10px;
}
.check-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
}
.issue-list {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 12px;
  color: #c0392b;
  line-height: 1.7;
}
.conclusion-form {
  border-radius: 10px;
  margin-bottom: 16px;
}
.conclusion-list {
  border-radius: 10px;
}
.conclusion-items {
  margin: 0;
  padding: 0;
  list-style: none;
}
.conclusion-item {
  padding: 12px 0;
  border-bottom: 1px dotted #e6ded0;
}
.conclusion-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.conclusion-title {
  font-weight: 600;
}
.conclusion-meta {
  margin: 4px 0;
  font-size: 12px;
}
.conclusion-content {
  margin: 4px 0;
  font-size: 13px;
}
.conclusion-ops {
  margin-top: 8px;
}
</style>
