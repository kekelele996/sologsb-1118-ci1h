import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from '@/App.vue'
import router from '@/router'
import { migrateToTwoSides, seedDemoData, stampDbVersion } from '@/hooks/usePersistentStore'
import { trenchStore } from '@/stores/trenchStore'
import { stratumStore } from '@/stores/stratumStore'
import { artifactStore } from '@/stores/artifactStore'
import { relationStore } from '@/stores/relationStore'
import { catalogerStore } from '@/stores/catalogerStore'
import { syncStore } from '@/stores/syncStore'
import '@/styles/main.css'

async function bootstrap(): Promise<void> {
  await seedDemoData()
  await stampDbVersion()
  // 首次打开：把没有归属的历史数据迁移到记录员 / 编目员两端，再启用
  await migrateToTwoSides()
  await trenchStore.getState().hydrate()
  await stratumStore.getState().hydrate()
  await artifactStore.getState().hydrate()
  await relationStore.getState().hydrate()
  await catalogerStore.getState().hydrate()
  await syncStore.getState().hydrate()
}

const app = createApp(App)

Object.entries(ElementPlusIconsVue).forEach(([key, component]) => {
  app.component(key, component)
})

app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.mount('#app')

void bootstrap()
