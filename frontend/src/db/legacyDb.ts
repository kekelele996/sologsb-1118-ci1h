import Dexie, { type Table } from 'dexie'
import type { Artifact, Relation, Stratum, Trench } from '@/types'
import type { MetaRow } from './fieldDb'

/**
 * 旧版单库 gbtrenchlog（编目台最初只有一份数据）。
 * 仅在首次打开迁移时以只读方式打开读取：迁移完成后保留不动作为备份，
 * 新的业务读写都发生在 fieldDb / officeDb 两个库里。
 */
class LegacyDb extends Dexie {
  trenches!: Table<Trench, string>
  strata!: Table<Stratum, string>
  artifacts!: Table<Artifact, string>
  relations!: Table<Relation, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('gbtrenchlog')
    this.version(1).stores({
      trenches: 'id, code, area',
      strata: 'id, trenchId, code, type',
      artifacts: 'id, stratumId, code, category',
      relations: 'id, unitAId, unitBId, type',
      meta: 'key'
    })
    // v2：旧库历史升级（地层单位补齐「开口层位」），保留以便正确读出旧数据
    this.version(2)
      .stores({
        trenches: 'id, code, area, backfilled',
        strata: 'id, trenchId, code, type, topDepth',
        artifacts: 'id, stratumId, code, category, date',
        relations: 'id, unitAId, unitBId, type, basis',
        meta: 'key'
      })
      .upgrade(async (tx) => {
        await tx
          .table<Stratum, string>('strata')
          .toCollection()
          .modify((stratum) => {
            if (!stratum.openLayer) {
              stratum.openLayer = '第①层'
            }
            if (!Array.isArray(stratum.inclusions)) {
              stratum.inclusions = []
            }
          })
      })
  }
}

let legacyInstance: LegacyDb | null = null

/** 打开旧库（单例，仅迁移时使用） */
export function getLegacyDb(): LegacyDb {
  if (!legacyInstance) legacyInstance = new LegacyDb()
  return legacyInstance
}

/**
 * 判断旧库是否真实存在（非空）：
 * 优先用 indexedDB.databases() 探测；不支持时退化为尝试打开并计数，
 * 计数为 0 的空探测库会被删掉，避免给用户留下一个空白 gbtrenchlog。
 */
export async function legacyDbHasData(): Promise<boolean> {
  try {
    const databases = (await indexedDB.databases()) as { name?: string }[]
    const listed = databases.some((item) => item.name === 'gbtrenchlog')
    if (!listed) return false
  } catch {
    // 部分浏览器不支持 indexedDB.databases()，退化为打开探测
  }

  const db = getLegacyDb()
  try {
    const count = await db.trenches.count()
    if (count === 0) {
      // 探测产生的空库直接删除，保持干净（删除后清掉单例，下次调用会重建）
      await db.delete()
      legacyInstance = null
      return false
    }
    return true
  } catch {
    return false
  }
}
