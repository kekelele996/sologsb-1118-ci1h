/** 归档核对状态：通过 / 挂起（核对出问题即挂起） */
export type ArchiveStatus = 'passed' | 'suspended'

/** 归档核对问题类别 */
export type ArchiveIssueType =
  | 'crossTrenchOverlay'
  | 'duplicatedCode'
  | 'missingCode'
  | 'depthOutOfBounds'
  | 'orphanUnit'

/** 归档核对发现的单条问题 */
export interface ArchiveIssue {
  type: ArchiveIssueType
  /** error 会导致整单挂起 */
  level: 'error' | 'warning'
  message: string
  /** 关联的单位 / 出土物 id，便于定位行 */
  refId?: string
}

/** UnitCatalog 编目单位行：一个地层单位对应一行，id 与 Stratum.id 一致 */
export interface UnitCatalog {
  /** 与地层单位 id 一致（关联工地库镜像行） */
  id: string
  /** 编目员裁定的统一单位号（跨探方唯一） */
  unifiedCode: string
  /** 跨探方层位序列序号（浅 → 深，1 起；工地深度改动后自动重算） */
  orderIndex: number
  /** 编目员裁定理由；深度改动重算序列时原样保留，不覆盖 */
  decisionReason: string
}

/** ArchiveRecord 归档结论 */
export interface ArchiveRecord {
  id: string
  /** 归档单标题，如「Ⅱ区 2026 年度阶段归档」 */
  title: string
  status: ArchiveStatus
  /** 编目员写下的归档结论 */
  verdict: string
  /** 归档前核对出的问题清单（为空即通过） */
  issues: ArchiveIssue[]
  /** 最近一次核对时间 ISO 字符串 */
  checkedAt: string
}

/** 归档核对的输入（全部取自整理库：编目员自有行 + 工地镜像行） */
export interface ArchiveCheckInput {
  trenches: import('./trench').Trench[]
  strata: import('./stratum').Stratum[]
  artifacts: import('./artifact').Artifact[]
  relations: import('./relation').Relation[]
  catalogs: UnitCatalog[]
}

export const ARCHIVE_ISSUE_LABELS: Record<ArchiveIssueType, string> = {
  crossTrenchOverlay: '跨探方叠压矛盾',
  duplicatedCode: '统一单位号重复',
  missingCode: '统一单位号缺失',
  depthOutOfBounds: '出土物深度越界',
  orphanUnit: '引用单位缺失'
}
