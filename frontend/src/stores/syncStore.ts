import { createStore } from 'zustand/vanilla'
import {
  getSyncFault,
  pushFieldToOffice,
  pushOfficeToField,
  setSyncFault,
  type SideSyncState,
  type SyncDirection,
  type SyncPhase
} from '@/services/syncEngine'

export interface SyncStatus {
  fieldToOffice: SideSyncState & { running: boolean }
  officeToField: SideSyncState & { running: boolean }
}

export interface SyncStoreState extends SyncStatus {
  /** 单侧同步：只重试指定方向，另一侧不受影响、照常可改 */
  sync: (direction: SyncDirection) => Promise<void>
  /** 两侧各自独立同步；一侧失败不阻断另一侧（Promise.allSettled） */
  syncAll: () => Promise<void>
  setFault: (direction: SyncDirection, enabled: boolean) => void
  isFaulted: (direction: SyncDirection) => boolean
}

const idleSide = (): SideSyncState & { running: boolean } => ({
  phase: 'idle',
  running: false,
  lastSuccessAt: '',
  lastErrorAt: '',
  lastError: ''
})

const runner: Record<SyncDirection, () => Promise<SideSyncState>> = {
  fieldToOffice: pushFieldToOffice,
  officeToField: pushOfficeToField
}

export const syncStore = createStore<SyncStoreState>((set, get) => ({
  fieldToOffice: idleSide(),
  officeToField: idleSide(),

  sync: async (direction) => {
    const current = get()[direction]
    if (current.running) return
    set({ [direction]: { ...current, running: true, phase: 'syncing' as SyncPhase } } as Partial<SyncStoreState>)
    try {
      const state = await runner[direction]()
      set({
        [direction]: { ...state, running: false }
      } as Partial<SyncStoreState>)
    } catch (error) {
      const carried = (error as { state?: SideSyncState }).state
      const state: SideSyncState =
        carried ?? {
          phase: 'failed',
          lastSuccessAt: current.lastSuccessAt,
          lastErrorAt: new Date().toISOString(),
          lastError: error instanceof Error ? error.message : String(error)
        }
      set({
        [direction]: { ...state, running: false }
      } as Partial<SyncStoreState>)
    }
  },

  syncAll: async () => {
    // 两个方向互不等待、互不阻断：一侧 reject 不影响另一侧
    await Promise.allSettled([get().sync('fieldToOffice'), get().sync('officeToField')])
  },

  setFault: (direction, enabled) => setSyncFault(direction, enabled),
  isFaulted: (direction) => getSyncFault(direction)
}))
