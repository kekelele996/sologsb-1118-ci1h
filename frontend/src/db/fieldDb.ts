import Dexie, { type Table } from 'dexie'
import type { Artifact, Relation, Stratum, Trench } from '@/types'
import type { UnitCatalog } from '@/types/catalog'

export interface MetaRow {
  key: string
  value: unknown
}

/**
 * 工地库（记录员拥有）：
 * - trenches / strata / artifacts / relations 由工地记录员读写；
 * - catalogShadows 是整理室编目员结论（统一单位号、层位序号、裁定理由）的只读镜像，
 *   仅由「整理室 → 工地」同步写入，记录员不能改，因此补录出土物不会带偏编目结论。
 */
class FieldDb extends Dexie {
  trenches!: Table<Trench, string>
  strata!: Table<Stratum, string>
  artifacts!: Table<Artifact, string>
  relations!: Table<Relation, string>
  catalogShadows!: Table<UnitCatalog, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('gbtrenchlog-field')
    this.version(1).stores({
      trenches: 'id, code, area',
      strata: 'id, trenchId, code, type, topDepth',
      artifacts: 'id, stratumId, code, category, date',
      relations: 'id, unitAId, unitBId, type, basis',
      catalogShadows: 'id, unifiedCode, orderIndex',
      meta: 'key'
    })
  }
}

export const fieldDb = new FieldDb()
