import type { ArchiveCheckInput, ArchiveIssue } from '@/types/catalog'

/**
 * 归档前一次性核对：跨探方叠压、统一单位号重复、出土物深度越界。
 * 只要返回的 error 级问题非空，归档单就应挂起（不允许归档通过）。
 */
export function runArchiveCheck(input: ArchiveCheckInput): ArchiveIssue[] {
  const issues: ArchiveIssue[] = []
  const { trenches, strata, artifacts, relations, catalogs } = input

  const trenchById = new Map(trenches.map((item) => [item.id, item]))
  const stratumById = new Map(strata.map((item) => [item.id, item]))

  const unitLabel = (stratumId: string): string => {
    const stratum = stratumById.get(stratumId)
    if (!stratum) return `已删除单位(${stratumId})`
    const trench = trenchById.get(stratum.trenchId)
    return `${trench ? `${trench.area}·${trench.code} ` : ''}${stratum.code}`
  }

  // 1) 跨探方叠压：叠压/打破关系的双方分属不同探方，且上界深度关系相反 → 矛盾
  relations.forEach((relation) => {
    if (relation.type === '共存') return
    const a = stratumById.get(relation.unitAId)
    const b = stratumById.get(relation.unitBId)
    if (!a || !b) {
      const missing = !a ? relation.unitAId : relation.unitBId
      issues.push({
        type: 'orphanUnit',
        level: 'error',
        message: `层位关系「${relation.id}」引用的单位 ${missing} 在工地记录中已不存在，关系悬空`,
        refId: missing
      })
      return
    }
    if (a.trenchId === b.trenchId) return
    if (a.topDepth > b.topDepth) {
      issues.push({
        type: 'crossTrenchOverlay',
        level: 'error',
        message: `跨探方${relation.type}矛盾：${unitLabel(a.id)} ${relation.type} ${unitLabel(
          b.id
        )}，但前者上界 ${a.topDepth} m 深于后者 ${b.topDepth} m`,
        refId: a.id
      })
    }
  })

  // 2) 统一单位号：跨探方必须唯一
  const codeOwners = new Map<string, string[]>()
  catalogs.forEach((catalog) => {
    const code = catalog.unifiedCode.trim().toUpperCase()
    const owners = codeOwners.get(code) ?? []
    owners.push(catalog.id)
    codeOwners.set(code, owners)
  })
  codeOwners.forEach((unitIds, code) => {
    if (!code) {
      unitIds.forEach((unitId) => {
        issues.push({
          type: 'missingCode',
          level: 'error',
          message: `单位「${unitLabel(unitId)}」尚未裁定统一单位号`,
          refId: unitId
        })
      })
      return
    }
    if (unitIds.length > 1) {
      issues.push({
        type: 'duplicatedCode',
        level: 'error',
        message: `统一单位号「${code}」被 ${unitIds.length} 个跨探方单位占用：${unitIds
          .map((id) => unitLabel(id))
          .join('、')}`,
        refId: unitIds[0]
      })
    }
  })

  // 工地已删除单位、却仍留着编目行：无法参与归档
  catalogs.forEach((catalog) => {
    if (!stratumById.has(catalog.id)) {
      issues.push({
        type: 'orphanUnit',
        level: 'error',
        message: `编目行「${catalog.unifiedCode || catalog.id}」对应的工地单位已删除，需清理或待重新同步`,
        refId: catalog.id
      })
    }
  })

  // 3) 出土物深度越界：Z 必须落在所属单位的上下界深度区间内（兼容倒置写法取 min/max）
  artifacts.forEach((artifact) => {
    const stratum = stratumById.get(artifact.stratumId)
    if (!stratum) {
      issues.push({
        type: 'orphanUnit',
        level: 'error',
        message: `出土物「${artifact.code}」所属地层单位 ${artifact.stratumId} 已不存在，出土物脱离层位上下文`,
        refId: artifact.id
      })
      return
    }
    const upper = Math.min(stratum.topDepth, stratum.bottomDepth)
    const lower = Math.max(stratum.topDepth, stratum.bottomDepth)
    if (artifact.z < upper || artifact.z > lower) {
      issues.push({
        type: 'depthOutOfBounds',
        level: 'error',
        message: `出土物「${artifact.code}」深度 ${artifact.z} m 超出所属单位「${unitLabel(
          stratum.id
        )}」的区间（${upper}–${lower} m）`,
        refId: artifact.id
      })
    }
  })

  return issues
}

/** 有 error 级问题即挂起，否则通过 */
export function deriveArchiveStatus(issues: ArchiveIssue[]): 'passed' | 'suspended' {
  return issues.some((issue) => issue.level === 'error') ? 'suspended' : 'passed'
}
