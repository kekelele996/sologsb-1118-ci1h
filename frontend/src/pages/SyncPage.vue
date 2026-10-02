<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useStore } from '@/hooks/usePersistentStore'
import { syncStore } from '@/stores/syncStore'
import type { SyncDirection } from '@/services/syncEngine'
import SyncBadge from '@/components/common/SyncBadge.vue'

const sync = useStore(syncStore)

interface SideCard {
  direction: SyncDirection
  title: string
  desc: string
  carries: string
  fault: boolean
}

const sides = computed<SideCard[]>(() => [
  {
    direction: 'fieldToOffice',
    title: '工地记录员 → 整理室编目员',
    desc: '记录员补录/改动（探方、地层单位、出土物、层位关系、上下界深度）推送到整理室镜像；深度变化同时重算层位序列。',
    carries: '探方 / 地层单位 / 出土物 / 层位关系',
    fault: sync.isFaulted('fieldToOffice')
  },
  {
    direction: 'officeToField',
    title: '整理室编目员 → 工地记录员',
    desc: '编目员裁定的统一单位号、层位序号、裁定理由推送到工地镜像；不触碰任何原始观察行。',
    carries: '统一单位号 / 跨探方层位序号 / 裁定理由',
    fault: sync.isFaulted('officeToField')
  }
])

function statusText(direction: SyncDirection): string {
  const side = sync[direction]
  if (side.running) return '正在同步…'
  switch (side.phase) {
    case 'success':
      return '上次同步成功'
    case 'failed':
      return '上次同步失败（本侧重试，另一侧不受影响）'
    default:
      return '尚未同步'
  }
}

function timeOf(direction: SyncDirection, kind: 'success' | 'error'): string {
  const side = sync[direction]
  const value = kind === 'success' ? side.lastSuccessAt : side.lastErrorAt
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
}

async function retry(direction: SyncDirection): Promise<void> {
  // 演示「同步失败后按侧重试」：只重试选中方向
  await syncStore.getState().sync(direction)
  const side = syncStore.getState()[direction]
  if (side.phase === 'success') ElMessage.success('本侧重试成功')
  else ElMessage.error('本侧仍未成功，请稍后继续重试；另一侧数据照改不误')
}

async function syncNow(direction: SyncDirection): Promise<void> {
  await syncStore.getState().sync(direction)
}

function toggleFault(direction: SyncDirection, value: boolean | string | number): void {
  const enabled = Boolean(value)
  syncStore.getState().setFault(direction, enabled)
  if (enabled) ElMessage.info('已为该侧注入同步故障：下次同步会失败，可按侧重试')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">同步中心</h2>
        <p class="page-sub">
          两份数据各写各的库，互不可覆盖；两个同步方向独立跑、独立记账。一侧同步失败后只重试这一侧，另一侧照常能改。
        </p>
      </div>
      <el-button type="primary" :loading="sync.fieldToOffice.running || sync.officeToField.running" @click="syncStore.getState().syncAll()">
        两侧各自同步
      </el-button>
    </div>

    <el-alert class="alert" type="info" :closable="false" show-icon
      title="故障隔离：工地→整理室失败不锁定整理室；整理室→工地失败也不锁定工地。失败期间的改动在各自库里完整保留，恢复后点「重试本侧」即可补推。" />

    <div class="cards">
      <el-card v-for="side in sides" :key="side.direction" shadow="never" class="side-card">
        <template #header>
          <div class="card-head">
            <span>{{ side.title }}</span>
            <SyncBadge :direction="side.direction" :label="side.direction === 'fieldToOffice' ? '工地→整理室' : '整理室→工地'" />
          </div>
        </template>
        <p class="desc">{{ side.desc }}</p>
        <el-descriptions :column="1" size="small" border>
          <el-descriptions-item label="同步内容">{{ side.carries }}</el-descriptions-item>
          <el-descriptions-item label="当前状态">{{ statusText(side.direction) }}</el-descriptions-item>
          <el-descriptions-item label="最近成功">{{ timeOf(side.direction, 'success') }}</el-descriptions-item>
          <el-descriptions-item label="最近失败">{{ timeOf(side.direction, 'error') }}</el-descriptions-item>
        </el-descriptions>
        <el-alert
          v-if="sync[side.direction].phase === 'failed'"
          type="error"
          :closable="false"
          show-icon
          class="err"
          :title="sync[side.direction].lastError"
        />
        <div class="ops">
          <el-button type="primary" size="small" :loading="sync[side.direction].running" @click="syncNow(side.direction)">
            同步本侧
          </el-button>
          <el-button
            type="warning"
            size="small"
            :disabled="sync[side.direction].phase !== 'failed'"
            @click="retry(side.direction)"
          >
            重试本侧
          </el-button>
          <div class="fault">
            <span class="muted">故障注入（演示失败/重试）</span>
            <el-switch :model-value="side.fault" @update:model-value="(value: boolean | string | number) => toggleFault(side.direction, value)" />
          </div>
        </div>
      </el-card>
    </div>
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
.alert {
  margin-bottom: 16px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}
.side-card {
  border-radius: 12px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-weight: 600;
}
.desc {
  font-size: 12px;
  color: #6b5b45;
  line-height: 1.8;
  margin: 0 0 12px;
}
.err {
  margin-top: 12px;
}
.ops {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  flex-wrap: wrap;
}
.fault {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.muted {
  font-size: 12px;
  color: #a99e8e;
}
</style>
