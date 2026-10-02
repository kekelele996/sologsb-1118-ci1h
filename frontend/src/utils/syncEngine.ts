import type { Table } from 'dexie'
import { db } from '@/hooks/usePersistentStore'
import {
  CATALOG_STRATUM_KEYS,
  RECORDER_STRATUM_KEYS,
  pickKeys,
  type CatalogRecord,
  type OutboxItem,
  type Side,
  type Stratum
} from '@/types'
import { uid } from '@/utils/id'

/**
 * 同步引擎：两端各有一个发件箱（outbox），把各自拥有的字段合并进共享视图。
 * - 记录员端只写 RECORDER_STRATUM_KEYS（原始观察）
 * - 编目员端只写 CATALOG_STRATUM_KEYS（编目成果）
 * 字段级合并保证任何一端都不会带偏/冲掉另一端的份。
 */

/** 模拟同步失败开关（演示用：打开后下一次同步会失败，可重试） */
let simulateFailure = false
export function setSimulateFailure(value: boolean): void {
  simulateFailure = value
}
export function isSimulateFailure(): boolean {
  return simulateFailure
}

function table(name: string): Table {
  return (db as unknown as Record<string, Table>)[name] as Table
}

/** 把一条发件箱条目按归属字段应用到共享视图 */
export async function applyItem(item: OutboxItem): Promise<void> {
  const { side, table: tableName, op, key, value } = item
  if (tableName === 'strata') {
    const existing = await db.strata.get(key)
    if (op === 'delete') {
      await db.strata.delete(key)
      return
    }
    const keys = side === 'recorder' ? RECORDER_STRATUM_KEYS : CATALOG_STRATUM_KEYS
    const patch = pickKeys(value as Stratum, keys as readonly (keyof Stratum)[])
    await db.strata.put({ ...(existing ?? {}), ...patch } as Stratum)
    return
  }
  if (tableName === 'catalogRecords') {
    const rec = value as CatalogRecord
    await db.catalogRecords.put(rec)
    // 编目成果镜像到共享地层单位（只写编目员字段，不碰原始观察）
    const existing = await db.strata.get(rec.stratumId)
    if (existing) {
      const patch = pickKeys(rec, CATALOG_STRATUM_KEYS)
      await db.strata.put({ ...existing, ...patch } as Stratum)
    }
    return
  }
  const tbl = table(tableName)
  if (op === 'delete') {
    await tbl.delete(key)
  } else {
    await tbl.put(value)
  }
}

/** 写入发件箱（不立即同步） */
export async function enqueue(
  side: Side,
  tableName: string,
  op: OutboxItem['op'],
  key: string,
  value: unknown
): Promise<OutboxItem> {
  const item: OutboxItem = {
    id: uid('ob'),
    side,
    table: tableName,
    op,
    key,
    value,
    status: 'pending',
    attempts: 0,
    lastError: '',
    createdAt: Date.now()
  }
  await db.outbox.put(item)
  return item
}

/** 同步某一端：把该端发件箱里未同步的条目按侧重试合并 */
export async function syncSide(side: Side): Promise<{ synced: number; failed: number }> {
  const items = await db.outbox.where('side').equals(side).toArray()
  const pending = items
    .filter((item) => item.status !== 'synced')
    .sort((a, b) => a.createdAt - b.createdAt)

  let synced = 0
  let failed = 0
  for (const item of pending) {
    item.attempts += 1
    if (simulateFailure) {
      item.status = 'failed'
      item.lastError = '模拟同步失败：网络中断，数据未合并'
      await db.outbox.put(item)
      failed += 1
      continue
    }
    try {
      await applyItem(item)
      item.status = 'synced'
      item.lastError = ''
      await db.outbox.put(item)
      synced += 1
    } catch (err) {
      item.status = 'failed'
      item.lastError = err instanceof Error ? err.message : String(err)
      await db.outbox.put(item)
      failed += 1
    }
  }
  return { synced, failed }
}

/** 某一端发件箱计数 */
export async function outboxCounts(side: Side): Promise<{ pending: number; failed: number }> {
  const items = await db.outbox.where('side').equals(side).toArray()
  return {
    pending: items.filter((item) => item.status === 'pending').length,
    failed: items.filter((item) => item.status === 'failed').length
  }
}
