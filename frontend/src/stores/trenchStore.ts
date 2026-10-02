import { createStore } from 'zustand/vanilla'
import type { Trench } from '@/types'
import { syncAll, syncDelete, syncPut } from '@/db/repo'
import { fieldDb } from '@/db/fieldDb'
import { syncStore } from '@/stores/syncStore'

export interface TrenchState {
  trenches: Trench[]
  loaded: boolean
  hydrate: () => Promise<void>
  save: (trench: Trench) => Promise<void>
  remove: (id: string) => Promise<void>
  setBackfilled: (id: string, backfilled: boolean) => Promise<void>
}

export const trenchStore = createStore<TrenchState>((set, get) => ({
  trenches: [],
  loaded: false,
  hydrate: async () => {
    const trenches = await syncAll<Trench>(fieldDb.trenches)
    trenches.sort((a, b) => `${a.area}${a.code}`.localeCompare(`${b.area}${b.code}`, 'zh-Hans-CN'))
    set({ trenches, loaded: true })
  },
  save: async (trench) => {
    await syncPut<Trench>(fieldDb.trenches, trench)
    await get().hydrate()
    // 记录员改动只推工地 → 整理室一侧，另一侧（整理室 → 工地）照跑不误
    void syncStore.getState().sync('fieldToOffice')
  },
  remove: async (id) => {
    await syncDelete<Trench>(fieldDb.trenches, id)
    await get().hydrate()
    void syncStore.getState().sync('fieldToOffice')
  },
  setBackfilled: async (id, backfilled) => {
    const target = get().trenches.find((item) => item.id === id)
    if (!target) return
    await syncPut<Trench>(fieldDb.trenches, { ...target, backfilled })
    await get().hydrate()
    void syncStore.getState().sync('fieldToOffice')
  }
}))
