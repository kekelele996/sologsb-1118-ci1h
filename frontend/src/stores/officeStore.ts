import { createStore } from 'zustand/vanilla'
import type { Artifact, Relation, Stratum, Trench } from '@/types'
import type { ArchiveRecord, UnitCatalog } from '@/types/catalog'
import { syncAll, syncDelete, syncPut } from '@/db/repo'
import { officeDb } from '@/db/officeDb'
import { syncStore } from '@/stores/syncStore'

export interface OfficeState {
  loaded: boolean
  /** 编目员拥有：统一单位号 / 层位序号 / 裁定理由 */
  catalogs: UnitCatalog[]
  /** 编目员拥有：归档结论 */
  archives: ArchiveRecord[]
  /** 工地记录员原始观察的只读镜像（由 工地→整理室 同步写入） */
  trenchShadows: Trench[]
  stratumShadows: Stratum[]
  artifactShadows: Artifact[]
  relationShadows: Relation[]
  hydrate: () => Promise<void>
  saveCatalog: (catalog: UnitCatalog) => Promise<void>
  removeCatalog: (id: string) => Promise<void>
  saveArchive: (record: ArchiveRecord) => Promise<void>
  removeArchive: (id: string) => Promise<void>
}

export const officeStore = createStore<OfficeState>((set, get) => ({
  loaded: false,
  catalogs: [],
  archives: [],
  trenchShadows: [],
  stratumShadows: [],
  artifactShadows: [],
  relationShadows: [],

  hydrate: async () => {
    const [catalogs, archives, trenchShadows, stratumShadows, artifactShadows, relationShadows] =
      await Promise.all([
        syncAll<UnitCatalog>(officeDb.unitCatalogs),
        syncAll<ArchiveRecord>(officeDb.archives),
        syncAll<Trench>(officeDb.trenchShadows),
        syncAll<Stratum>(officeDb.stratumShadows),
        syncAll<Artifact>(officeDb.artifactShadows),
        syncAll<Relation>(officeDb.relationShadows)
      ])
    catalogs.sort((a, b) => (a.orderIndex === b.orderIndex ? a.unifiedCode.localeCompare(b.unifiedCode, 'zh-Hans-CN') : a.orderIndex - b.orderIndex))
    archives.sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))
    stratumShadows.sort((a, b) => (a.topDepth === b.topDepth ? a.code.localeCompare(b.code) : a.topDepth - b.topDepth))
    set({
      catalogs,
      archives,
      trenchShadows,
      stratumShadows,
      artifactShadows,
      relationShadows,
      loaded: true
    })
  },

  saveCatalog: async (catalog) => {
    await syncPut<UnitCatalog>(officeDb.unitCatalogs, catalog)
    await get().hydrate()
    // 编目员改动只推 整理室 → 工地 一侧
    void syncStore.getState().sync('officeToField')
  },
  removeCatalog: async (id) => {
    await syncDelete<UnitCatalog>(officeDb.unitCatalogs, id)
    await get().hydrate()
    void syncStore.getState().sync('officeToField')
  },
  saveArchive: async (record) => {
    await syncPut<ArchiveRecord>(officeDb.archives, record)
    await get().hydrate()
  },
  removeArchive: async (id) => {
    await syncDelete<ArchiveRecord>(officeDb.archives, id)
    await get().hydrate()
  }
}))
