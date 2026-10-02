import { createStore } from 'zustand/vanilla'
import type { Stratum, UnitType } from '@/types'
import { syncAll, syncDelete, syncPut } from '@/db/repo'
import { fieldDb } from '@/db/fieldDb'
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
    const strata = await syncAll<Stratum>(fieldDb.strata)
    strata.sort((a, b) => (a.topDepth === b.topDepth ? a.code.localeCompare(b.code, 'zh-Hans-CN') : a.topDepth - b.topDepth))
    set({ strata, loaded: true })
  },
  save: async (stratum) => {
    await syncPut<Stratum>(fieldDb.strata, stratum)
    await get().hydrate()
    // 上下界深度改动随此推送；整理室一侧收到后会重算引用它的层位序列
    void syncStore.getState().sync('fieldToOffice')
  },
  remove: async (id) => {
    await syncDelete<Stratum>(fieldDb.strata, id)
    await get().hydrate()
    void syncStore.getState().sync('fieldToOffice')
  },
  bulkSetType: async (ids, type) => {
    const targets = get().strata.filter((item) => ids.includes(item.id))
    await Promise.all(targets.map((item) => syncPut<Stratum>(fieldDb.strata, { ...item, type })))
    await get().hydrate()
    void syncStore.getState().sync('fieldToOffice')
  }
}))
