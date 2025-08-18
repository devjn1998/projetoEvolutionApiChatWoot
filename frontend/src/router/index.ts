import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import DashboardView from '../views/DashboardView.vue'
import LandingView from '../views/LandingView.vue'
import AgentsView from '../views/AgentsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: LandingView
    },
    {
      path: '/agents',
      name: 'agents',
      component: AgentsView
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView
      // Adicionaremos a guarda de rota (meta: { requiresAuth: true }) aqui mais tarde
    }
  ]
})

// Lógica de guarda de rota (navigation guard) virá aqui
// router.beforeEach((to, from, next) => { ... });

export default router
