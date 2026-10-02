import { createStore } from 'zustand/vanilla'
import type { UnitCatalog } from '@/types/catalog'
import { syncAll } from '@/db/repo'
import { fieldDb } from '@/db/fieldDb'

export interface FieldShadowState {
  loaded: boolean
  /** 编目员统一单位号结论在工地库的只读镜像（由 整理室→工地 同步写入） */
  catalogShadows: UnitCatalog[]
  hydrate: () => Promise<void>
  unifiedCodeOf: (stratumId: string) => string
}

export const fieldShadowStore = createStore<FieldShadowState>((set, get) => ({
  loaded: false,
  catalogShadows: [],
  hydrate: async () => {
    const catalogShadows = await syncAll<UnitCatalog>(fieldDb.catalogShadows)
    catalogShadows.sort((a, b) => a.orderIndex - b.orderIndex)
    set({ catalogShadows, loaded: true })
  },
  unifiedCodeOf: (stratumId) => get().catalogShadows.find((item) => item.id === stratumId)?.unifiedCode ?? ''
}))
