<template>
  <div class="student">
    <!-- ═══ 顶栏 ═══ -->
    <header class="topbar">
      <div class="brand">
        <svg class="logo" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
          <rect x="1.5" y="1.5" width="25" height="25" rx="8" fill="#E0B15E"/>
          <rect x="6.5" y="7" width="3" height="14" rx="1" fill="#1A1408"/>
          <rect x="11.5" y="7" width="3" height="14" rx="1" fill="#1A1408"/>
          <rect x="16.5" y="7" width="3" height="14" rx="1" fill="#1A1408"/>
          <rect x="9.2" y="7" width="2.2" height="8.5" fill="#E0B15E"/>
          <rect x="14.2" y="7" width="2.2" height="8.5" fill="#E0B15E"/>
        </svg>
        <span class="topbar-title">易学音乐沙龙</span>
      </div>
      <div class="topbar-right">
        <span class="chip hide-m">{{ teacherName || '老师' }} 的沙龙</span>
        <span class="chip" :class="connected ? 'green' : ''">
          <span class="dot" :class="connected ? 'green' : 'gray'"></span>{{ connected ? '已连接' : '连接中' }}
        </span>
      </div>
    </header>

    <!-- ═══ ① 进入：姓名 ═══ -->
    <main v-if="!hasJoined" class="entry">
      <div class="entry-card card">
        <svg class="logo-lg" viewBox="0 0 28 28" width="68" height="68" aria-hidden="true">
          <rect x="1.5" y="1.5" width="25" height="25" rx="8" fill="#E0B15E"/>
          <rect x="6.5" y="7" width="3" height="14" rx="1" fill="#1A1408"/>
          <rect x="11.5" y="7" width="3" height="14" rx="1" fill="#1A1408"/>
          <rect x="16.5" y="7" width="3" height="14" rx="1" fill="#1A1408"/>
          <rect x="9.2" y="7" width="2.2" height="8.5" fill="#E0B15E"/>
          <rect x="14.2" y="7" width="2.2" height="8.5" fill="#E0B15E"/>
        </svg>
        <h1 class="entry-title">欢迎加入沙龙</h1>
        <p class="entry-sub">输入姓名即可进入<br/>看老师的画面 · 公屏聊天 · 被邀请后连线发言</p>
        <div class="entry-field">
          <label class="field-label">您的姓名 <span class="field-tip">老师和同学将看到</span></label>
          <el-input v-model="studentName" placeholder="例如：王小明" maxlength="12" size="large"
            @keyup.enter="joinClass" />
          <p v-if="nameError" class="name-error">{{ nameError }}</p>
        </div>
        <el-button class="btn-primary entry-btn" size="large" @click="joinClass" :disabled="!studentName.trim()">
          进入沙龙
        </el-button>
        <div class="entry-steps">
          <div class="step"><i>1</i><span>输入姓名</span></div>
          <div class="step"><i>2</i><span>看讲课画面</span></div>
          <div class="step"><i>3</i><span>公屏互动</span></div>
        </div>
      </div>
    </main>

    <!-- ═══ ② 上课中 ═══ -->
    <main v-else-if="!showErrorPage" class="live" ref="liveRef">
      <div class="live-main" ref="mainRef">
        <!-- 舞台：老师端采集的是 16:9，这里固定 16:9，画面刚好铺满；全屏只走右下角按钮 -->
        <div class="stage-area" ref="areaRef" :class="{ 'is-immersive': immersive }">
          <div class="video-stage card" ref="stageRef" :class="{ immersive }">
            <video ref="videoRef" autoplay playsinline></video>
            <div v-if="!connected" class="video-hint"><span class="spinner"></span>正在连接老师的画面…</div>
            <button v-if="needTap" class="resume-btn" @click="resumeVideo">▶ 点击继续播放</button>
            <button v-if="!immersive" class="fs-btn" :class="{ on: nativeFs }" @click="toggleFullscreen"
              :title="nativeFs ? '退出全屏（Esc）' : '全屏观看'">
              <svg v-if="!nativeFs" viewBox="0 0 24 24" width="16" height="16" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" />
              </svg>
              <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 9h5V4M20 9h-5V4M20 15h-5v5M4 15h5v5" />
              </svg>
              <span>{{ nativeFs ? '退出全屏' : '全屏' }}</span>
            </button>
          </div>
        </div>

        <!-- 连线控制（手机上的主操作，放在画面正下方；桌面上挪进右栏，见 .connect-card） -->
        <div v-if="!isWide" class="connect-zone">
          <button class="connect-btn" :class="'is-' + speakState" @click="onConnectClick">
            <span class="connect-dot"></span>
            <span class="connect-text">{{ connectText }}</span>
            <span class="connect-sub">{{ connectSub }}</span>
          </button>
          <button v-if="speakState === 'live'" class="mute-btn" :class="{ off: !micOn }" @click="toggleMic">
            {{ micOn ? '🎙 声音开启中' : '🔇 已静音' }}
          </button>
        </div>

        <!-- 音频设置 -->
        <div class="audio-bar card">
          <div class="audio-group">
            <span class="audio-label">🎤 麦克风</span>
            <el-select v-model="selectedMic" size="small" class="audio-select" @change="onMicChange">
              <el-option v-for="d in audioDevices.mics" :key="d.deviceId"
                :label="d.label || '麦克风 ' + (audioDevices.mics.indexOf(d)+1)" :value="d.deviceId" />
            </el-select>
            <div class="vol-bar sm"><div class="vol-fill" :style="{ width: micVolume + '%' }"></div></div>
          </div>
          <div class="audio-group hide-m">
            <span class="audio-label">🔊 扬声器</span>
            <el-select v-model="selectedSpeaker" size="small" class="audio-select" @change="onSpeakerChange">
              <el-option v-for="d in audioDevices.speakers" :key="d.deviceId"
                :label="d.label || '扬声器 ' + (audioDevices.speakers.indexOf(d)+1)" :value="d.deviceId" />
            </el-select>
          </div>
        </div>
      </div>

      <!-- 沉浸式全屏时的浮层：右下角圆形小按钮，画面之外不放其它东西 -->
      <template v-if="immersive">
        <button class="immersive-exit" @click="toggleFullscreen" title="退出全屏">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </template>

      <!-- 右栏：桌面放「连线卡 + 公屏」，手机只放公屏 -->
      <div class="live-rail">
        <!-- 桌面：接受连线挪到公屏上方，做成紧凑一行（原来横在画面下方那条太大了） -->
        <section v-if="isWide" class="card connect-card" :class="'is-' + speakState">
          <span class="cc-dot"></span>
          <div class="cc-meta">
            <b class="cc-title">{{ ccTitle }}</b>
            <span class="cc-sub">{{ ccSub }}</span>
          </div>
          <button v-if="speakState === 'live'" class="cc-btn mic" :class="{ off: !micOn }"
            @click="toggleMic" :title="micOn ? '点击静音' : '点击开麦'">
            {{ micOn ? '🎙' : '🔇' }}
          </button>
          <button v-if="speakState === 'invited'" class="cc-btn primary" @click="onConnectClick">接受连线</button>
          <button v-else-if="speakState === 'live'" class="cc-btn danger" @click="onConnectClick">断开</button>
        </section>

      <!-- 公屏聊天 -->
      <aside class="chat-card card">
        <header class="chat-head">
          <span class="chat-title">💬 沙龙公屏</span>
          <span class="chip">{{ chatMessages.length }} 条</span>
        </header>
        <div class="chat-scroll" ref="chatScroll">
          <div v-if="!chatMessages.length" class="chat-empty">说点什么吧，老师和同学都能看到</div>
          <div v-else class="chat-list">
            <template v-for="msg in chatMessages" :key="msg.id">
              <div v-if="msg.senderRole === 'system'" class="msg-sys"><span>{{ msg.content }}</span></div>
              <div v-else class="msg-row" :class="'role-' + msg.senderRole + (msg.senderId === myId ? ' mine' : '')">
                <span class="msg-name">{{ msg.senderName }}</span>
                <div class="msg-bubble" v-html="escapeHtml(msg.content)"></div>
              </div>
            </template>
          </div>
        </div>
        <div class="chat-input-row">
          <el-input v-model="chatInput" placeholder="说点什么，回车发送" @keyup.enter="sendChat" />
          <el-button type="primary" @click="sendChat">发送</el-button>
        </div>
        <div class="emoji-row">
          <button v-for="e in emojis" :key="e" class="emoji-btn" @click="insertEmoji(e)" :title="'插入 ' + e">{{ e }}</button>
        </div>
      </aside>
      </div>
    </main>

    <!-- ═══ ③ 错误 / 结束页 ═══ -->
    <main v-else class="error-page">
      <div class="error-card card">
        <div class="error-icon" :class="errorInfo.icon">{{ errorInfo.icon === 'error' ? '!' : 'i' }}</div>
        <h2 class="error-title">{{ errorInfo.title }}</h2>
        <p class="error-msg">{{ errorInfo.message }}</p>
        <div class="error-actions">
          <el-button type="primary" size="large" @click="retryConnection">重新连接</el-button>
          <el-button class="btn-ghost" size="large" @click="goHome">返回首页</el-button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import SimplePeer from 'simple-peer'
import { rtcConfig } from '../utils/rtc'
import { ElMessage } from 'element-plus'

const SERVER_URL = import.meta.env && import.meta.env.DEV ? 'http://localhost:3000' : undefined

const route = useRoute()
const router = useRouter()
const videoRef = ref(null)
const stageRef = ref(null)
const mainRef = ref(null)
const areaRef = ref(null)
const liveRef = ref(null)
const nativeFs = ref(false)     // 浏览器全屏中
const immersive = ref(false)    // CSS 沉浸式全屏中（无浏览器全屏能力时）
const chatScroll = ref(null)

// 桌面/手机两套连线位置：桌面进右栏（公屏上方），手机留在画面正下方
const isWide = ref(typeof window !== 'undefined' ? window.innerWidth >= 900 : true)
let wideMq = null
function onWideChange(e) { isWide.value = e.matches }
/* Chrome < 84 的 MediaQueryList 只有 addListener/removeListener */
function bindWideMq() {
    if (!wideMq) return
    if (typeof wideMq.addEventListener === 'function') wideMq.addEventListener('change', onWideChange)
    else if (typeof wideMq.addListener === 'function') wideMq.addListener(onWideChange)
}
function unbindWideMq() {
    if (!wideMq) return
    if (typeof wideMq.removeEventListener === 'function') wideMq.removeEventListener('change', onWideChange)
    else if (typeof wideMq.removeListener === 'function') wideMq.removeListener(onWideChange)
}

// ── 基础状态 ──
const hasJoined = ref(false)
const showErrorPage = ref(false)
const studentName = ref('')
const nameError = ref('')
const connected = ref(false)
const teacherName = ref('')
const myId = ref('')
const roomId = ref('')

// ── 连线状态：idle(灰) → invited(绿·待接受) → live(绿·连线中) ──
const speakState = ref('idle')
const micOn = ref(false)

// ── 聊天 ──
const chatMessages = ref([])
const chatInput = ref('')
const emojis = ['😊', '💗', '😅', '😂', '🙋', '👏', '🤝', '🎁']

// ── 音频设备 ──
const audioDevices = reactive({ mics: [], speakers: [] })
const selectedMic = ref('')
const selectedSpeaker = ref('')
const micVolume = ref(0)

// ── 网络 & 媒体 ──
let socket = null
let socketClosed = false
let peer = null
let lastStream = null      // 记住直播流：万一浏览器把它从 video 上摘掉，能立刻接回去
let micStream = null       // 自己的麦克风流（连线时推给老师）
let pendingAddStream = false // peer 未就绪时接受连线，就绪后补推
let audioContext = null, analyser = null, volumeInterval = null

const errorInfo = reactive({ icon: 'warning', title: '连接错误', message: '连接已断开，请重新尝试' })

const connectText = computed(() => {
    if (speakState.value === 'invited') return '接受连线'
    if (speakState.value === 'live') return micOn.value ? '连线中' : '静音中'
    return '连线'
})
const connectSub = computed(() => {
    if (speakState.value === 'invited') return '老师邀请了你，点击接入声音'
    if (speakState.value === 'live') return '大家都能听到你，点击断开'
    return '等待老师邀请你连线'
})
// 桌面连线卡用「状态标题 + 动作按钮」：标题说状态，按钮说动作，不要两处都写「接受连线」
const ccTitle = computed(() => {
    if (speakState.value === 'invited') return '老师邀请你连线'
    if (speakState.value === 'live') return micOn.value ? '连线中' : '已静音'
    return '未连线'
})
const ccSub = computed(() => {
    if (speakState.value === 'invited') return '接入后大家就能听到你说话'
    if (speakState.value === 'live') return '大家都能听到你，点「断开」结束'
    return '老师邀请后，这里会出现按钮'
})

// ── 工具 ──
function escapeHtml(str) {
    const div = document.createElement('div'); div.textContent = str; return div.innerHTML
}
function sendChat() {
    const content = chatInput.value.trim()
    if (!content || !roomId.value || !socket) return
    socket.emit('chat-message', { roomId: roomId.value, content })
    chatInput.value = ''
}
function insertEmoji(e) {
    chatInput.value += e
}

// ── 主列宽度 = 画面宽度，公屏吃掉所有剩余宽度 ──
// 画面是 16:9，窗口又宽又扁时会被「高度」卡住、比整列窄，于是画面和公屏之间空出一大块。
// 这里直接把主列宽度锁成画面宽度，公屏 flex 吃满剩余 → 任何尺寸都没有空隙。
// 关键：必须按「舞台可用高度」反算，绝不能按「当前画面宽度」迭代，
// 否则 width 变窄 → 可用高度变小 → 算出来更窄，会一路缩到底（自反馈死循环）。
let liveRO = null

/* 老款安卓（Chrome < 105 / 微信老 X5 内核）不支持 container-type + cqw/cqh，
   也不支持 aspect-ratio（< 88），纯 CSS 算出来的画面尺寸会塌成 0。
   这里用 JS 直接给画面写死 px，兼容一切 WebView；新浏览器同样走这条路，结果一致。 */
function fitStage() {
    const area = areaRef.value, stage = stageRef.value
    if (!area || !stage) return
    if (immersive.value || nativeFs.value) {
        stage.style.width = ''; stage.style.height = ''
        return
    }
    const aw = area.clientWidth, ah = area.clientHeight
    if (aw < 40 || ah < 40) return
    const w = Math.min(aw, ah * 16 / 9)
    stage.style.width = Math.round(w) + 'px'
    stage.style.height = Math.round(w * 9 / 16) + 'px'
}

function layoutLive() {
    const live = liveRef.value, area = areaRef.value, main = mainRef.value
    if (!live || !area || !main || !live.isConnected) return
    if (immersive.value || nativeFs.value) { fitStage(); return }       // 全屏时画面铺满视口，不用算
    if (window.innerWidth < 900) { main.style.width = ''; fitStage(); return }  // 单列布局
    const availH = area.clientHeight
    if (availH < 120) return
    const cs = getComputedStyle(live)
    const totalW = live.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    const gap = 16
    // 公屏的理想宽度（跟原来的 CSS clamp 一致），画面放得下就按它，放不下再让公屏吃剩余
    const railIdeal = Math.min(Math.max(window.innerWidth * 0.26, 336), 480)
    const byHeight = Math.round(availH * 16 / 9)
    const byWidth = Math.round(totalW - railIdeal - gap)
    const w = Math.max(320, Math.min(byHeight, byWidth))
    main.style.width = w + 'px'
    fitStage()
}
function watchLiveLayout() {
    const live = liveRef.value
    if (!live) return
    if (typeof ResizeObserver === 'undefined') { layoutLive(); return }
    if (liveRO) liveRO.disconnect()
    liveRO = new ResizeObserver(layoutLive)
    liveRO.observe(live)
    // 首帧音频条可能先换行再回单行，量两遍就稳了
    requestAnimationFrame(() => { layoutLive(); requestAnimationFrame(layoutLive) })
}
function unwatchLiveLayout() {
    if (liveRO) { liveRO.disconnect(); liveRO = null }
}

// ── 全屏观看 ──
// 两条路：
//   ① 浏览器全屏（桌面 / Android）—— 能自动横屏，体验最好
//   ② CSS 沉浸式（iPhone Safari、微信内置浏览器等不支持元素全屏的）——
//      纯 CSS 把画面铺满视口，完全不碰浏览器全屏，视频绝不会被系统播放器接管
// 注意：**绝不能再用 video.webkitEnterFullscreen()**，那会把 <video> 交给系统播放器，
// 退出后视频被暂停、还可能被搬离播放框，只能手动点播放才能恢复。
function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null }

function setImmersive(on) {
    const next = !!on
    if (immersive.value === next) return
    immersive.value = next
    document.documentElement.classList.toggle('stage-locked', next)
    if (next) lockLandscape()
    else { unlockOrientation(); resumeVideoSoon(); nextTick(layoutLive) }
}

async function toggleFullscreen() {
    const el = stageRef.value
    if (!el) return
    // 已经在全屏（任一种）→ 退出
    if (fsElement()) {
        try {
            const exit = document.exitFullscreen || document.webkitExitFullscreen
            if (exit) await exit.call(document)
        } catch (e) { /* 忽略 */ }
        return
    }
    if (immersive.value) { setImmersive(false); return }

    if (el.requestFullscreen || el.webkitRequestFullscreen) {
        try {
            if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' })
            else await el.webkitRequestFullscreen()
            lockLandscape()
            resumeVideoSoon()
            return
        } catch (e) { /* 被拒 → 退回 CSS 沉浸式 */ }
    }
    setImmersive(true)
}

function lockLandscape() {
    try {
        const o = screen.orientation
        if (o && typeof o.lock === 'function') o.lock('landscape').catch(() => { })
    } catch (e) { /* 忽略 */ }
}
function unlockOrientation() {
    try {
        const o = screen.orientation
        if (o && typeof o.unlock === 'function') o.unlock()
    } catch (e) { /* 忽略 */ }
}

// ── 播放守卫（本次修复的核心）──
// 浏览器在进出全屏、切后台回来时会把 <video> 暂停，而我们原来从不续播，
// 于是退出全屏后画面黑掉、要手点播放；再进全屏还是暂停态，看着就像「卡住」。
// 现在：只要「应该正在播」就自动续播，被拒就弹一个可点的续播浮层。
const wantsPlay = ref(false)
const needTap = ref(false)
let playFails = 0

function resumeVideo() {
    const v = videoRef.value
    if (!v || !wantsPlay.value) return
    if (!v.srcObject && lastStream) v.srcObject = lastStream
    if (!v.paused) return
    const p = v.play()
    if (p && p.catch) {
        p.then(() => { playFails = 0; needTap.value = false })
            .catch(() => {
                // 被自动播放策略拦下：给一个明确可点的按钮，而不是让用户猜
                if (++playFails >= 3) needTap.value = true
            })
    }
}
// 全屏切换后浏览器可能「过一会儿」才暂停，多补几次
function resumeVideoSoon(times = 5) {
    let n = 0
    const tick = () => { resumeVideo(); if (++n < times) setTimeout(tick, 160) }
    tick()
}
function onVideoPause() {
    if (!wantsPlay.value || document.hidden) return
    setTimeout(resumeVideo, 80)
}
function onVideoPlaying() { playFails = 0; needTap.value = false }
// 绑定一次即可：<video> 被浏览器暂停 / 恢复播放时都能收到
function bindVideoGuards() {
    const v = videoRef.value
    if (!v || v.dataset.guard === '1') return
    v.dataset.guard = '1'
    v.addEventListener('pause', onVideoPause)
    v.addEventListener('playing', onVideoPlaying)
}
function onVisibility() { if (!document.hidden) resumeVideoSoon() }
function onFullscreenChange() {
    nativeFs.value = !!fsElement()
    if (!nativeFs.value) unlockOrientation()
    resumeVideoSoon()   // ← 关键：进出全屏都立刻续播
    nextTick(layoutLive)
}
function onKeydown(e) {
    if (e.key !== 'Escape') return
    if (immersive.value) setImmersive(false)
}

// ── 连线交互 ──
function onConnectClick() {
    if (speakState.value === 'idle') {
        ElMessage.info('等待老师邀请你连线；老师邀请后，这个按钮会变绿')
        return
    }
    if (speakState.value === 'invited') {
        // 接受连线：把自己的麦克风推进 peer
        speakState.value = 'live'
        micOn.value = true
        addMicToPeer()
        socket.emit('accept-speak', { roomId: roomId.value })
        ElMessage.success('已连线，大家能听到你了')
        return
    }
    // live → 主动断开：收麦、停轨
    speakState.value = 'idle'
    micOn.value = false
    removeMicFromPeer()
    socket.emit('end-speak', { roomId: roomId.value })
}
function toggleMic() {
    if (speakState.value !== 'live') return
    micOn.value = !micOn.value
    if (micStream) micStream.getAudioTracks().forEach(t => { t.enabled = micOn.value })
    socket.emit('toggle-mic', roomId.value)
}
function addMicToPeer() {
    if (!micStream) return
    if (peer && !peer.destroyed) {
        try { peer.addStream(micStream) } catch (e) { console.error('addStream 失败', e) }
        pendingAddStream = false
    } else {
        pendingAddStream = true // peer 就绪后补推
    }
}
function removeMicFromPeer() {
    if (peer && !peer.destroyed && micStream) {
        try { peer.removeStream(micStream) } catch (e) { }
    }
    pendingAddStream = false
    if (micStream) micStream.getAudioTracks().forEach(t => { t.enabled = true })
}

// ── 音频设备 ──
async function getAudioDevices() {
    try {
        const temp = await navigator.mediaDevices.getUserMedia({ audio: true })
        temp.getTracks().forEach(t => t.stop())
        const devices = await navigator.mediaDevices.enumerateDevices()
        audioDevices.mics = devices.filter(d => d.kind === 'audioinput')
        audioDevices.speakers = devices.filter(d => d.kind === 'audiooutput')
        if (audioDevices.mics.length > 0 && !selectedMic.value) selectedMic.value = audioDevices.mics[0].deviceId
        await startMicDetection()
    } catch (e) { console.error('获取设备失败', e) }
}
async function startMicDetection() {
    try {
        const constraints = selectedMic.value ? { audio: { deviceId: selectedMic.value } } : { audio: true }
        micStream = await navigator.mediaDevices.getUserMedia(constraints)
        startVolumeDetection(micStream)
    } catch (e) { console.error('[麦克风检测] 失败:', e) }
}
function startVolumeDetection(mediaStream) {
    stopVolumeDetection()
    if (!mediaStream?.getAudioTracks().length) return
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.3
    const src = audioContext.createMediaStreamSource(mediaStream)
    src.connect(analyser)
    const buf = new Uint8Array(analyser.fftSize)
    volumeInterval = setInterval(() => {
        if (audioContext.state === 'suspended') audioContext.resume()
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x }
        micVolume.value = Math.min(100, Math.round(Math.sqrt(sum / buf.length) * 400))
    }, 30)
}
function stopVolumeDetection() {
    if (volumeInterval) { clearInterval(volumeInterval); volumeInterval = null }
    if (audioContext) { audioContext.close().catch(() => { }); audioContext = null }
    micVolume.value = 0
}
function onMicChange() {
    if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null }
    startMicDetection()
    ElMessage.info('麦克风已切换')
}
function onSpeakerChange() {
    if (videoRef.value && typeof videoRef.value.setSinkId === 'function') {
        videoRef.value.setSinkId(selectedSpeaker.value)
            .then(() => ElMessage.success('扬声器已切换'))
            .catch(() => ElMessage.warning('切换失败'))
    }
}

// ── 加入 & 连接 ──
function joinClass() {
    if (!studentName.value.trim()) { nameError.value = '请输入姓名'; return }
    nameError.value = ''
    hasJoined.value = true
    initializeConnection()
    nextTick(watchLiveLayout)
}

function initializeConnection() {
    roomId.value = route.params.roomId
    socket = io(SERVER_URL, {
        reconnection: true, reconnectionAttempts: Infinity,
        reconnectionDelay: 1000, reconnectionDelayMax: 10000, timeout: 5000
    })
    myId.value = socket.id

    socket.on('room-info', ({ teacherName: tn, speaking }) => {
        teacherName.value = tn || '老师'
        // 刷新/重连后恢复连线状态
        if (speaking && speaking.studentId === socket.id) {
            speakState.value = speaking.status === 'live' ? 'live' : 'invited'
            micOn.value = speaking.status === 'live'
            if (speakState.value === 'live') addMicToPeer()
        }
    })
    socket.on('connect', () => { myId.value = socket.id })

    socket.on('chat-history', history => { chatMessages.value = history || [] })
    socket.on('chat-message', msg => { chatMessages.value.push(msg) })

    // 老师邀请连线
    socket.on('speak-invited', () => {
        speakState.value = 'invited'
        ElMessage.info('📨 老师邀请你连线，点绿色按钮接受')
    })
    // 连线结束（老师断开 / 取消邀请）
    socket.on('speak-ended', () => {
        speakState.value = 'idle'
        micOn.value = false
        removeMicFromPeer()
    })
    // 自己的麦克风状态（全员静音等场景）
    socket.on('user-mic-update', ({ id, micOn: m }) => {
        if (id === socket.id) micOn.value = m
    })

    socket.on('kicked', ({ teacherName: tn }) => {
        ElMessage.error(`您已被老师 ${tn || '老师'} 请出沙龙`)
        showErrorPage.value = true
        errorInfo.icon = 'error'
        errorInfo.title = '已被请出沙龙'
        errorInfo.message = `老师 ${tn || '老师'} 已将你请出沙龙`
        disconnectAll()
    })
    socket.on('class-ended', () => {
        ElMessage.info('课程已结束')
        showErrorPage.value = true
        errorInfo.icon = 'info'
        errorInfo.title = '课程已结束'
        errorInfo.message = '老师已结束课程，感谢您的参与'
        disconnectAll()
    })

    socket.emit('join-room', { roomId: roomId.value, userName: studentName.value })

    socket.on('signal', ({ from, signal }) => {
        try {
            if (!peer || peer.destroyed) {
                peer = new SimplePeer({ initiator: false, trickle: false, objectMode: true, sdpTransform: s => s, config: rtcConfig() })
                peer.on('signal', data => socket.emit('signal', { to: from, from: socket.id, signal: data }))
                peer.on('stream', s => {
                    lastStream = s
                    wantsPlay.value = true
                    if (videoRef.value) {
                        videoRef.value.srcObject = s
                        connected.value = true
                        bindVideoGuards()
                        if (selectedSpeaker.value && typeof videoRef.value.setSinkId === 'function')
                            videoRef.value.setSinkId(selectedSpeaker.value).catch(() => { })
                        resumeVideoSoon()
                    }
                })
                peer.on('error', err => console.error('Peer error', err))
                peer.on('close', () => { connected.value = false; peer = null })
                // 连接时已在连线中 → 补推麦克风
                if (speakState.value === 'live' && micStream) {
                    try { peer.addStream(micStream) } catch (e) { }
                }
            }
            peer.signal(signal)
            if (pendingAddStream && micStream) {
                try { peer.addStream(micStream); pendingAddStream = false } catch (e) { }
            }
        } catch (err) { console.error('信号处理错误', err) }
    })

    // 断线自动重连：重连后重新加入并请求老师重发信令
    socket.on('disconnect', reason => {
        if (socketClosed || reason === 'io client disconnect') return
        connected.value = false
        if (peer) { try { peer.destroy() } catch (e) { }; peer = null }
    })
    socket.on('reconnect', () => {
        connected.value = false
        socket.emit('join-room', { roomId: roomId.value, userName: studentName.value })
        socket.emit('request-video', { roomId: roomId.value })
    })
}

function retryConnection() { showErrorPage.value = false; initializeConnection() }
function goHome() { router.push('/') }
function disconnectAll() {
    if (socket) socket.disconnect()
    const v = videoRef.value
    if (v?.srcObject) {
        v.srcObject.getTracks().forEach(t => t.stop())
        v.srcObject = null
    }
    if (peer) { try { peer.destroy() } catch (e) { }; peer = null }
    connected.value = false
    stopVolumeDetection()
}

watch(() => chatMessages.value.length, () => {
    nextTick(() => { const el = chatScroll.value; if (el) el.scrollTop = el.scrollHeight })
})

/* ── 老款安卓 / 老 WebView 能力探测 ──
   ① MediaQueryList 在 Chrome < 84 只有 addListener/removeListener，没有 addEventListener，
      直接调用会抛 TypeError 把整个 onMounted 打断（后面的设备枚举、布局全不执行）。
   ② flex gap 在 Chrome < 84 无效 → 卡片会全贴在一起，加 .no-flex-gap 用 margin 兜底。
   ③ backdrop-filter 在老安卓极耗性能 → 直接关掉。 */
function detectLegacyWebView() {
    const html = document.documentElement
    // flex gap 检测：两个纵向子项，有 gap 时容器高度会多出 10px
    try {
        // 两个 0 高度的子项：支持 flex gap 时容器高 10px，不支持时 0px
        const box = document.createElement('div')
        box.style.cssText = 'position:absolute;left:-9999px;top:0;display:flex;flex-direction:column;gap:10px'
        box.appendChild(document.createElement('div'))
        box.appendChild(document.createElement('div'))
        document.body.appendChild(box)
        const supported = box.getBoundingClientRect().height >= 9
        document.body.removeChild(box)
        if (!supported) html.classList.add('no-flex-gap')
    } catch (e) { html.classList.add('no-flex-gap') }
    // backdrop-filter 检测
    try {
        const ok = CSS && CSS.supports &&
            (CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'))
        if (!ok) html.classList.add('no-backdrop')
    } catch (e) { html.classList.add('no-backdrop') }
}

onMounted(async () => {
    detectLegacyWebView()
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('keydown', onKeydown)
    wideMq = window.matchMedia('(min-width: 900px)')
    isWide.value = wideMq.matches
    bindWideMq()
    await getAudioDevices()
    try {
        if (navigator.mediaDevices && navigator.mediaDevices.addEventListener)
            navigator.mediaDevices.addEventListener('devicechange', getAudioDevices)
    } catch (e) { /* 老浏览器没有 devicechange，忽略 */ }
})
onBeforeUnmount(() => {
    socketClosed = true
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
    document.removeEventListener('visibilitychange', onVisibility)
    document.removeEventListener('keydown', onKeydown)
    unbindWideMq()
    if (fsElement()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document) } catch (e) { } }
    setImmersive(false)
    unlockOrientation()
    unwatchLiveLayout()
    disconnectAll()
})
</script>

<style scoped>
/* 兜底顺序很讲究：老 WebView 认 100vh 不认 100dvh；新浏览器（地址栏伸缩）认 100dvh。
   最后写 dvh，认它的支持它；不支持的机型就停在前面的 100% 兜底上，保证永远有高度。 */
.student { width: 100%; min-height: 100%; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; }

/* ═══ 老款安卓降级（由 detectLegacyWebView() 打上 class）═══
   flex gap 在 Chrome < 84 无效，卡片会全贴在一起 → 用 margin 顶替 */
.no-flex-gap .live-rail > * + * { margin-top: 1rem; }
.no-flex-gap .live-main > * + * { margin-top: .75rem; }
.no-flex-gap .live > * + * { margin-top: 1rem; }
.no-flex-gap .audio-bar > * + * { margin-left: .6rem; }
.no-flex-gap .connect-zone > * + * { margin-left: .6rem; }
.no-flex-gap .error-actions > * + * { margin-left: .8rem; }
/* backdrop-filter 在老安卓极耗性能（还会闪）→ 直接换实色背景 */
.no-backdrop .topbar {
  backdrop-filter: none; -webkit-backdrop-filter: none;
  background: #0D1117;
}

/* ═══ 顶栏 ═══ */
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: .75rem 1.4rem;
  background: rgba(13,17,23,.82);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
  position: sticky; top: 0; z-index: 50;
  flex-shrink: 0;
}
.brand { display: flex; align-items: center; gap: .6rem; }
.topbar-title { font-size: 1.12rem; font-weight: 600; letter-spacing: .02em; }
.topbar-right { display: flex; align-items: center; gap: .5rem; }

/* ═══ ① 进入页 ═══ */
.entry { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem 1.2rem; }
.entry-card {
  width: 100%; max-width: 26rem; padding: 2.6rem 2.2rem; text-align: center;
  background: linear-gradient(180deg, var(--panel) 0%, #101620 100%);
  box-shadow: 0 24px 80px rgba(0,0,0,.5), 0 0 0 1px var(--line);
}
.logo-lg { margin-bottom: 1rem; filter: drop-shadow(0 6px 24px rgba(224,177,94,.35)); }
.entry-title { font-size: 1.7rem; font-weight: 600; margin: 0 0 .6rem; letter-spacing: .03em; }
.entry-sub { color: var(--text-2); font-size: .92rem; line-height: 1.8; margin: 0 0 2rem; }
.entry-field { text-align: left; margin-bottom: 1.4rem; }
.field-label { display: block; font-size: .92rem; color: var(--text-2); margin-bottom: .5rem; font-weight: 500; }
.field-tip { color: var(--text-3); font-size: .8rem; font-weight: 400; margin-left: .3rem; }
.name-error { color: var(--red); font-size: .82rem; margin: .5rem 0 0; }
.entry-btn { width: 100%; height: 3.2rem; font-size: 1.08rem; }
.entry-steps {
  display: flex; justify-content: center; gap: 1.2rem; margin-top: 1.8rem;
  padding-top: 1.4rem; border-top: 1px dashed var(--line-2);
}
.step { display: flex; align-items: center; gap: .4rem; color: var(--text-3); font-size: .8rem; }
.step i {
  width: 1.35rem; height: 1.35rem; border-radius: 50%; font-style: normal;
  background: var(--gold-soft); color: var(--gold); border: 1px solid var(--gold-line);
  display: inline-flex; align-items: center; justify-content: center; font-size: .72rem; font-weight: 600;
}

/* ═══ ② 上课中 ═══
   主列宽度由 JS 锁成「画面宽度」，公屏 flex 吃掉所有剩余宽度 —— 任何窗口尺寸都不会
   在画面和公屏之间留下空白（画面是 16:9，扁窗口下会被高度卡住而比整列窄）。 */
.live {
  flex: 1; display: flex; gap: 1rem; padding: 1rem 1.4rem 1.4rem;
  min-height: 0;
}
.live-main {
  flex: 0 0 auto; width: 100%;
  display: flex; flex-direction: column; gap: 1rem;
  min-width: 0; min-height: 0;
}

/* 右栏：桌面 = 连线卡 + 公屏；手机只放公屏。min-width 保证极窄屏时不被画面挤没 */
.live-rail {
  flex: 1 1 auto; min-width: 21rem;
  display: flex; flex-direction: column; gap: 1rem; min-height: 0;
}

/* ═══ 画面舞台：固定 16:9 ═══
   老师端采集的教学排版就是 16:9，这里按同样比例开框，画面刚好铺满、不留黑边。
   用容器查询单位算「能放下的最大 16:9 矩形」，纯 CSS，窗口怎么拉都是 16:9。 */
.stage-area {
  flex: 1; min-height: 0;
  container-type: size;
  display: flex; align-items: center; justify-content: flex-start;
}
/* 沉浸式时一定要关掉 container-type：它会带上 contain:layout，
   那样 position:fixed 就只相对这个盒子定位，铺不满整个视口。 */
.stage-area.is-immersive { container-type: normal; }
.video-stage {
  position: relative;
  width: min(100cqw, calc(100cqh * 16 / 9));
  aspect-ratio: 16 / 9;
  margin: 0;
  background: #05070A; border-color: #222D3D;
  overflow: hidden; display: block;
}
/* cover：源画面正好 16:9 时与 contain 等效；源画面带黑边时把黑边裁掉，绝不出现双重黑边 */
.video-stage video {
  display: block; width: 100%; height: 100%;
  object-fit: cover; background: #05070A;
}
.video-hint {
  /* 不用 inset：老安卓 WebView（Chrome < 87）不认 */
  position: absolute; top: 0; right: 0; bottom: 0; left: 0;
  display: flex; align-items: center; justify-content: center;
  gap: .7rem; color: var(--text-2); font-size: .95rem; pointer-events: none;
}
.spinner {
  width: 1.3rem; height: 1.3rem; border: 2.5px solid #2A3444; border-top-color: var(--gold);
  border-radius: 50%; animation: spin .9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* 全屏按钮：画面右下角，图标 + 文字，手机上也点得到 */
.fs-btn {
  position: absolute; right: .7rem; bottom: .7rem; z-index: 5;
  display: inline-flex; align-items: center; gap: .35rem;
  padding: .42rem .8rem .42rem .65rem;
  border-radius: 999px; border: 1px solid var(--line-2);
  background: rgba(10,14,20,.72); color: var(--text-2);
  font-size: .78rem; font-family: inherit; cursor: pointer;
  backdrop-filter: blur(8px); transition: all .15s;
}
.fs-btn:hover { color: var(--gold); border-color: var(--gold-line); background: rgba(10,14,20,.92); }
.fs-btn.on { color: var(--gold); border-color: var(--gold-line); }

/* 全屏：两种模式共用「铺满视口」的样式
   ① 浏览器全屏 → :fullscreen  ② CSS 沉浸式 → .immersive（iPhone / 应用内浏览器） */
.video-stage:fullscreen,
.video-stage:-webkit-full-screen,
.video-stage.immersive {
  position: fixed;
  left: 50%; top: 50%;
  width: 100vw; height: 100vh;
  max-width: none; max-height: none;
  aspect-ratio: auto;
  margin: 0; border: 0; border-radius: 0;
  background: #000;
  z-index: 9998;
  transform: translate(-50%, -50%);
}
/* 全屏时画面用 contain —— 宁可两侧留黑边，也不裁掉讲课内容 */
.video-stage:fullscreen video,
.video-stage:-webkit-full-screen video,
.video-stage.immersive video { object-fit: contain; }
.video-stage::backdrop { background: #000; }

/* 全屏就是「干净看画面」：连接提示一律收起，只留视频本身和退出按钮 */
.video-stage:fullscreen .video-hint,
.video-stage:-webkit-full-screen .video-hint,
.video-stage.immersive .video-hint { display: none; }

/* 竖着拿手机又没进真全屏（拿不到方向锁定）：把画面转 90°，
   用户把手机横过来就是满屏，不用等系统转屏。只对触屏生效，桌面不动。 */
@media (orientation: portrait) {
  html.is-touch .video-stage.immersive {
    width: 100vh; height: 100vw;
    width: 100dvh; height: 100dvw;
    transform: translate(-50%, -50%) rotate(90deg);
  }
}

/* 沉浸式下的浮层（在旋转容器外面，永远正着）——整个全屏里只有这一个控件。
   放右下角、做小一点（图标按钮），不挡画面主体；转 90° 后仍能按到。 */
.immersive-exit {
  position: fixed; z-index: 10000;
  bottom: calc(env(safe-area-inset-bottom, 0px) + .9rem);
  right: calc(env(safe-area-inset-right, 0px) + .9rem);
  display: inline-flex; align-items: center; justify-content: center;
  width: 2.9rem; height: 2.9rem;
  border-radius: 50%; border: 1.5px solid var(--gold-line);
  background: rgba(10,14,20,.82); color: var(--gold);
  font-size: 1.15rem; font-family: inherit; cursor: pointer;
  backdrop-filter: blur(8px);
  box-shadow: 0 3px 12px rgba(0,0,0,.5);
  opacity: .95; transition: filter .15s, transform .1s;
}
.immersive-exit svg { width: 1.15rem; height: 1.15rem; }
.immersive-exit:hover,
.immersive-exit:active { filter: brightness(1.2); transform: scale(.96); }

/* 浏览器把播放拦下来时的兜底：给一个明确可点的按钮，而不是让用户猜 */
.resume-btn {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  z-index: 6; padding: .7rem 1.3rem; border-radius: 999px;
  border: 1px solid var(--gold-line); background: rgba(10,14,20,.86);
  color: var(--gold); font-size: .95rem; font-weight: 600;
  font-family: inherit; cursor: pointer; backdrop-filter: blur(8px);
}
.resume-btn:hover { background: rgba(224,177,94,.18); }

/* 音频设置条 */
.audio-bar {
  display: flex; align-items: center; gap: 1.2rem; padding: .65rem 1rem;
  flex-shrink: 0; flex-wrap: wrap;
  width: 100%;   /* 主列宽度已等于画面宽度，这里自然同宽 */
}
.audio-group { display: flex; align-items: center; gap: .55rem; min-width: 0; }
.audio-label { font-size: .82rem; color: var(--text-2); white-space: nowrap; }
.audio-select { width: 10rem; }
.vol-bar.sm { width: 4.5rem; flex: none; }

/* ═══ 桌面连线卡（右栏、公屏上方）═══
   原来那条横在画面下方的大按钮太占地方，这里压成一行：状态点 + 文案 + 一个按钮。 */
.connect-card {
  display: flex; align-items: center; gap: .7rem;
  padding: .72rem .9rem .72rem 1.05rem;
  /* 必须写死 flex：右栏是 flex 列，默认会跟着公屏一起被拉伸 */
  flex: 0 0 auto; align-self: stretch;
  transition: border-color .18s, background .18s;
}
.cc-dot {
  width: .6rem; height: .6rem; border-radius: 50%; flex-shrink: 0;
  background: var(--text-3); transition: background .18s, box-shadow .18s;
}
.cc-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .08rem; }
.cc-title { font-size: .95rem; font-weight: 600; color: var(--text-2); line-height: 1.3; }
.cc-sub {
  font-size: .75rem; color: var(--text-3); line-height: 1.3;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cc-btn {
  flex-shrink: 0; padding: .4rem .85rem; border-radius: 999px;
  border: 1px solid var(--line-2); background: var(--panel-2); color: var(--text-2);
  font-size: .84rem; font-weight: 600; font-family: inherit; cursor: pointer;
  transition: filter .15s, background .15s, border-color .15s;
}
.cc-btn.primary { background: var(--green); border-color: var(--green); color: #06281A; }
.cc-btn.primary:hover { filter: brightness(1.1); }
.cc-btn.danger { background: var(--red-soft); border-color: rgba(229,86,94,.45); color: var(--red); }
.cc-btn.danger:hover { background: rgba(229,86,94,.22); }
.cc-btn.mic { padding: .4rem .55rem; font-size: 1rem; line-height: 1; }
.cc-btn.mic.off { background: var(--panel-2); border-color: var(--line-2); }

/* 待接受：绿色呼吸，和原来那个大按钮的语义保持一致 */
.connect-card.is-invited {
  border-color: var(--green);
  background: linear-gradient(135deg, rgba(62,207,142,.2), rgba(62,207,142,.06));
  animation: breathe 1.6s ease-in-out infinite;
}
.connect-card.is-invited .cc-dot { background: var(--green); box-shadow: 0 0 12px var(--green); }
.connect-card.is-invited .cc-title { color: var(--green); }
.connect-card.is-invited .cc-sub { color: rgba(62,207,142,.75); }

/* 连线中：绿色描边 + 淡绿底 */
.connect-card.is-live { border-color: rgba(62,207,142,.5); background: var(--green-soft); }
.connect-card.is-live .cc-dot { background: var(--green); }
.connect-card.is-live .cc-title { color: var(--green); }
.connect-card.is-live .cc-sub { color: rgba(62,207,142,.75); }

/* ═══ 连线按钮（三态）═══ */
.connect-zone { display: flex; gap: .8rem; flex-shrink: 0; width: 100%; }
.connect-btn {
  flex: 1; position: relative; overflow: hidden;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .15rem;
  min-height: 4.4rem; padding: .7rem 1rem;
  border-radius: var(--r-lg); border: 1.5px solid var(--line-2);
  background: var(--panel-2); color: var(--text-3);
  cursor: pointer; transition: all .18s ease;
  font-family: inherit;
}
.connect-btn .connect-dot {
  width: .6rem; height: .6rem; border-radius: 50%;
  background: var(--text-3); transition: all .18s;
}
.connect-btn .connect-text { font-size: 1.08rem; font-weight: 600; color: var(--text-2); }
.connect-btn .connect-sub { font-size: .76rem; color: var(--text-3); }

/* 待接受：绿色 + 呼吸光 */
.connect-btn.is-invited {
  border-color: var(--green);
  background: linear-gradient(135deg, rgba(62,207,142,.22), rgba(62,207,142,.08));
  animation: breathe 1.6s ease-in-out infinite;
}
.connect-btn.is-invited .connect-dot { background: var(--green); box-shadow: 0 0 12px var(--green); }
.connect-btn.is-invited .connect-text { color: var(--green); }
.connect-btn.is-invited .connect-sub { color: rgba(62,207,142,.75); }
@keyframes breathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(62,207,142,.35); }
  50% { box-shadow: 0 0 0 8px rgba(62,207,142,0); }
}

/* 连线中：绿色实底 */
.connect-btn.is-live {
  border-color: var(--green);
  background: linear-gradient(135deg, var(--green) 0%, var(--green-deep) 100%);
}
.connect-btn.is-live .connect-dot { background: #06281A; }
.connect-btn.is-live .connect-text { color: #06281A; }
.connect-btn.is-live .connect-sub { color: rgba(6,40,26,.7); }

.connect-btn.is-idle:hover { border-color: var(--gold-line); }
.connect-btn.is-idle:hover .connect-text { color: var(--gold); }

/* 静音小按钮 */
.mute-btn {
  min-height: 4.4rem; padding: .7rem 1.1rem; border-radius: var(--r-lg);
  border: 1.5px solid rgba(62,207,142,.4); background: var(--green-soft); color: var(--green);
  font-size: .92rem; font-weight: 600; cursor: pointer; font-family: inherit;
  transition: all .15s; white-space: nowrap;
}
.mute-btn:hover { filter: brightness(1.15); }
.mute-btn.off { border-color: var(--line-2); background: var(--panel-2); color: var(--text-3); }

/* ═══ 公屏 ═══ */
.chat-card { flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 1.1rem 1.25rem; }
.chat-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: .85rem; flex-shrink: 0; }
.chat-title { font-size: 1.05rem; font-weight: 600; }
.chat-scroll { flex: 1; overflow-y: auto; min-height: 0; padding: .2rem; -webkit-overflow-scrolling: touch; }
.chat-empty { color: var(--text-3); font-size: .85rem; text-align: center; padding: 2rem .5rem; }
/* 聊天输入：不用 flex gap（老安卓 WebView 不认），用 margin 兜底 */
.chat-input-row { display: flex; margin-top: .7rem; flex-shrink: 0; align-items: center; }
.chat-input-row .el-input { flex: 1; min-width: 0; }
.chat-input-row .el-button { margin-left: .5rem; flex-shrink: 0; }
.emoji-row {
  margin-top: .55rem; display: grid; grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: .3rem; flex-shrink: 0;
}
.emoji-btn {
  width: 100%; height: 2.1rem;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--line-2); border-radius: var(--r-md);
  background: var(--panel-2); font-size: 1.05rem; line-height: 1;
  font-family: inherit; cursor: pointer; padding: 0;
  -webkit-tap-highlight-color: transparent;
  transition: transform .12s, border-color .15s, background .15s;
}
.emoji-btn:hover, .emoji-btn:active {
  border-color: var(--gold-line); background: var(--panel-3); transform: scale(1.08);
}
.msg-row.mine .msg-name { color: var(--gold); }
.msg-row.mine .msg-bubble {
  background: var(--gold-soft); border-color: var(--gold-line); color: #F4E3C2;
}

/* ═══ ③ 错误页 ═══ */
.error-page { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem 1.2rem; }
.error-card { width: 100%; max-width: 26rem; padding: 2.6rem 2rem; text-align: center; }
.error-icon {
  width: 3.4rem; height: 3.4rem; border-radius: 50%; margin: 0 auto 1rem;
  display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 600;
}
.error-icon.error { background: var(--red-soft); color: var(--red); border: 1px solid rgba(229,86,94,.4); }
.error-icon.info { background: var(--green-soft); color: var(--green); border: 1px solid rgba(62,207,142,.4); }
.error-icon.warning { background: var(--gold-soft); color: var(--gold); border: 1px solid var(--gold-line); }
.error-title { font-size: 1.3rem; font-weight: 600; margin: 0 0 .5rem; }
.error-msg { color: var(--text-2); font-size: .92rem; line-height: 1.7; margin: 0 0 1.8rem; }
.error-actions { display: flex; gap: .8rem; justify-content: center; }
.error-actions .el-button { flex: 1; }

/* ═══ 桌面端：页面锁定视口高度，只有聊天栏内部滚动 ═══ */
@media (min-width: 900px) {
  .student { height: 100dvh; overflow: hidden; }
  .entry { overflow-y: auto; }
}

/* ═══ 平板（单列）+ 手机（≤899px）：锁视口高、画面完整、聊天吃满剩余 ═══
   竖屏手机（宽度窄）画面 16:9 必然比聊天矮，下方剩余高度让给聊天区。
   - .student 锁满视口、自己不滚
   - .live 锁高成唯一滚动容器（聊天/连线/音频都在其中，页面不被拉长）
   - 画面 stage-area 正常流（不 sticky，避免高度塌成 0 和中间空白）
   - 聊天 .chat-card 吃掉剩余高度（竖屏时≈60% 视口），内部再滚
   根容器补 100%/100vh/100dvh 三级兜底，低端安卓取不到 dvh 也有高度。 */
@media (max-width: 899px) {
  .student { height: 100%; height: 100vh; height: 100dvh; overflow: hidden; }
  .live {
    flex: 1; min-height: 0; flex-direction: column;
    overflow-y: auto; -webkit-overflow-scrolling: touch;
  }
  .live-main { flex: none; display: flex; flex-direction: column; }
  .stage-area { flex: none; display: block; container-type: normal; }
  /* 画面按 16:9 走，宽度随视口。窄手机(≤640)用 100%；
     平板(641–899)限到 72% 宽，避免 4:3 大屏下画面太高把聊天挤没 */
  .video-stage { width: 100%; }
  /* 聊天右栏吃掉「画面下方」的全部剩余高度（≈60% 视口），内部滚 */
  .live-rail { min-width: 0; flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .connect-zone, .audio-bar { width: 100%; }
  /* 聊天吃掉剩余高度，内部滚；min-height 兜底保证不太小 */
  .chat-card { flex: 1; min-height: 10rem; }
  /* 压缩连线按钮 + 音频条，给画面和聊天让地方 */
  .connect-zone { gap: .5rem; }
  .connect-btn { min-height: 3rem; }
  .connect-btn .connect-text { font-size: .95rem; }
  .connect-btn .connect-sub { font-size: .7rem; }
  .mute-btn { min-height: 3rem; padding: .5rem .8rem; font-size: .85rem; }
  .audio-bar { padding: .5rem .7rem; }
}

/* ═══ 手机（≤640px）：更紧凑 ═══ */
@media (max-width: 640px) {
  .topbar { padding: .55rem .8rem; }
  .live { padding: .6rem; gap: .6rem; }
  .live-main { gap: .6rem; }
  .video-stage { border-radius: var(--r-md); }
  .fs-btn { right: .5rem; bottom: .5rem; padding: .3rem .6rem .3rem .5rem; font-size: .72rem; }
  .audio-bar { gap: .5rem .8rem; padding: .45rem .6rem; }
  .audio-select { width: 7rem; }
  .connect-zone { gap: .5rem; }
  .connect-btn { min-height: 2.8rem; }
  .connect-btn .connect-text { font-size: .92rem; }
  .connect-btn .connect-sub { font-size: .68rem; }
  .mute-btn { min-height: 2.8rem; padding: .45rem .7rem; font-size: .82rem; }
  .chat-card { min-height: 12rem; }
  .entry-card { padding: 2rem 1.4rem; }
  .entry-steps { gap: .8rem; }
  .emoji-btn { height: 2rem; font-size: .98rem; }
  /* 进入页在锁高容器里也要能滚 */
  .entry { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
}

/* ═══ 平板（641–899px）：竖屏 4:3，画面按宽度限到 72%，给聊天让高度 ═══ */
@media (min-width: 641px) and (max-width: 899px) {
  .video-stage { width: 72%; margin: 0 auto; }
}
</style>
