import type { Artifact, Relation, Stratum, Trench } from '@/types'
import type { UnitCatalog } from '@/types/catalog'

/** 首次打开（无任何历史数据）时写入工地库的示例数据 */
export function demoTrenches(today: string): Trench[] {
  return [
    {
      id: 'tr_0501',
      code: 'T0501',
      area: 'Ⅱ区',
      size: '5×5 米',
      basePoint: 'N1200 / E3000',
      openLayer: '第①层',
      startDate: today,
      endDate: '',
      leader: '方铭',
      wallNote: '北壁、东壁保存较好；南壁被现代扰坑破坏',
      backfilled: false
    },
    {
      id: 'tr_0502',
      code: 'T0502',
      area: 'Ⅱ区',
      size: '5×5 米',
      basePoint: 'N1205 / E3000',
      openLayer: '第①层',
      startDate: today,
      endDate: today,
      leader: '方铭',
      wallNote: '四壁规整，西壁可见 H12 剖面',
      backfilled: true
    }
  ]
}

export function demoStrata(today: string): Stratum[] {
  return [
    {
      id: 'st_0501_l1',
      trenchId: 'tr_0501',
      code: 'L01',
      type: '地层',
      openLayer: '第①层',
      topDepth: 0,
      bottomDepth: 0.25,
      soil: '灰褐色砂质黏土，疏松',
      inclusions: ['陶片', '炭屑'],
      formation: '近现代耕土层',
      date: today,
      drawingNo: 'T0501-北壁-01'
    },
    {
      id: 'st_0501_l2',
      trenchId: 'tr_0501',
      code: 'L02',
      type: '地层',
      openLayer: '第②层',
      topDepth: 0.25,
      bottomDepth: 0.6,
      soil: '黄褐色黏土，致密',
      inclusions: ['陶片', '骨'],
      formation: '汉代文化层',
      date: today,
      drawingNo: 'T0501-北壁-02'
    },
    {
      id: 'st_0501_h12',
      trenchId: 'tr_0501',
      code: 'H12',
      type: '灰坑',
      openLayer: '第②层下',
      topDepth: 0.6,
      bottomDepth: 1.4,
      soil: '深灰褐土，含大量灰烬',
      inclusions: ['陶片', '骨', '炭屑'],
      formation: '生活垃圾坑',
      date: today,
      drawingNo: 'T0501-H12-平剖面'
    },
    {
      id: 'st_0502_l1',
      trenchId: 'tr_0502',
      code: 'L01',
      type: '地层',
      openLayer: '第①层',
      topDepth: 0,
      bottomDepth: 0.3,
      soil: '灰褐色砂质黏土',
      inclusions: ['陶片'],
      formation: '耕土层',
      date: today,
      drawingNo: 'T0502-西壁-01'
    }
  ]
}

export function demoArtifacts(today: string): Artifact[] {
  return [
    {
      id: 'af_001',
      stratumId: 'st_0501_l2',
      code: 'T0501②:1',
      category: '陶器',
      count: 3,
      completeness: '残片',
      x: 2.4,
      y: 1.8,
      z: 0.42,
      date: today,
      collector: '祁野',
      tempLocation: '工地临时柜 A-2'
    },
    {
      id: 'af_002',
      stratumId: 'st_0501_h12',
      code: 'T0501H12:1',
      category: '骨器',
      count: 1,
      completeness: '可复原',
      x: 3.1,
      y: 3.6,
      z: 1.05,
      date: today,
      collector: '祁野',
      tempLocation: '工地临时柜 A-3'
    }
  ]
}

export function demoRelations(): Relation[] {
  return [
    {
      id: 'rl_001',
      unitAId: 'st_0501_h12',
      type: '打破',
      unitBId: 'st_0501_l2',
      basis: '剖面观察',
      recorder: '方铭',
      note: 'H12 开口于第②层下，打破 L02'
    },
    {
      id: 'rl_002',
      unitAId: 'st_0501_l1',
      type: '叠压',
      unitBId: 'st_0501_l2',
      basis: '剖面观察',
      recorder: '方铭',
      note: 'L01 叠压 L02，界面清晰'
    }
  ]
}

/**
 * 由地层单位构建编目行（首次迁移 / 工地 → 整理室同步补齐新单位时使用）：
 * 统一单位号默认取工地单位号，层位序号按深度排，裁定理由留空，待编目员补。
 */
export function buildInitialCatalogs(strata: Stratum[]): UnitCatalog[] {
  return sortByDepth(strata).map((stratum, index) => ({
    id: stratum.id,
    unifiedCode: stratum.code,
    orderIndex: index + 1,
    decisionReason: ''
  }))
}

/** 按距地表深度（上界 → 下界 → 单位号）排序，返回新数组 */
export function sortByDepth<T extends Pick<Stratum, 'topDepth' | 'bottomDepth' | 'code'>>(strata: T[]): T[] {
  return [...strata].sort((a, b) => {
    if (a.topDepth !== b.topDepth) return a.topDepth - b.topDepth
    if (a.bottomDepth !== b.bottomDepth) return a.bottomDepth - b.bottomDepth
    return a.code.localeCompare(b.code, 'zh-Hans-CN')
  })
}
