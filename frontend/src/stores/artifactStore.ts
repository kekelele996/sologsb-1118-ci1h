import { createStore } from 'zustand/vanilla'
import type { Artifact } from '@/types'
import { syncAll, syncDelete, syncPut } from '@/db/repo'
import { fieldDb } from '@/db/fieldDb'
import { syncStore } from '@/stores/syncStore'

export interface ArtifactState {
  artifacts: Artifact[]
  loaded: boolean
  hydrate: () => Promise<void>
  save: (artifact: Artifact) => Promise<void>
  remove: (id: string) => Promise<void>
  removeByStratum: (stratumId: string) => Promise<void>
}

export const artifactStore = createStore<ArtifactState>((set, get) => ({
  artifacts: [],
  loaded: false,
  hydrate: async () => {
    const artifacts = await syncAll<Artifact>(fieldDb.artifacts)
    artifacts.sort((a, b) => a.code.localeCompare(b.code, 'zh-Hans-CN', { numeric: true }))
    set({ artifacts, loaded: true })
  },
  save: async (artifact) => {
    await syncPut<Artifact>(fieldDb.artifacts, artifact)
    await get().hydrate()
    void syncStore.getState().sync('fieldToOffice')
  },
  remove: async (id) => {
    await syncDelete<Artifact>(fieldDb.artifacts, id)
    await get().hydrate()
    void syncStore.getState().sync('fieldToOffice')
  },
  removeByStratum: async (stratumId) => {
    const targets = get().artifacts.filter((item) => item.stratumId === stratumId)
    await Promise.all(targets.map((item) => syncDelete<Artifact>(fieldDb.artifacts, item.id)))
    await get().hydrate()
    void syncStore.getState().sync('fieldToOffice')
  }
}))
