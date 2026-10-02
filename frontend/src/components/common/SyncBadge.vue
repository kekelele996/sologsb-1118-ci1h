<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '@/hooks/usePersistentStore'
import { syncStore } from '@/stores/syncStore'
import type { SyncDirection } from '@/services/syncEngine'

const props = defineProps<{
  direction: SyncDirection
  label: string
}>()

const state = useStore(syncStore)

const side = computed(() => state[props.direction])

const tagType = computed<'success' | 'danger' | 'warning' | 'info'>(() => {
  if (side.value.running) return 'warning'
  if (side.value.phase === 'success') return 'success'
  if (side.value.phase === 'failed') return 'danger'
  return 'info'
})

const text = computed(() => {
  if (side.value.running) return '同步中'
  switch (side.value.phase) {
    case 'success':
      return '已同步'
    case 'failed':
      return '同步失败'
    default:
      return '未同步'
  }
})

const timeText = computed(() => {
  const value = side.value.lastSuccessAt
  if (!value) return ''
  return new Date(value).toLocaleTimeString('zh-CN', { hour12: false })
})

function retry(): void {
  void syncStore.getState().sync(props.direction)
}
</script>

<template>
  <span class="sync-badge" :class="`is-${tagType}`">
    <el-tag :type="tagType" size="small" effect="plain" :loading="false">
      <span class="dot" :class="{ pulse: side.running }" />
      {{ label }}：{{ text }}<template v-if="timeText && side.phase === 'success'"> · {{ timeText }}</template>
    </el-tag>
    <el-button
      v-if="side.phase === 'failed'"
      link
      type="danger"
      size="small"
      class="retry"
      @click="retry"
    >
      重试本侧
    </el-button>
    <el-tooltip v-if="side.phase === 'failed' && side.lastError" :content="side.lastError" placement="top">
      <el-icon class="err-icon"><WarningFilled /></el-icon>
    </el-tooltip>
  </span>
</template>

<style scoped>
.sync-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  margin-right: 4px;
}
.dot.pulse {
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
.retry {
  font-size: 12px;
}
.err-icon {
  color: #c0392b;
  font-size: 14px;
}
</style>
