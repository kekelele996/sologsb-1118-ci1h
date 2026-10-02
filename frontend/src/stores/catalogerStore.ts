import { createStore } from 'zustand/vanilla'
import type { ArchiveConclusion, ArchiveCheck, CatalogRecord } from '@/types'
import { db, syncAll } from '@/hooks/usePersistentStore'
import { syncStore } from '@/stores/syncStore'
import { stratumStore } from '@/stores/stratumStore'
import { artifactStore } from '@/stores/artifactStore'
import { relationStore } from '@/stores/relationStore'
import { allChecksPassed, runArchiveChecks } from '@/utils/archiveChecks'

export interface CatalogerState {
  catalogs: CatalogRecord[]
  conclusions: ArchiveConclusion[]
  loaded: boolean
  hydrate: () => Promise<void>
  saveCatalog: (record: CatalogRecord) => Promise<void>
  saveConclusion: (conclusion: ArchiveConclusion) => Promise<void>
  /** 归档：先跑三核对，对不上则挂起；通过才归档 */
  archive: (id: string) => Promise<{ ok: boolean; checks: ArchiveCheck[] }>
}

export const catalogerStore = createStore<CatalogerState>((set, get) => ({
  catalogs: [],
  conclusions: [],
  loaded: false,

  hydrate: async () => {
    const [catalogs, conclusions] = await Promise.all([
      syncAll<CatalogRecord>(db.catalogRecords),
      syncAll<ArchiveConclusion>(db.archiveConclusions)
    ])
    catalogs.sort((a, b) => a.stratumId.localeCompare(b.stratumId))
    conclusions.sort((a, b) => b.updatedAt - a.updatedAt)
    set({ catalogs, conclusions, loaded: true })
  },

  saveCatalog: async (record) => {
    // 编目员端：写编目记录，并把统一单位号 / 序列序号 / 裁定理由镜像回共享地层（不碰原始观察）
    await syncStore.getState().push('cataloger', 'catalogRecords', 'put', record.stratumId, record)
    await get().hydrate()
  },

  saveConclusion: async (conclusion) => {
    await syncStore.getState().push('cataloger', 'archiveConclusions', 'put', conclusion.id, conclusion)
    await get().hydrate()
  },

  archive: async (id) => {
    const target = get().conclusions.find((item) => item.id === id)
    if (!target) return { ok: false, checks: [] }
    // 归档前三核对：跨探方叠压 / 单位号重复 / 出土物深度越界
    const checks = runArchiveChecks(
      stratumStore.getState().strata,
      artifactStore.getState().artifacts,
      relationStore.getState().relations
    )
    const ok = allChecksPassed(checks)
    const updated: ArchiveConclusion = {
      ...target,
      checks,
      status: ok ? 'archived' : 'suspended',
      updatedAt: Date.now(),
      archivedAt: ok ? Date.now() : null
    }
    await get().saveConclusion(updated)
    return { ok, checks }
  }
}))
