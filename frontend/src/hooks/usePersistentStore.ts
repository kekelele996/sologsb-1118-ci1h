import { onUnmounted, reactive } from 'vue'
import type { StoreApi } from 'zustand/vanilla'

export { syncAll, syncPut, syncDelete } from '@/db/repo'

/** Zustand vanilla store → Vue 响应式桥接 */
export function useStore<T extends object>(store: StoreApi<T>): T {
  const state = reactive({ ...store.getState() }) as T
  const unsubscribe = store.subscribe((next: T) => {
    Object.assign(state, next)
  })
  onUnmounted(() => unsubscribe())
  return state
}
