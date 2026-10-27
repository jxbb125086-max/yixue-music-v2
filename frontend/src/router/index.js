import { createRouter, createWebHistory } from 'vue-router'
import TeacherLive from '../views/TeacherLive.vue'
import StudentView from '../views/StudentView.vue'

const routes = [
    { path: '/', component: TeacherLive, name: 'teacher' },
    { path: '/student/:roomId', component: StudentView, name: 'student' }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

// 排版台等静态资源路径：交给 Vite 直接返回文件，不走 Vue Router。
// 用 catch-all 的 beforeEach 守卫来放行，避免 history 模式拦截 404。
const STATIC_PREFIXES = ['/sources/', '/composer/']

router.beforeEach((to, from, next) => {
    if (STATIC_PREFIXES.some(p => to.path.startsWith(p))) {
        // 静态资源路径：不进入 Vue 组件渲染，直接放行让 Vite 接管
        // 由于这些路径不在路由表里，Vue Router 默认会 404；
        // 这里阻止 Vue 尝试渲染，浏览器会走 Vite 的静态文件服务
        next(false) // abort navigation
    } else {
        next()
    }
})

export default router
