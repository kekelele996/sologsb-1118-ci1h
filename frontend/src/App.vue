<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useStore } from '@/hooks/usePersistentStore'
import { trenchStore } from '@/stores/trenchStore'
import { stratumStore } from '@/stores/stratumStore'
import { artifactStore } from '@/stores/artifactStore'
import { relationStore } from '@/stores/relationStore'
import { officeStore } from '@/stores/officeStore'
import { fieldShadowStore } from '@/stores/fieldShadowStore'
import { syncStore } from '@/stores/syncStore'
import { migrateSplitStores, type MigrationState, type MigrationStage } from '@/services/migration'
import MigrationOverlay from '@/components/common/MigrationOverlay.vue'
import SyncBadge from '@/components/common/SyncBadge.vue'

const route = useRoute()

const initial = inject<MigrationState | null>('migrationState', null)
const migrationStage = ref<MigrationStage>(initial?.stage ?? 'checking')
const migrationSource = ref<MigrationState['source']>(initial?.source ?? 'none')
const migrationError = ref(initial?.error ?? '')
const retrying = ref(false)

/** 迁移成功后才启用工作台 */
const ready = computed(() => migrationStage.value === 'done')

async function retryMigration(): Promise<void> {
  retrying.value = true
  const result = await migrateSplitStores((stage) => (migrationStage.value = stage))
  migrationSource.value = result.source
  migrationError.value = result.error
  retrying.value = false
  if (result.stage === 'done') {
    await Promise.all([
      trenchStore.getState().hydrate(),
      stratumStore.getState().hydrate(),
      artifactStore.getState().hydrate(),
      relationStore.getState().hydrate(),
      officeStore.getState().hydrate(),
      fieldShadowStore.getState().hydrate()
    ])
    ElMessage.success('两端数据迁移完成，已启用')
  }
}

const trenchState = useStore(trenchStore)
const stratumState = useStore(stratumStore)
const artifactState = useStore(artifactStore)
const relationState = useStore(relationStore)
const officeState = useStore(officeStore)
const syncState = useStore(syncStore)

const menuGroups = [
  {
    role: '工地记录员',
    items: [
      { path: '/trenches', label: '探方清单', icon: 'Grid' },
      { path: '/strata', label: '地层单位', icon: 'Files' },
      { path: '/artifacts', label: '出土物登记', icon: 'Box' },
      { path: '/relations', label: '层位关系', icon: 'Share' },
      { path: '/sections', label: '四壁剖面', icon: 'DataLine' }
    ]
  },
  {
    role: '整理室编目员',
    items: [
      { path: '/catalog', label: '统一号 / 层位序列', icon: 'Collection' },
      { path: '/archive', label: '归档结论', icon: 'FolderChecked' }
    ]
  },
  {
    role: '两端同步',
    items: [{ path: '/sync', label: '同步中心', icon: 'Refresh' }]
  }
]

const flatMenus = menuGroups.flatMap((group) => group.items)
const activeMenu = computed(() => flatMenus.find((item) => route.path.startsWith(item.path))?.path ?? '/trenches')

const stats = computed(() => [
  { label: '探方', value: trenchState.trenches.length },
  { label: '地层单位', value: stratumState.strata.length },
  { label: '出土物', value: artifactState.artifacts.length },
  { label: '层位关系', value: relationState.relations.length },
  { label: '统一编目行', value: officeState.catalogs.length },
  { label: '归档单', value: officeState.archives.length }
])

const hasFailure = computed(
  () => syncState.fieldToOffice.phase === 'failed' || syncState.officeToField.phase === 'failed'
)

onMounted(() => {
  // 兜底再刷一次（正常流程 main.ts 已 hydrate）
  void trenchStore.getState().hydrate()
  void stratumStore.getState().hydrate()
  void artifactStore.getState().hydrate()
  void relationStore.getState().hydrate()
  void officeStore.getState().hydrate()
  void fieldShadowStore.getState().hydrate()
})
</script>

<template>
  <MigrationOverlay
    v-if="!ready"
    :stage="migrationStage"
    :source="migrationSource"
    :error="migrationError"
  >
    <el-button
      v-if="migrationStage === 'failed'"
      type="primary"
      :loading="retrying"
      style="margin-top: 16px"
      @click="retryMigration"
    >
      重新迁移
    </el-button>
  </MigrationOverlay>

  <el-container v-else class="shell">
    <el-aside width="232px" class="aside">
      <div class="brand">
        <div class="logo">探</div>
        <div>
          <div class="brand-title">考古探方地层编目台</div>
          <div class="brand-sub">Trench & Stratum Log</div>
        </div>
      </div>
      <el-menu :default-active="activeMenu" router class="menu">
        <template v-for="group in menuGroups" :key="group.role">
          <li class="menu-group">{{ group.role }}</li>
          <el-menu-item v-for="item in group.items" :key="item.path" :index="item.path">
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </el-menu-item>
        </template>
      </el-menu>
      <div class="stat-box">
        <div v-for="item in stats" :key="item.label" class="stat-row">
          <span>{{ item.label }}</span>
          <b>{{ item.value }}</b>
        </div>
        <p class="stat-tip">工地、整理室各一份数据，分开存放互不覆盖；数据均在浏览器 IndexedDB</p>
      </div>
    </el-aside>
    <el-container>
      <el-header class="header">
        <span class="crumb">{{ (route.meta.title as string) ?? '编目台' }}</span>
        <div class="head-right">
          <el-tooltip v-if="hasFailure" content="有同步方向失败，到同步中心按侧重试；另一侧照改不误" placement="bottom">
            <el-tag type="danger" size="small" effect="dark" class="fail-flag">有同步失败</el-tag>
          </el-tooltip>
          <SyncBadge direction="fieldToOffice" label="工地→整理室" />
          <SyncBadge direction="officeToField" label="整理室→工地" />
        </div>
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
.menu-group {
  list-style: none;
  padding: 12px 12px 4px;
  font-size: 11px;
  color: #bfae95;
  letter-spacing: 1px;
}
:deep(.menu .el-menu-item) {
  color: #ecdfcb;
  border-radius: 8px;
  margin-bottom: 4px;
  font-size: 13px;
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
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e6ded0;
  gap: 16px;
}
.crumb {
  font-weight: 600;
}
.head-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.fail-flag {
  margin-right: 2px;
}
.main {
  padding: 0;
  overflow: auto;
}
</style>
