import { createStore } from 'zustand/vanilla'
import type { Stratum, UnitType } from '@/types'
import { db, syncAll } from '@/hooks/usePersistentStore'
import { syncStore } from '@/stores/syncStore'

export interface StratumState {
  strata: Stratum[]
  loaded: boolean
  hydrate: () => Promise<void>
  save: (stratum: Stratum) => Promise<void>
  remove: (id: string) => Promise<void>
  bulkSetType: (ids: string[], type: UnitType) => Promise<void>
}

export const stratumStore = createStore<StratumState>((set, get) => ({
  strata: [],
  loaded: false,
  hydrate: async () => {
    const strata = await syncAll<Stratum>(db.strata)
    strata.sort((a, b) => (a.topDepth === b.topDepth ? a.code.localeCompare(b.code, 'zh-Hans-CN') : a.topDepth - b.topDepth))
    set({ strata, loaded: true })
  },
  save: async (stratum) => {
    // 记录员端：只写原始观察字段，编目员字段（统一单位号 / 序列序号 / 裁定理由）原样保留
    await syncStore.getState().push('recorder', 'strata', 'put', stratum.id, stratum)
    await get().hydrate()
  },
  remove: async (id) => {
    await syncStore.getState().push('recorder', 'strata', 'delete', id, null)
    await get().hydrate()
  },
  bulkSetType: async (ids, type) => {
    const targets = get().strata.filter((item) => ids.includes(item.id))
    await Promise.all(targets.map((item) => syncStore.getState().push('recorder', 'strata', 'put', item.id, { ...item, type })))
    await get().hydrate()
  }
}))
