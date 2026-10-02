/** 两端：记录员端 / 编目员端 */
export const SIDES = ['recorder', 'cataloger'] as const
export type Side = (typeof SIDES)[number]

export const SIDE_LABELS: Record<Side, string> = {
  recorder: '记录员端',
  cataloger: '编目员端'
}

/**
 * 地层单位字段按归属拆成两份：
 * - 记录员端管原始观察（探方、地层单位、出土物）
 * - 编目员端管编目成果（统一单位号、跨探方层位序列、裁定理由）
 * 同步时各写各的字段，互不覆盖。
 */
export const RECORDER_STRATUM_KEYS = [
  'trenchId',
  'code',
  'type',
  'openLayer',
  'topDepth',
  'bottomDepth',
  'soil',
  'inclusions',
  'formation',
  'date',
  'drawingNo'
] as const

export const CATALOG_STRATUM_KEYS = ['unifiedCode', 'sequenceOrder', 'rationale'] as const

/** 编目记录（编目员端拥有，与地层单位 1:1） */
export interface CatalogRecord {
  id: string
  /** 所属地层单位 id */
  stratumId: string
  /** 统一单位号（编目员给定，跨探方统一编号） */
  unifiedCode: string
  /** 手动排定的跨探方层位序号；null 表示按深度自动重算 */
  sequenceOrder: number | null
  /** 裁定理由（编目员写下，深度改动重算序列时照旧保留） */
  rationale: string
  updatedAt: number
}

/** 归档结论状态 */
export type ArchiveStatus = 'draft' | 'archived' | 'suspended'

/** 归档前三核对的单项结果 */
export interface ArchiveCheck {
  key: 'superposition' | 'duplicateCode' | 'artifactDepth'
  label: string
  passed: boolean
  issues: string[]
}

/** 归档结论（编目员端拥有） */
export interface ArchiveConclusion {
  id: string
  title: string
  content: string
  archivist: string
  status: ArchiveStatus
  checks: ArchiveCheck[]
  createdAt: number
  updatedAt: number
  archivedAt: number | null
}

/** 同步发件箱条目状态 */
export type OutboxStatus = 'pending' | 'synced' | 'failed'

/** 同步发件箱条目 */
export interface OutboxItem {
  id: string
  side: Side
  table: string
  op: 'put' | 'delete'
  key: string
  value: unknown
  status: OutboxStatus
  attempts: number
  lastError: string
  createdAt: number
}

/** 从对象中挑出指定字段（用于按归属合并） */
export function pickKeys<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Partial<T> {
  const out: Partial<T> = {}
  keys.forEach((key) => {
    if (obj[key] !== undefined) out[key] = obj[key]
  })
  return out
}

/** 新建一条空编目记录（首次打开迁移时按原始单位号播种统一单位号） */
export function createCatalogRecord(stratumId: string, unifiedCode: string, now = Date.now()): CatalogRecord {
  return {
    id: stratumId,
    stratumId,
    unifiedCode,
    sequenceOrder: null,
    rationale: '',
    updatedAt: now
  }
}
