import { computed, type Ref } from 'vue'
import type { CatalogRecord, Stratum } from '@/types'

export interface LayerSequenceItem {
  stratum: Stratum
  catalog: CatalogRecord | null
  /** 统一单位号（编目员未定时回退为原始单位号） */
  unifiedCode: string
  /** 跨探方层位序号（1 起） */
  order: number
  /** 是否为手动排序 */
  manual: boolean
  /** 裁定理由（编目员填写，深度改动重算后照旧保留） */
  rationale: string
}

export interface LayerSequenceResult {
  items: Ref<LayerSequenceItem[]>
  /** 自动排序（按深度）的单位数 */
  autoCount: Ref<number>
  /** 手动置顶的单位数 */
  manualCount: Ref<number>
}

/**
 * 跨探方层位序列：
 * - 深度（记录员维护）一改动，引用它的序列就按上界深度自动重算；
 * - 编目员手动排定（sequenceOrder）的单位优先置顶，其余按深度浅 → 深自动排序；
 * - 编目员写下的裁定理由（rationale）是持久化字段，重算不会丢失。
 */
export function useLayerSequence(
  strata: Ref<Stratum[]>,
  catalogs: Ref<CatalogRecord[]>
): LayerSequenceResult {
  const byStratum = computed(() => {
    const map = new Map<string, CatalogRecord>()
    catalogs.value.forEach((catalog) => map.set(catalog.stratumId, catalog))
    return map
  })

  const items = computed<LayerSequenceItem[]>(() => {
    const list = strata.value.map((stratum) => {
      const catalog = byStratum.value.get(stratum.id) ?? null
      const manual = catalog?.sequenceOrder != null
      return {
        stratum,
        catalog,
        unifiedCode: catalog?.unifiedCode || stratum.code,
        order: 0,
        manual,
        rationale: catalog?.rationale ?? ''
      }
    })

    list.sort((a, b) => {
      const oa = a.catalog?.sequenceOrder ?? null
      const ob = b.catalog?.sequenceOrder ?? null
      if (oa != null && ob != null) return oa - ob
      if (oa != null) return -1
      if (ob != null) return 1
      // 自动：按距地表上界深度升序（浅 → 深），相同则按下界、单位号
      if (a.stratum.topDepth !== b.stratum.topDepth) return a.stratum.topDepth - b.stratum.topDepth
      if (a.stratum.bottomDepth !== b.stratum.bottomDepth) return a.stratum.bottomDepth - b.stratum.bottomDepth
      return a.stratum.code.localeCompare(b.stratum.code, 'zh-Hans-CN')
    })

    list.forEach((item, index) => {
      item.order = index + 1
    })
    return list
  })

  const autoCount = computed(() => items.value.filter((item) => !item.manual).length)
  const manualCount = computed(() => items.value.filter((item) => item.manual).length)

  return { items, autoCount, manualCount }
}
