import Dexie, { type Table } from 'dexie'
import type { Artifact, Relation, Stratum, Trench } from '@/types'
import type { ArchiveRecord, UnitCatalog } from '@/types/catalog'
import type { MetaRow } from './fieldDb'

/**
 * 整理库（编目员拥有）：
 * - unitCatalogs / archives 由整理室编目员读写（统一单位号、跨探方层位序列、裁定理由、归档结论）；
 * - trenchShadows / stratumShadows / artifactShadows / relationShadows 是工地记录员原始观察的只读镜像，
 *   仅由「工地 → 整理室」同步写入，编目员改层位结论不会冲掉原始记录。
 */
class OfficeDb extends Dexie {
  unitCatalogs!: Table<UnitCatalog, string>
  archives!: Table<ArchiveRecord, string>
  trenchShadows!: Table<Trench, string>
  stratumShadows!: Table<Stratum, string>
  artifactShadows!: Table<Artifact, string>
  relationShadows!: Table<Relation, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('gbtrenchlog-office')
    this.version(1).stores({
      unitCatalogs: 'id, unifiedCode, orderIndex',
      archives: 'id, status, checkedAt',
      trenchShadows: 'id, code, area',
      stratumShadows: 'id, trenchId, code, type, topDepth',
      artifactShadows: 'id, stratumId, code, category, date',
      relationShadows: 'id, unitAId, unitBId, type, basis',
      meta: 'key'
    })
  }
}

export const officeDb = new OfficeDb()
