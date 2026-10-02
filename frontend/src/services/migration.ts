import { fieldDb, type MetaRow } from '@/db/fieldDb'
import { officeDb } from '@/db/officeDb'
import { getLegacyDb, legacyDbHasData } from '@/db/legacyDb'
import type { UnitCatalog } from '@/types/catalog'
import {
  buildInitialCatalogs,
  demoArtifacts,
  demoRelations,
  demoStrata,
  demoTrenches
} from '@/services/demoData'

/** 双端拆分迁移完成标记（同时写入两个库的 meta） */
export const MIGRATION_KEY = 'splitMigrated'

export type MigrationStage =
  | 'idle'
  | 'checking'
  | 'copying-legacy'
  | 'seeding-demo'
  | 'done'
  | 'failed'

export interface MigrationState {
  stage: MigrationStage
  /** 迁移来源：legacy 旧单库 / demo 示例数据 / existing 两端库已有数据 */
  source: 'none' | 'legacy' | 'demo' | 'existing'
  error: string
}

async function readMigrationStamp(): Promise<boolean> {
  const rows = await Promise.all([fieldDb.meta.get(MIGRATION_KEY), officeDb.meta.get(MIGRATION_KEY)])
  return rows.every((row): row is MetaRow => Boolean(row && row.value === true))
}

async function writeMigrationStamp(): Promise<void> {
  await Promise.all([
    fieldDb.meta.put({ key: MIGRATION_KEY, value: true }),
    officeDb.meta.put({ key: MIGRATION_KEY, value: true })
  ])
}

/**
 * 首次打开迁移：把旧单库 gbtrenchlog 中缺归属的数据，
 * 按归属分别写入工地库与整理库后再启用；两端库都已存在数据则直接启用。
 */
export async function migrateSplitStores(
  onStage?: (stage: MigrationStage) => void
): Promise<MigrationState> {
  const state: MigrationState = { stage: 'idle', source: 'none', error: '' }

  try {
    // 已迁移过：两端数据就位，直接启用
    if (await readMigrationStamp()) {
      state.stage = 'done'
      state.source = 'existing'
      return state
    }

    onStage?.('checking')
    state.stage = 'checking'

    if (await legacyDbHasData()) {
      onStage?.('copying-legacy')
      state.stage = 'copying-legacy'
      state.source = 'legacy'

      const legacy = getLegacyDb()
      const [trenches, strata, artifacts, relations] = await Promise.all([
        legacy.trenches.toArray(),
        legacy.strata.toArray(),
        legacy.artifacts.toArray(),
        legacy.relations.toArray()
      ])

      // 记录员管：探方、地层单位、出土物、层位关系 → 工地库
      await fieldDb.transaction(
        'rw',
        [fieldDb.trenches, fieldDb.strata, fieldDb.artifacts, fieldDb.relations],
        async () => {
          await fieldDb.trenches.bulkPut(trenches)
          await fieldDb.strata.bulkPut(strata)
          await fieldDb.artifacts.bulkPut(artifacts)
          await fieldDb.relations.bulkPut(relations)
        }
      )

      // 编目员管：旧库没有独立的统一单位号结论，迁移时为每个单位建编目行
      // （统一号沿用工地单位号、层位序号按深度排、裁定理由留空），归档结论为空
      const catalogs: UnitCatalog[] = buildInitialCatalogs(strata)
      await officeDb.transaction(
        'rw',
        [
          officeDb.unitCatalogs,
          officeDb.trenchShadows,
          officeDb.stratumShadows,
          officeDb.artifactShadows,
          officeDb.relationShadows
        ],
        async () => {
          await officeDb.unitCatalogs.bulkPut(catalogs)
          await officeDb.trenchShadows.bulkPut(trenches)
          await officeDb.stratumShadows.bulkPut(strata)
          await officeDb.artifactShadows.bulkPut(artifacts)
          await officeDb.relationShadows.bulkPut(relations)
        }
      )
    } else {
      onStage?.('seeding-demo')
      state.stage = 'seeding-demo'
      state.source = 'demo'

      const today = new Date().toISOString().slice(0, 10)
      const trenches = demoTrenches(today)
      const strata = demoStrata(today)
      const artifacts = demoArtifacts(today)
      const relations = demoRelations()
      const catalogs = buildInitialCatalogs(strata)

      await fieldDb.transaction(
        'rw',
        [fieldDb.trenches, fieldDb.strata, fieldDb.artifacts, fieldDb.relations],
        async () => {
          await fieldDb.trenches.bulkPut(trenches)
          await fieldDb.strata.bulkPut(strata)
          await fieldDb.artifacts.bulkPut(artifacts)
          await fieldDb.relations.bulkPut(relations)
        }
      )
      await officeDb.transaction(
        'rw',
        [
          officeDb.unitCatalogs,
          officeDb.trenchShadows,
          officeDb.stratumShadows,
          officeDb.artifactShadows,
          officeDb.relationShadows
        ],
        async () => {
          await officeDb.unitCatalogs.bulkPut(catalogs)
          await officeDb.trenchShadows.bulkPut(trenches)
          await officeDb.stratumShadows.bulkPut(strata)
          await officeDb.artifactShadows.bulkPut(artifacts)
          await officeDb.relationShadows.bulkPut(relations)
        }
      )
    }

    await writeMigrationStamp()
    onStage?.('done')
    state.stage = 'done'
    return state
  } catch (error) {
    onStage?.('failed')
    state.stage = 'failed'
    state.error = error instanceof Error ? error.message : String(error)
    return state
  }
}
