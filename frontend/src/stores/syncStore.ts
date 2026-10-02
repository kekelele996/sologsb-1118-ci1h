import { createStore } from 'zustand/vanilla'
import type { OutboxItem, Side } from '@/types'
import { db, syncAll } from '@/hooks/usePersistentStore'
import { applyItem, enqueue, outboxCounts, setSimulateFailure, syncSide } from '@/utils/syncEngine'

export interface SyncState {
  outbox: OutboxItem[]
  loaded: boolean
  simulateFailure: boolean
  lastSyncedAt: Record<Side, number | null>
  counts: Record<Side, { pending: number; failed: number }>
  hydrate: () => Promise<void>
  /** 入队并立即尝试同步该端 */
  push: (side: Side, table: string, op: OutboxItem['op'], key: string, value: unknown) => Promise<void>
  /** 立即同步某一端 */
  syncNow: (side: Side) => Promise<{ synced: number; failed: number }>
  /** 失败后按侧重试该端 */
  retry: (side: Side) => Promise<{ synced: number; failed: number }>
  toggleSimulateFailure: (value: boolean) => Promise<void>
}

async function refreshCounts(): Promise<Record<Side, { pending: number; failed: number }>> {
  const [recorder, cataloger] = await Promise.all([outboxCounts('recorder'), outboxCounts('cataloger')])
  return { recorder, cataloger }
}

export const syncStore = createStore<SyncState>((set, get) => ({
  outbox: [],
  loaded: false,
  simulateFailure: false,
  lastSyncedAt: { recorder: null, cataloger: null },
  counts: { recorder: { pending: 0, failed: 0 }, cataloger: { pending: 0, failed: 0 } },

  hydrate: async () => {
    const outbox = await syncAll<OutboxItem>(db.outbox)
    outbox.sort((a, b) => a.createdAt - b.createdAt)
    const counts = await refreshCounts()
    set({ outbox, counts, loaded: true })
  },

  push: async (side, table, op, key, value) => {
    // 1. 本地立即生效（乐观更新）：即便同步失败，编辑侧的改动也不丢，另一侧照旧能改
    await applyItem({ id: '', side, table, op, key, value, status: 'pending', attempts: 0, lastError: '', createdAt: Date.now() })
    // 2. 入并发件箱
    await enqueue(side, table, op, key, value)
    // 3. 尝试同步合并
    const result = await syncSide(side)
    const counts = await refreshCounts()
    const outbox = await syncAll<OutboxItem>(db.outbox)
    outbox.sort((a, b) => a.createdAt - b.createdAt)
    set({
      counts,
      outbox,
      lastSyncedAt: result.failed === 0 ? { ...get().lastSyncedAt, [side]: Date.now() } : get().lastSyncedAt
    })
    // 同步合并后刷新共享视图（动态引入避免 store 间静态循环依赖）
    const { stratumStore } = await import('./stratumStore')
    await stratumStore.getState().hydrate()
    const { catalogerStore } = await import('./catalogerStore')
    await catalogerStore.getState().hydrate()
  },

  syncNow: async (side) => {
    const result = await syncSide(side)
    const counts = await refreshCounts()
    const outbox = await syncAll<OutboxItem>(db.outbox)
    outbox.sort((a, b) => a.createdAt - b.createdAt)
    set({
      counts,
      outbox,
      lastSyncedAt: result.failed === 0 ? { ...get().lastSyncedAt, [side]: Date.now() } : get().lastSyncedAt
    })
    if (result.failed === 0) {
      const { stratumStore } = await import('./stratumStore')
      await stratumStore.getState().hydrate()
      const { catalogerStore } = await import('./catalogerStore')
      await catalogerStore.getState().hydrate()
    }
    return result
  },

  retry: async (side) => {
    // 重试即重新同步该端：该端拥有的字段在合并中优先（侧重）
    return get().syncNow(side)
  },

  toggleSimulateFailure: async (value) => {
    setSimulateFailure(value)
    set({ simulateFailure: value })
    if (!value) {
      // 关闭模拟后自动重试两端
      await get().syncNow('recorder')
      await get().syncNow('cataloger')
    }
  }
}))
