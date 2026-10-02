import type { ArchiveCheck, Artifact, Relation, Stratum } from '@/types'

/**
 * 归档前三核对：
 * 1. 跨探方叠压核对 —— 叠压/打破关系与深度是否矛盾（A 压 B 则 A 应更浅）
 * 2. 单位号重复核对 —— 同一探方内统一单位号是否重复
 * 3. 出土物深度越界核对 —— 出土物 Z 深度是否落在所属地层单位的深度区间内
 * 任一不过则归档挂起。
 */
export function runArchiveChecks(strata: Stratum[], artifacts: Artifact[], relations: Relation[]): ArchiveCheck[] {
  // 1. 跨探方叠压核对
  const superpositionIssues: string[] = []
  relations.forEach((relation) => {
    if (relation.type === '共存') return
    const a = strata.find((item) => item.id === relation.unitAId)
    const b = strata.find((item) => item.id === relation.unitBId)
    if (!a || !b) return
    if (a.topDepth > b.topDepth) {
      const cross = a.trenchId !== b.trenchId
      superpositionIssues.push(
        `${cross ? '跨探方 ' : ''}${a.code} ${relation.type} ${b.code}，但 ${a.code} 上界深度 ${a.topDepth} m 深于 ${b.code} ${b.topDepth} m，叠压关系与深度矛盾`
      )
    }
  })

  // 2. 单位号重复核对（同一探方内统一单位号）
  const duplicateIssues: string[] = []
  const byTrench = new Map<string, Map<string, number>>()
  strata.forEach((item) => {
    const bucket = byTrench.get(item.trenchId) ?? new Map<string, number>()
    const key = (item.unifiedCode || item.code).trim().toUpperCase()
    bucket.set(key, (bucket.get(key) ?? 0) + 1)
    byTrench.set(item.trenchId, bucket)
  })
  byTrench.forEach((bucket, trenchId) => {
    bucket.forEach((count, code) => {
      if (count > 1) duplicateIssues.push(`探方 ${trenchId} 统一单位号「${code}」重复 ${count} 次`)
    })
  })

  // 3. 出土物深度越界核对
  const depthIssues: string[] = []
  artifacts.forEach((artifact) => {
    const stratum = strata.find((item) => item.id === artifact.stratumId)
    if (!stratum) {
      depthIssues.push(`出土物 ${artifact.code} 找不到所属地层单位`)
      return
    }
    if (artifact.z < stratum.topDepth || artifact.z > stratum.bottomDepth) {
      depthIssues.push(
        `出土物 ${artifact.code} 深度 ${artifact.z} m 越出单位「${stratum.code}」区间（${stratum.topDepth}–${stratum.bottomDepth} m）`
      )
    }
  })

  return [
    { key: 'superposition', label: '跨探方叠压核对', passed: superpositionIssues.length === 0, issues: superpositionIssues },
    { key: 'duplicateCode', label: '单位号重复核对', passed: duplicateIssues.length === 0, issues: duplicateIssues },
    { key: 'artifactDepth', label: '出土物深度越界核对', passed: depthIssues.length === 0, issues: depthIssues }
  ]
}

/** 三核对是否全部通过 */
export function allChecksPassed(checks: ArchiveCheck[]): boolean {
  return checks.every((check) => check.passed)
}
