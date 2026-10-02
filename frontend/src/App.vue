<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStore } from '@/hooks/usePersistentStore'
import { trenchStore } from '@/stores/trenchStore'
import { stratumStore } from '@/stores/stratumStore'
import { artifactStore } from '@/stores/artifactStore'
import { relationStore } from '@/stores/relationStore'
import { catalogerStore } from '@/stores/catalogerStore'
import { syncStore } from '@/stores/syncStore'
import { SIDE_LABELS, type Side } from '@/types'

const route = useRoute()
const trenchState = useStore(trenchStore)
const stratumState = useStore(stratumStore)
const artifactState = useStore(artifactStore)
const relationState = useStore(relationStore)
const catalogerState = useStore(catalogerStore)
const syncState = useStore(syncStore)

const menus = [
  { path: '/trenches', label: '探方清单', icon: 'Grid' },
  { path: '/strata', label: '地层单位编目', icon: 'Files' },
  { path: '/artifacts', label: '出土物登记', icon: 'Box' },
  { path: '/relations', label: '层位关系', icon: 'Share' },
  { path: '/catalog', label: '编目台', icon: 'Notebook' },
  { path: '/sections', label: '四壁剖面示意', icon: 'DataLine' }
]

const activeMenu = computed(() => menus.find((item) => route.path.startsWith(item.path))?.path ?? '/trenches')

const stats = computed(() => [
  { label: '探方', value: trenchState.trenches.length },
  { label: '地层单位', value: stratumState.strata.length },
  { label: '出土物', value: artifactState.artifacts.length },
  { label: '层位关系', value: relationState.relations.length },
  { label: '编目记录', value: catalogerState.catalogs.length }
])

const sides: Side[] = ['recorder', 'cataloger']
function sideStatus(side: Side): string {
  const count = syncState.counts[side]
  if (count.failed > 0) return `${count.failed} 失败`
  if (count.pending > 0) return `${count.pending} 待同步`
  return '已同步'
}
async function syncNow(side: Side): Promise<void> {
  await syncStore.getState().syncNow(side)
}
async function retry(side: Side): Promise<void> {
  await syncStore.getState().retry(side)
}
async function toggleSimulate(value: boolean): Promise<void> {
  await syncStore.getState().toggleSimulateFailure(value)
}

onMounted(async () => {
  await trenchStore.getState().hydrate()
  await stratumStore.getState().hydrate()
  await artifactStore.getState().hydrate()
  await relationStore.getState().hydrate()
  await catalogerStore.getState().hydrate()
  await syncStore.getState().hydrate()
})
</script>

<template>
  <el-container class="shell">
    <el-aside width="232px" class="aside">
      <div class="brand">
        <div class="logo">探</div>
        <div>
          <div class="brand-title">考古探方地层编目台</div>
          <div class="brand-sub">Trench & Stratum Log</div>
        </div>
      </div>
      <el-menu :default-active="activeMenu" router class="menu">
        <el-menu-item v-for="item in menus" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
      <div class="stat-box">
        <div v-for="item in stats" :key="item.label" class="stat-row">
          <span>{{ item.label }}</span>
          <b>{{ item.value }}</b>
        </div>
        <p class="stat-tip">数据保存在浏览器 IndexedDB，无需后端服务</p>
      </div>
      <div class="sync-box">
        <div class="sync-head">
          <span>两端同步</span>
          <el-tooltip content="打开后下一次同步会失败，可点重试；失败期间另一侧仍可正常编辑" placement="top">
            <el-switch
              :model-value="syncState.simulateFailure"
              active-text="模拟失败"
              inline-prompt
              size="small"
              @update:model-value="toggleSimulate"
            />
          </el-tooltip>
        </div>
        <div v-for="side in sides" :key="side" class="sync-row">
          <span class="sync-name">{{ SIDE_LABELS[side] }}</span>
          <el-tag
            size="small"
            effect="plain"
            :type="syncState.counts[side].failed > 0 ? 'danger' : syncState.counts[side].pending > 0 ? 'warning' : 'success'"
          >
            {{ sideStatus(side) }}
          </el-tag>
          <el-button
            v-if="syncState.counts[side].failed > 0"
            link
            type="danger"
            size="small"
            @click="retry(side)"
          >
            重试
          </el-button>
          <el-button v-else link type="primary" size="small" @click="syncNow(side)">同步</el-button>
        </div>
      </div>
    </el-aside>
    <el-container>
      <el-header class="header">
        <span class="crumb">{{ (route.meta.title as string) ?? '编目台' }}</span>
        <span class="head-tip">记录员管原始观察，编目员管统一编号与归档，两端各写各的份</span>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.shell {
  height: 100vh;
}
.aside {
  display: flex;
  flex-direction: column;
  background: #4a3722;
  color: #f4ead9;
  padding: 16px 12px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}
.logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #e0c168, #a9762f);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #3c2f1f;
}
.brand-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
}
.brand-sub {
  font-size: 11px;
  color: #cbb99f;
}
.menu {
  border-right: none;
  background: transparent;
}
:deep(.menu .el-menu-item) {
  color: #ecdfcb;
  border-radius: 8px;
  margin-bottom: 4px;
}
:deep(.menu .el-menu-item.is-active) {
  background: #a9762f;
  color: #fff;
}
:deep(.menu .el-menu-item:hover) {
  background: #5c452b;
}
.stat-box {
  margin-top: auto;
  padding: 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.07);
  font-size: 12px;
}
.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  color: #ecdfcb;
}
.stat-tip {
  margin: 8px 0 0;
  color: #bfae95;
  line-height: 1.6;
}
.sync-box {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.07);
  font-size: 12px;
}
.sync-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #ecdfcb;
}
.sync-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
}
.sync-name {
  color: #ecdfcb;
  flex: 1;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e6ded0;
}
.crumb {
  font-weight: 600;
}
.head-tip {
  font-size: 12px;
  color: #8a8073;
}
.main {
  padding: 0;
  overflow: auto;
}
</style>
