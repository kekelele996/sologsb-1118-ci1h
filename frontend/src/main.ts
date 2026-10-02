import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from '@/App.vue'
import router from '@/router'
import '@/styles/main.css'
import { migrateSplitStores, type MigrationState } from '@/services/migration'
import { onSyncSucceeded, type SyncDirection } from '@/services/syncEngine'
import { trenchStore } from '@/stores/trenchStore'
import { stratumStore } from '@/stores/stratumStore'
import { artifactStore } from '@/stores/artifactStore'
import { relationStore } from '@/stores/relationStore'
import { officeStore } from '@/stores/officeStore'
import { fieldShadowStore } from '@/stores/fieldShadowStore'

async function hydrateAll(): Promise<void> {
  await Promise.all([
    trenchStore.getState().hydrate(),
    stratumStore.getState().hydrate(),
    artifactStore.getState().hydrate(),
    relationStore.getState().hydrate(),
    officeStore.getState().hydrate(),
    fieldShadowStore.getState().hydrate()
  ])
}

/**
 * 同步成功后按方向刷新对应端的 store：
 * - 工地→整理室成功：刷新整理室（镜像变了、序列重算了）
 * - 整理室→工地成功：刷新工地看到的统一号镜像
 */
function registerSyncHydration(): void {
  onSyncSucceeded((direction: SyncDirection) => {
    if (direction === 'fieldToOffice') {
      void officeStore.getState().hydrate()
    } else {
      void fieldShadowStore.getState().hydrate()
    }
  })
}

async function bootstrap(): Promise<MigrationState> {
  registerSyncHydration()
  // 首次打开：缺归属的旧数据先迁移到两端（或为全新库写入示例数据），完成后才启用
  const migration = await migrateSplitStores()
  if (migration.stage === 'done') {
    await hydrateAll()
  }
  return migration
}

const app = createApp(App)

Object.entries(ElementPlusIconsVue).forEach(([key, component]) => {
  app.component(key, component)
})

app.use(router)
app.use(ElementPlus, { locale: zhCn })

// 迁移结果交给 App 控制遮罩：成功后挂载，失败也挂载（遮罩内提供重试）
void bootstrap().then((migration) => {
  app.provide('migrationState', migration satisfies MigrationState)
  app.mount('#app')
})
