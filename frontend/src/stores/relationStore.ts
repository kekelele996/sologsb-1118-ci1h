import { createStore } from 'zustand/vanilla'
import type { Relation } from '@/types'
import { syncAll, syncDelete, syncPut } from '@/db/repo'
import { fieldDb } from '@/db/fieldDb'
import { syncStore } from '@/stores/syncStore'

export interface RelationState {
  relations: Relation[]
  loaded: boolean
  hydrate: () => Promise<void>
  /** 保存前由页面做环路检测，store 只负责写入 */
  save: (relation: Relation) => Promise<void>
  remove: (id: string) => Promise<void>
  removeByStratum: (stratumId: string) => Promise<void>
}

export const relationStore = createStore<RelationState>((set, get) => ({
  relations: [],
  loaded: false,
  hydrate: async () => {
    const relations = await syncAll<Relation>(fieldDb.relations)
    relations.sort((a, b) => a.id.localeCompare(b.id))
    set({ relations, loaded: true })
  },
  save: async (relation) => {
    await syncPut<Relation>(fieldDb.relations, relation)
    await get().hydrate()
    void syncStore.getState().sync('fieldToOffice')
  },
  remove: async (id) => {
    await syncDelete<Relation>(fieldDb.relations, id)
    await get().hydrate()
    void syncStore.getState().sync('fieldToOffice')
  },
  removeByStratum: async (stratumId) => {
    const targets = get().relations.filter((item) => item.unitAId === stratumId || item.unitBId === stratumId)
    await Promise.all(targets.map((item) => syncDelete<Relation>(fieldDb.relations, item.id)))
    await get().hydrate()
    void syncStore.getState().sync('fieldToOffice')
  }
}))
