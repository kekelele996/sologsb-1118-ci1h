import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/trenches' },
  {
    path: '/trenches',
    name: 'trenches',
    component: () => import('@/pages/TrenchesPage.vue'),
    meta: { title: '探方清单', role: 'field' }
  },
  {
    path: '/strata',
    name: 'strata',
    component: () => import('@/pages/StrataPage.vue'),
    meta: { title: '地层单位编目', role: 'field' }
  },
  {
    path: '/artifacts',
    name: 'artifacts',
    component: () => import('@/pages/ArtifactsPage.vue'),
    meta: { title: '出土物登记', role: 'field' }
  },
  {
    path: '/relations',
    name: 'relations',
    component: () => import('@/pages/RelationsPage.vue'),
    meta: { title: '层位关系', role: 'field' }
  },
  {
    path: '/sections',
    name: 'sections',
    component: () => import('@/pages/SectionsPage.vue'),
    meta: { title: '四壁剖面示意', role: 'field' }
  },
  {
    path: '/catalog',
    name: 'catalog',
    component: () => import('@/pages/CatalogPage.vue'),
    meta: { title: '统一单位号与跨探方层位序列', role: 'office' }
  },
  {
    path: '/archive',
    name: 'archive',
    component: () => import('@/pages/ArchivePage.vue'),
    meta: { title: '归档结论', role: 'office' }
  },
  {
    path: '/sync',
    name: 'sync',
    component: () => import('@/pages/SyncPage.vue'),
    meta: { title: '同步中心', role: 'system' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/trenches' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? '考古探方地层编目台'
  document.title = `${title} · 考古探方地层编目台`
})

export default router
