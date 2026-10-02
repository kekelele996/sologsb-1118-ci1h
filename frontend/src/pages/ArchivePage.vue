<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ARCHIVE_ISSUE_LABELS, type ArchiveIssue, type ArchiveRecord } from '@/types/catalog'
import { useStore } from '@/hooks/usePersistentStore'
import { officeStore } from '@/stores/officeStore'
import { deriveArchiveStatus, runArchiveCheck } from '@/services/archiveCheck'
import { uid } from '@/utils/id'
import SyncBadge from '@/components/common/SyncBadge.vue'

const office = useStore(officeStore)

const form = reactive({
  title: '',
  verdict: ''
})

const previewIssues = ref<ArchiveIssue[]>([])
const previewCheckedAt = ref('')
const previewStatus = ref<'passed' | 'suspended' | null>(null)

const issuesByType = computed(() => {
  const groups = new Map<ArchiveIssue['type'], ArchiveIssue[]>()
  previewIssues.value.forEach((issue) => {
    const list = groups.get(issue.type) ?? []
    list.push(issue)
    groups.set(issue.type, list)
  })
  return Array.from(groups.entries())
})

function check(): void {
  previewIssues.value = runArchiveCheck({
    trenches: office.trenchShadows,
    strata: office.stratumShadows,
    artifacts: office.artifactShadows,
    relations: office.relationShadows,
    catalogs: office.catalogs
  })
  previewStatus.value = deriveArchiveStatus(previewIssues.value)
  previewCheckedAt.value = new Date().toISOString()
  ElMessage[previewStatus.value === 'passed' ? 'success' : 'warning'](
    previewStatus.value === 'passed'
      ? '核对通过：可以写下归档结论'
      : `核对出 ${previewIssues.value.length} 个问题，归档单将挂起`
  )
}

async function archive(): Promise<void> {
  if (!form.title.trim()) {
    ElMessage.warning('请填写归档单标题')
    return
  }
  if (previewStatus.value === null) {
    ElMessage.warning('请先执行归档前核对')
    return
  }
  const record: ArchiveRecord = {
    id: uid('ar'),
    title: form.title.trim(),
    status: previewStatus.value,
    verdict: form.verdict.trim(),
    issues: previewIssues.value,
    checkedAt: previewCheckedAt.value
  }
  await officeStore.getState().saveArchive(record)
  ElMessage.success(record.status === 'passed' ? '归档结论已通过并保存' : '问题未对上，归档单已挂起')
  form.title = ''
  form.verdict = ''
  previewIssues.value = []
  previewStatus.value = null
  previewCheckedAt.value = ''
}

async function recheck(record: ArchiveRecord): Promise<void> {
  const issues = runArchiveCheck({
    trenches: office.trenchShadows,
    strata: office.stratumShadows,
    artifacts: office.artifactShadows,
    relations: office.relationShadows,
    catalogs: office.catalogs
  })
  const status = deriveArchiveStatus(issues)
  const next: ArchiveRecord = {
    ...record,
    issues,
    status,
    checkedAt: new Date().toISOString()
  }
  await officeStore.getState().saveArchive(next)
  ElMessage.success(status === 'passed' ? '复核已通过，挂起解除' : `仍有 ${issues.length} 个问题，继续挂起`)
}

async function remove(record: ArchiveRecord): Promise<void> {
  await ElMessageBox.confirm(`确认删除归档单「${record.title}」？`, '删除确认', { type: 'warning' })
  await officeStore.getState().removeArchive(record.id)
  ElMessage.success('归档单已删除')
}

function formatTime(value: string): string {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
}

const passedCount = computed(() => office.archives.filter((item) => item.status === 'passed').length)
const suspendedCount = computed(() => office.archives.filter((item) => item.status === 'suspended').length)

function issueLabelOf(type: ArchiveIssue['type']): string {
  return ARCHIVE_ISSUE_LABELS[type]
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">归档结论（整理室）</h2>
        <p class="page-sub">
          归档前把跨探方叠压、统一单位号重复、出土物深度越界一起核对；任何一项对不上，归档单自动挂起、问题留痕，修正后可复核解除。
        </p>
      </div>
      <div class="head-sync">
        <SyncBadge direction="fieldToOffice" label="工地→整理室" />
        <SyncBadge direction="officeToField" label="整理室→工地" />
      </div>
    </div>

    <div class="stat-row">
      <el-tag type="success" effect="plain" size="large">已通过 {{ passedCount }} 单</el-tag>
      <el-tag type="danger" effect="plain" size="large">挂起 {{ suspendedCount }} 单</el-tag>
    </div>

    <el-card shadow="never" class="check-card">
      <template #header>归档前核对</template>
      <el-form label-width="100px">
        <el-form-item label="归档单标题" required>
          <el-input v-model="form.title" placeholder="如 Ⅱ区 2026 年度阶段归档" />
        </el-form-item>
        <el-form-item label="归档结论">
          <el-input
            v-model="form.verdict"
            type="textarea"
            :rows="3"
            placeholder="编目员写下的归档结论；核对不通过时整单挂起，结论与问题清单一并留存"
          />
        </el-form-item>
      </el-form>
      <div class="actions">
        <el-button type="primary" @click="check">执行归档前核对</el-button>
        <el-button
          type="success"
          :disabled="previewStatus !== 'passed'"
          @click="archive"
        >
          核对通过，归档
        </el-button>
        <el-button type="warning" :disabled="previewStatus !== 'suspended'" @click="archive">
          对不上，挂起留痕
        </el-button>
      </div>

      <div v-if="previewStatus" class="result">
        <el-alert
          :type="previewStatus === 'passed' ? 'success' : 'error'"
          :closable="false"
          show-icon
          :title="previewStatus === 'passed' ? '三项核对全部通过' : `核对出 ${previewIssues.length} 个问题，归档挂起`"
          class="alert"
        />
        <div v-for="[type, list] in issuesByType" :key="type" class="issue-group">
          <h4>{{ issueLabelOf(type) }}（{{ list.length }}）</h4>
          <ul>
            <li v-for="(issue, index) in list" :key="index">{{ issue.message }}</li>
          </ul>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="list-card">
      <template #header>归档单（{{ office.archives.length }}）</template>
      <el-table :data="office.archives" border stripe row-key="id">
        <el-table-column prop="title" label="标题" min-width="180" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }: { row: ArchiveRecord }">
            <el-tag :type="row.status === 'passed' ? 'success' : 'danger'" effect="dark" size="small">
              {{ row.status === 'passed' ? '已通过' : '已挂起' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="问题数" width="90">
          <template #default="{ row }: { row: ArchiveRecord }">{{ row.issues.length }}</template>
        </el-table-column>
        <el-table-column prop="verdict" label="归档结论" min-width="200" show-overflow-tooltip />
        <el-table-column label="核对时间" width="170">
          <template #default="{ row }: { row: ArchiveRecord }">{{ formatTime(row.checkedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }: { row: ArchiveRecord }">
            <el-button link type="primary" size="small" @click="recheck(row)">重新核对</el-button>
            <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>暂无归档单</template>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.page-title {
  margin: 0 0 6px;
  font-size: 20px;
}
.page-sub {
  margin: 0;
  font-size: 13px;
  color: #8a8073;
  max-width: 760px;
  line-height: 1.7;
}
.head-sync {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.stat-row {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}
.check-card,
.list-card {
  border-radius: 12px;
  margin-bottom: 16px;
}
.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.result {
  margin-top: 16px;
}
.alert {
  margin-bottom: 10px;
}
.issue-group h4 {
  margin: 10px 0 4px;
  font-size: 13px;
  color: #a9762f;
}
.issue-group ul {
  margin: 0;
  padding-left: 20px;
  font-size: 12px;
  line-height: 1.9;
  color: #6b5b45;
}
</style>
