import { fieldDb } from '@/db/fieldDb'
import { officeDb } from '@/db/officeDb'
import type { UnitCatalog } from '@/types/catalog'
import { sortByDepth } from '@/services/demoData'

/** 同步方向 */
export type SyncDirection = 'fieldToOffice' | 'officeToField'

export type SyncPhase = 'idle' | 'syncing' | 'success' | 'failed'

export interface SideSyncState {
  phase: SyncPhase
  /** 最近一次成功时间 ISO 字符串 */
  lastSuccessAt: string
  /** 最近一次失败时间 ISO 字符串 */
  lastErrorAt: string
  /** 最近一次失败原因（用于「按侧重试」展示） */
  lastError: string
}

export type SyncListener = (direction: SyncDirection, state: SideSyncState) => void

/** 故障注入开关（仅内存，供演示「一侧同步失败、另一侧照改」） */
interface FaultSwitches {
  fieldToOffice: boolean
  officeToField: boolean
}

const faults: FaultSwitches = {
  fieldToOffice: false,
  officeToField: false
}

export function setSyncFault(direction: SyncDirection, enabled: boolean): void {
  faults[direction] = enabled
}

export function getSyncFault(direction: SyncDirection): boolean {
  return faults[direction]
}

const listeners = new Set<SyncListener>()

/** 同步成功后通知（main.ts 在此注册各 store 的重新 hydrate） */
export function onSyncSucceeded(listener: SyncListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 工地 → 整理室：原始观察写入整理库镜像，并据最新深度重算层位序号（不碰裁定理由） */
export async function pushFieldToOffice(): Promise<SideSyncState> {
  if (faults.fieldToOffice) {
    const failed: SideSyncState = {
      phase: 'failed',
      lastSuccessAt: '',
      lastErrorAt: new Date().toISOString(),
      lastError: '故障注入：工地 → 整理室同步被阻断（可在同步中心按侧重试）'
    }
    return Promise.reject(Object.assign(new Error(failed.lastError), { state: failed }))
  }

  const [trenches, strata, artifacts, relations] = await Promise.all([
    fieldDb.trenches.toArray(),
    fieldDb.strata.toArray(),
    fieldDb.artifacts.toArray(),
    fieldDb.relations.toArray()
  ])

  const liveIds = new Set(strata.map((item) => item.id))

  await officeDb.transaction(
    'rw',
    [
      officeDb.trenchShadows,
      officeDb.stratumShadows,
      officeDb.artifactShadows,
      officeDb.relationShadows,
      officeDb.unitCatalogs
    ],
    async () => {
      // 镜像表整表重建：记录员删了的行，整理室镜像也随之消失
      await officeDb.trenchShadows.clear()
      await officeDb.stratumShadows.clear()
      await officeDb.artifactShadows.clear()
      await officeDb.relationShadows.clear()
      await officeDb.trenchShadows.bulkPut(trenches)
      await officeDb.stratumShadows.bulkPut(strata)
      await officeDb.artifactShadows.bulkPut(artifacts)
      await officeDb.relationShadows.bulkPut(relations)

      // 编目行：工地新增的单位补行（统一号先用工地号占位）；已有的只重算序号
      const existing = await officeDb.unitCatalogs.toArray()
      const byId = new Map(existing.map((item) => [item.id, item]))
      const next: UnitCatalog[] = sortByDepth(strata).map((stratum, index) => {
        const prev = byId.get(stratum.id)
        if (prev) {
          // 上下界深度改动 → 层位序列重算；统一单位号、裁定理由照旧保留
          return { ...prev, orderIndex: index + 1 }
        }
        return {
          id: stratum.id,
          unifiedCode: stratum.code,
          orderIndex: index + 1,
          decisionReason: ''
        }
      })
      // 工地已删除单位对应的编目行不自动删（编目员的裁定理由保留），从序列计算中剔除
      const orphans = existing.filter((item) => !liveIds.has(item.id))
      await officeDb.unitCatalogs.clear()
      await officeDb.unitCatalogs.bulkPut([...next, ...orphans])
    }
  )

  const state: SideSyncState = {
    phase: 'success',
    lastSuccessAt: new Date().toISOString(),
    lastErrorAt: '',
    lastError: ''
  }
  listeners.forEach((listener) => listener('fieldToOffice', state))
  return state
}

/** 整理室 → 工地：编目结论（统一号/序号/裁定理由）写入工地库镜像 */
export async function pushOfficeToField(): Promise<SideSyncState> {
  if (faults.officeToField) {
    const failed: SideSyncState = {
      phase: 'failed',
      lastSuccessAt: '',
      lastErrorAt: new Date().toISOString(),
      lastError: '故障注入：整理室 → 工地同步被阻断（可在同步中心按侧重试）'
    }
    return Promise.reject(Object.assign(new Error(failed.lastError), { state: failed }))
  }

  const catalogs = await officeDb.unitCatalogs.toArray()
  await fieldDb.transaction('rw', fieldDb.catalogShadows, async () => {
    await fieldDb.catalogShadows.clear()
    await fieldDb.catalogShadows.bulkPut(catalogs)
  })

  const state: SideSyncState = {
    phase: 'success',
    lastSuccessAt: new Date().toISOString(),
    lastErrorAt: '',
    lastError: ''
  }
  listeners.forEach((listener) => listener('officeToField', state))
  return state
}
