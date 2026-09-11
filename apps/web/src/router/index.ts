import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../services/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'layout',
      redirect: { name: 'dashboard' },
      component: () => import('../layouts/Layout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('../views/dashboard/Dashboard.vue')
        }
      ]
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/login/three/Login.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/login/three/Login.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const { isAuthenticated } = useAuth()

  if (to.meta.requiresAuth && !isAuthenticated.value) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if ((to.name === 'login' || to.name === 'register') && isAuthenticated.value) {
    return { name: 'home' }
  }
})

export default router
