<script setup lang="ts">
import { computed } from 'vue'
import type { MigrationStage } from '@/services/migration'

const props = defineProps<{
  stage: MigrationStage
  source: 'none' | 'legacy' | 'demo' | 'existing'
  error: string
}>()

const steps = computed(() => [
  { key: 'checking', label: '检查旧单库数据归属' },
  {
    key: 'copying-legacy',
    label:
      props.source === 'demo'
        ? '写入工地记录员份（探方 / 地层单位 / 出土物 / 层位关系）'
        : '把旧数据按归属迁到工地记录员份'
  },
  {
    key: 'seeding-demo',
    label: '建立整理室编目员份（统一单位号 / 跨探方层位序列 / 归档结论）'
  }
])

const activeIndex = computed(() => {
  switch (props.stage) {
    case 'checking':
      return 0
    case 'copying-legacy':
      return 1
    case 'seeding-demo':
      return 2
    case 'done':
      return 3
    default:
      return 0
  }
})

const isFailed = computed(() => props.stage === 'failed')
</script>

<template>
  <div class="migration-mask">
    <div class="panel">
      <div class="logo">探</div>
      <h2 class="title">考古探方地层编目台</h2>
      <p class="sub" v-if="!isFailed">首次打开：先把「缺归属」的旧数据分到工地、整理室两份，再启用</p>
      <p class="sub failed" v-else>迁移失败，旧库保持原样未改动，请重试</p>

      <ul class="steps">
        <li v-for="(step, index) in steps" :key="step.key" :class="{ done: index < activeIndex, active: index === activeIndex }">
          <span class="mark">
            <el-icon v-if="index < activeIndex && !isFailed"><Check /></el-icon>
            <el-icon v-else-if="index === activeIndex && !isFailed" class="spin"><Loading /></el-icon>
            <template v-else>{{ index + 1 }}</template>
          </span>
          <span>{{ step.label }}</span>
        </li>
      </ul>

      <el-alert
        v-if="isFailed && error"
        class="error"
        type="error"
        :closable="false"
        :title="error"
      />
      <slot />
    </div>
  </div>
</template>

<style scoped>
.migration-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: #4a3722;
  display: flex;
  align-items: center;
  justify-content: center;
}
.panel {
  width: 480px;
  max-width: calc(100vw - 40px);
  background: #fbfaf6;
  border-radius: 16px;
  padding: 32px 36px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
}
.logo {
  width: 52px;
  height: 52px;
  margin: 0 auto 12px;
  border-radius: 14px;
  background: linear-gradient(135deg, #e0c168, #a9762f);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 20px;
  color: #3c2f1f;
}
.title {
  margin: 0 0 6px;
  font-size: 18px;
  color: #3c2f1f;
}
.sub {
  margin: 0 0 20px;
  font-size: 12px;
  color: #8a8073;
}
.sub.failed {
  color: #c0392b;
}
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  text-align: left;
}
.steps li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
  font-size: 13px;
  color: #9c9080;
}
.steps li.active {
  color: #a9762f;
  font-weight: 600;
}
.steps li.done {
  color: #4a3722;
}
.mark {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  background: #ece3d2;
  color: #8a8073;
  flex-shrink: 0;
}
.steps li.done .mark {
  background: #a9762f;
  color: #fff;
}
.steps li.active .mark {
  background: #e0c168;
  color: #3c2f1f;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.error {
  margin-top: 16px;
  text-align: left;
}
</style>
