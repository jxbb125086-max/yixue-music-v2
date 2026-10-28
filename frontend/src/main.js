// 确保 polyfill 在最顶部
import { Buffer } from 'buffer'
import process from 'process'
import stream from 'stream-browserify'
import util from 'util'
import events from 'events'
import assert from 'assert'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

// 全局注入
window.Buffer = Buffer
window.process = process
window.stream = stream
window.util = util
window.events = events
window.assert = assert
window.global = window

// 原有导入
import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import './style.css'
import router from './router/index.js'

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}

app.use(ElementPlus, { locale: zhCn })
app.use(router)
app.mount('#app')
