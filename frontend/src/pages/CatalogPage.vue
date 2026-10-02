<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UnitCatalog } from '@/types/catalog'
import { useStore } from '@/hooks/usePersistentStore'
import { officeStore } from '@/stores/officeStore'
import SyncBadge from '@/components/common/SyncBadge.vue'

const office = useStore(officeStore)

const filterTrenchId = ref('')
const onlyDuplicated = ref(false)
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const form = reactive({
  unifiedCode: '',
  decisionReason: ''
})

interface CatalogRow {
  catalog: UnitCatalog
  stratumId: string
  trenchLabel: string
  fieldCode: string
  type: string
  topDepth: number
  bottomDepth: number
  /** 工地单位是否还存在（镜像存在即存在） */
  alive: boolean
}

const rows = computed<CatalogRow[]>(() => {
  const trenchById = new Map(office.trenchShadows.map((item) => [item.id, item]))
  const stratumById = new Map(office.stratumShadows.map((item) => [item.id, item]))
  const list = office.catalogs
    .map((catalog): CatalogRow => {
      const stratum = stratumById.get(catalog.id)
      const trench = stratum ? trenchById.get(stratum.trenchId) : undefined
      return {
        catalog,
        stratumId: catalog.id,
        trenchLabel: trench ? `${trench.area} · ${trench.code}` : '—',
        fieldCode: stratum?.code ?? '（工地单位已删除）',
        type: stratum?.type ?? '—',
        topDepth: stratum?.topDepth ?? NaN,
        bottomDepth: stratum?.bottomDepth ?? NaN,
        alive: Boolean(stratum)
      }
    })
    .filter((row) => {
      if (filterTrenchId.value) {
        const stratum = office.stratumShadows.find((item) => item.id === row.stratumId)
        if (!stratum || stratum.trenchId !== filterTrenchId.value) return false
      }
      if (onlyDuplicated.value && !duplicatedCodes.value.has(row.catalog.unifiedCode.trim().toUpperCase())) {
        return false
      }
      return true
    })
  list.sort((a, b) => a.catalog.orderIndex - b.catalog.orderIndex)
  return list
})

const duplicatedCodes = computed<Set<string>>(() => {
  const counter = new Map<string, number>()
  office.catalogs.forEach((catalog) => {
    const key = catalog.unifiedCode.trim().toUpperCase()
    if (!key) return
    counter.set(key, (counter.get(key) ?? 0) + 1)
  })
  const result = new Set<string>()
  counter.forEach((count, code) => {
    if (count > 1) result.add(code)
  })
  return result
})

function isDuplicated(catalog: UnitCatalog): boolean {
  return duplicatedCodes.value.has(catalog.unifiedCode.trim().toUpperCase())
}

function isMissing(catalog: UnitCatalog): boolean {
  return !catalog.unifiedCode.trim()
}

function openEdit(row: CatalogRow): void {
  editingId.value = row.stratumId
  form.unifiedCode = row.catalog.unifiedCode
  form.decisionReason = row.catalog.decisionReason
  dialogVisible.value = true
}

async function submit(): Promise<void> {
  if (!editingId.value) return
  if (!form.unifiedCode.trim()) {
    ElMessage.warning('请填写统一单位号（归档核对也会拦截空号）')
    return
  }
  const prev = office.catalogs.find((item) => item.id === editingId.value)
  if (!prev) return
  // 只更新编目员拥有的两个字段；层位序号由工地深度驱动重算，此处不动
  const next: UnitCatalog = {
    ...prev,
    unifiedCode: form.unifiedCode.trim().toUpperCase(),
    decisionReason: form.decisionReason.trim()
  }
  await officeStore.getState().saveCatalog(next)
  ElMessage.success(`统一单位号已裁定为「${next.unifiedCode}」，理由已留存`)
  dialogVisible.value = false
}

async function remove(row: CatalogRow): Promise<void> {
  await ElMessageBox.confirm(
    `确认删除编目行「${row.catalog.unifiedCode || row.fieldCode}」？裁定理由将一并删除（工地原始单位不受影响）。`,
    '删除确认',
    { type: 'warning' }
  )
  await officeStore.getState().removeCatalog(row.stratumId)
  ElMessage.success('编目行已删除')
}

async function addForOrphan(): Promise<void> {
  // 正常情况下工地新增单位会在同步时自动建行；此按钮用于手动补建
  const candidates = office.stratumShadows.filter(
    (stratum) => !office.catalogs.some((catalog) => catalog.id === stratum.id)
  )
  if (candidates.length === 0) {
    ElMessage.info('没有待补建编目行的单位')
    return
  }
  const ordered = [...candidates].sort((a, b) => a.topDepth - b.topDepth)
  await Promise.all(
    ordered.map((stratum, index) =>
      officeStore.getState().saveCatalog({
        id: stratum.id,
        unifiedCode: stratum.code,
        orderIndex: office.catalogs.length + index + 1,
        decisionReason: ''
      })
    )
  )
  ElMessage.success(`已为 ${candidates.length} 个新单位补建编目行`)
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">跨探方统一编目（整理室）</h2>
        <p class="page-sub">
          编目员只裁定统一单位号、跨探方层位序列与裁定理由；探方、地层深度、出土物等原始观察是工地镜像，只读。工地上下界深度一改动，引用它的层位序列自动重算，已写的裁定理由原样保留。
        </p>
      </div>
      <div class="head-sync">
        <SyncBadge direction="fieldToOffice" label="工地→整理室" />
        <SyncBadge direction="officeToField" label="整理室→工地" />
      </div>
    </div>

    <el-alert class="alert" type="info" :closable="false" show-icon>
      <template #title>层位序号按「上界深度 → 下界深度」自动排列；此处只能改统一号与裁定理由，改不动工地原始记录。</template>
    </el-alert>

    <div class="toolbar">
      <el-select v-model="filterTrenchId" placeholder="全部探方" clearable style="width: 190px">
        <el-option
          v-for="trench in office.trenchShadows"
          :key="trench.id"
          :label="`${trench.area} · ${trench.code}`"
          :value="trench.id"
        />
      </el-select>
      <el-checkbox v-model="onlyDuplicated">只看重复统一号</el-checkbox>
      <el-button plain @click="addForOrphan">为新同步单位补建编目行</el-button>
      <el-tag type="info" effect="plain">命中 {{ rows.length }} / {{ office.catalogs.length }} 行</el-tag>
    </div>

    <el-table :data="rows" border stripe row-key="stratumId">
      <el-table-column label="层位序号" width="90">
        <template #default="{ row }: { row: CatalogRow }">
          <b class="mono">{{ row.catalog.orderIndex }}</b>
        </template>
      </el-table-column>
      <el-table-column label="探方" width="150">
        <template #default="{ row }: { row: CatalogRow }">
          <span class="mono">{{ row.trenchLabel }}</span>
        </template>
      </el-table-column>
      <el-table-column label="工地单位号(只读)" width="140">
        <template #default="{ row }: { row: CatalogRow }">
          <span class="mono">{{ row.fieldCode }}</span>
          <el-tag v-if="!row.alive" type="info" size="small" effect="plain" class="mini">原单位已删</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="90">
        <template #default="{ row }: { row: CatalogRow }">{{ row.type }}</template>
      </el-table-column>
      <el-table-column label="上下界深度(只读)" width="150">
        <template #default="{ row }: { row: CatalogRow }">
          <span v-if="row.alive" class="mono">{{ row.topDepth }} – {{ row.bottomDepth }} m</span>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="统一单位号" width="150">
        <template #default="{ row }: { row: CatalogRow }">
          <span class="mono unified">{{ row.catalog.unifiedCode || '—' }}</span>
          <el-tag v-if="isDuplicated(row.catalog)" type="danger" size="small" effect="dark" class="mini">跨方重复</el-tag>
          <el-tag v-else-if="isMissing(row.catalog)" type="warning" size="small" effect="dark" class="mini">待裁定</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="裁定理由" min-width="220">
        <template #default="{ row }: { row: CatalogRow }">
          <span v-if="row.catalog.decisionReason">{{ row.catalog.decisionReason }}</span>
          <span v-else class="muted">未填写（重算序列不会清空此处）</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }: { row: CatalogRow }">
          <el-button link type="primary" size="small" @click="openEdit(row)">裁定</el-button>
          <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="裁定统一单位号与层位理由" width="560px">
      <el-form label-width="120px">
        <el-form-item label="统一单位号" required>
          <el-input v-model="form.unifiedCode" placeholder="跨探方唯一，如 Ⅱ-L02" />
        </el-form-item>
        <el-form-item label="裁定理由">
          <el-input
            v-model="form.decisionReason"
            type="textarea"
            :rows="4"
            placeholder="如：T0501②与 T0503②土质土色一致、深度相当，统一编为 Ⅱ-L02…（工地改动深度触发序列重算时，此理由照旧保留）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存裁定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.page-title {
  margin: 0 0 6px;
  font-size: 20px;
}
.page-sub {
  margin: 0;
  font-size: 13px;
  color: #8a8073;
  max-width: 760px;
  line-height: 1.7;
}
.head-sync {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.alert {
  margin-bottom: 14px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.mono {
  font-family: 'SFMono-Regular', Consolas, monospace;
}
.unified {
  font-weight: 700;
  color: #a9762f;
}
.mini {
  margin-left: 6px;
}
.muted {
  color: #a99e8e;
}
</style>
