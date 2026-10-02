export { TRENCH_SIZES, trenchKey, findTrenchConflict } from './trench'
export type { Trench, TrenchSize } from './trench'
export { UNIT_TYPES, INCLUSIONS, stratumThickness, isDepthInverted, isCodeDuplicated } from './stratum'
export type { Stratum, UnitType, Inclusion } from './stratum'
export { ARTIFACT_CATEGORIES, COMPLETENESS } from './artifact'
export type { Artifact, ArtifactCategory, Completeness } from './artifact'
export { RELATION_TYPES, RELATION_BASES } from './relation'
export type { Relation, RelationType, RelationBasis } from './relation'
export {
  SIDES,
  SIDE_LABELS,
  RECORDER_STRATUM_KEYS,
  CATALOG_STRATUM_KEYS,
  pickKeys,
  createCatalogRecord
} from './catalog'
export type {
  Side,
  CatalogRecord,
  ArchiveStatus,
  ArchiveCheck,
  ArchiveConclusion,
  OutboxStatus,
  OutboxItem
} from './catalog'
