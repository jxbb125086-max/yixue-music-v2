<template>
  <div class="salon">
    <!-- ═══ 顶栏 ═══ -->
    <header class="topbar">
      <div class="brand">
        <svg class="logo" viewBox="0 0 28 28" width="30" height="30" aria-hidden="true">
          <rect x="1.5" y="1.5" width="25" height="25" rx="8" fill="#E0B15E"/>
          <rect x="6.5" y="7" width="3" height="14" rx="1" fill="#1A1408"/>
          <rect x="11.5" y="7" width="3" height="14" rx="1" fill="#1A1408"/>
          <rect x="16.5" y="7" width="3" height="14" rx="1" fill="#1A1408"/>
          <rect x="9.2" y="7" width="2.2" height="8.5" fill="#E0B15E"/>
          <rect x="14.2" y="7" width="2.2" height="8.5" fill="#E0B15E"/>
        </svg>
        <span class="topbar-title">易学音乐沙龙</span>
      </div>
      <div v-if="stage === 'live'" class="topbar-link">
        <span class="tl-label">学生链接</span>
        <span class="tl-url" :title="classUrl">{{ classUrl }}</span>
        <button class="tl-btn" @click="copyLink">复制</button>
        <button class="tl-btn ghost hide-m" @click="openLink">打开</button>
      </div>
      <div class="topbar-right">
        <span v-if="stage === 'live'" class="chip gold hide-m">房间 {{ currentRoomId }}</span>
        <span v-if="teacherName" class="chip hide-m">{{ teacherName }} · 老师</span>
        <el-button v-if="stage === 'live'" size="small" class="btn-danger-ghost" @click="endClass">停止上课</el-button>
      </div>
    </header>

    <!-- ═══ ① 进入：姓名 ═══ -->
    <main v-if="stage === 'entry'" class="entry">
      <div class="entry-card card">
        <svg class="logo-lg" viewBox="0 0 28 28" width="72" height="72" aria-hidden="true">
          <rect x="1.5" y="1.5" width="25" height="25" rx="8" fill="#E0B15E"/>
          <rect x="6.5" y="7" width="3" height="14" rx="1" fill="#1A1408"/>
          <rect x="11.5" y="7" width="3" height="14" rx="1" fill="#1A1408"/>
          <rect x="16.5" y="7" width="3" height="14" rx="1" fill="#1A1408"/>
          <rect x="9.2" y="7" width="2.2" height="8.5" fill="#E0B15E"/>
          <rect x="14.2" y="7" width="2.2" height="8.5" fill="#E0B15E"/>
        </svg>
        <h1 class="entry-title">易学音乐沙龙</h1>
        <p class="entry-sub">屏幕共享 · 实时连线 · 公屏互动<br/>一间随开随用的线上音乐教室</p>
        <div class="entry-field">
          <label class="field-label">您的姓名 <span class="field-tip">学员将看到</span></label>
          <el-input v-model="teacherNameInput" placeholder="例如：李老师" maxlength="12" size="large"
            @keyup.enter="enterPrep" />
        </div>
        <el-button class="btn-primary entry-btn" size="large" @click="enterPrep">开始上课</el-button>
        <div class="entry-steps">
          <div class="step"><i>1</i><span>输入姓名</span></div>
          <div class="step"><i>2</i><span>选设备</span></div>
          <div class="step"><i>3</i><span>进入课堂</span></div>
        </div>
      </div>
    </main>

    <!-- ═══ ② 课前准备 ═══ -->
    <main v-else-if="stage === 'prep'" class="prep">
      <div class="prep-card card">
        <h2 class="prep-title">准备好，就开始了</h2>
        <p class="prep-sub">花三十秒检查设备，上课后也能随时改</p>

        <div class="field">
          <div class="field-label">🎤 麦克风 <span class="field-tip">学生听您说话、弹琴</span></div>
          <div class="field-row">
            <el-select v-model="selectedMic" placeholder="选择麦克风" class="grow" @change="onMicChange">
              <el-option v-for="d in audioDevices.mics" :key="d.deviceId"
                :label="d.label || '麦克风 ' + (audioDevices.mics.indexOf(d)+1)" :value="d.deviceId" />
            </el-select>
            <div class="vol-bar"><div class="vol-fill" :style="{ width: micVolume + '%' }"></div></div>
            <span class="vol-val">{{ micVolume }}%</span>
            <el-button @click="testMic" :loading="testingMic">试听</el-button>
          </div>
        </div>

        <div class="field">
          <div class="field-label">🔊 扬声器 <span class="field-tip">您听学员说话</span></div>
          <el-select v-model="selectedSpeaker" placeholder="选择扬声器" class="grow" @change="onSpeakerChange">
            <el-option v-for="d in audioDevices.speakers" :key="d.deviceId"
              :label="d.label || '扬声器 ' + (audioDevices.speakers.indexOf(d)+1)" :value="d.deviceId" />
          </el-select>
        </div>

        <div class="field">
          <div class="field-label">🎹 声音模式</div>
          <div class="mode-cards">
            <div class="mode-card" :class="{ active: isMusicMode }" @click="setMusicMode(true)">
              <b>钢琴音质</b>
              <span>不加工、原样传输，弹琴音色最好</span>
            </div>
            <div class="mode-card" :class="{ active: !isMusicMode }" @click="setMusicMode(false)">
              <b>说话音质</b>
              <span>降噪更清晰，适合讲话多的时候</span>
            </div>
          </div>
        </div>

        <!-- 移动端老师：没有屏幕共享，用摄像头作为视频源 -->
        <div v-if="mobileTeacher" class="field">
          <div class="field-label">📷 视频源 <span class="field-tip">移动端用摄像头代替屏幕共享</span></div>
          <div class="mode-cards">
            <div class="mode-card" :class="{ active: !camSourceOn }" @click="!camSourceOn && startCamSource()">
              <b>开启摄像头源</b>
              <span>用后置摄像头作为画面，学员可看到你</span>
            </div>
            <div class="mode-card" :class="{ active: camSourceOn }" @click="camSourceOn && stopCamSource()">
              <b>关闭摄像头源</b>
              <span>停止向学员传输画面</span>
            </div>
          </div>
          <div v-if="camSourceOn" class="cam-source-preview">
            <video ref="camSourcePreview" autoplay playsinline muted></video>
          </div>
        </div>

        <el-button class="btn-primary start-btn" size="large" @click="startClass">进入课堂</el-button>
        <p class="prep-tip">💡 桌面端：共享屏幕（教学排版台）；移动端：开启摄像头作为视频源</p>
      </div>
    </main>

    <!-- ═══ ③ 上课中 ═══ -->
    <main v-else class="live" ref="liveRef">
      <div class="live-main" ref="mainRef">
        <!-- 舞台：教学排版采集进来是 16:9，这里就固定 16:9，画面刚好铺满不留黑边 -->
        <div class="stage-area" ref="areaRef" :class="{ 'is-immersive': immersive }">
          <div class="video-stage card" ref="stageRef" :class="{ immersive }">
            <video ref="videoRef" autoplay muted playsinline></video>
            <div class="live-badge"><span class="rec-dot"></span>直播中 · {{ formatTime(classSeconds) }}</div>
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
            <button v-if="needTap" class="resume-btn" @click="resumeVideo">▶ 点击继续播放</button>
            <div v-if="!streamReady" class="video-hint">正在获取屏幕共享画面…</div>
          </div>
        </div>

        <!-- 沉浸式全屏时的浮层（在旋转容器外面，永远正着）——只有退出按钮，画面之外不放任何东西 -->
        <template v-if="immersive">
          <button class="immersive-exit" @click="toggleFullscreen" title="退出全屏">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </template>

        <div class="audio-strip card">
          <div class="strip-group">
            <span class="strip-label">麦克风</span>
            <el-select v-model="selectedMic" class="strip-select" size="small" @change="onMicChange">
              <el-option v-for="d in audioDevices.mics" :key="d.deviceId"
                :label="d.label || '麦克风 ' + (audioDevices.mics.indexOf(d)+1)" :value="d.deviceId" />
            </el-select>
            <div class="vol-bar sm"><div class="vol-fill" :style="{ width: micVolume + '%' }"></div></div>
          </div>
          <div class="strip-group hide-m">
            <span class="strip-label">扬声器</span>
            <el-select v-model="selectedSpeaker" class="strip-select" size="small" @change="onSpeakerChange">
              <el-option v-for="d in audioDevices.speakers" :key="d.deviceId"
                :label="d.label || '扬声器 ' + (audioDevices.speakers.indexOf(d)+1)" :value="d.deviceId" />
            </el-select>
          </div>
          <div class="strip-group">
            <span class="strip-label">声音</span>
            <el-button size="small" class="btn-ghost" @click="toggleAudioMode">
              {{ isMusicMode ? '🎵 钢琴音质' : '🗣️ 说话音质' }}
            </el-button>
          </div>
          <div v-if="mobileTeacher && camSourceOn" class="strip-group">
            <el-button size="small" class="btn-ghost" @click="flipCamSource">🔄 翻转摄像头</el-button>
          </div>
          <el-button class="strip-rec" size="small" :class="isRecording ? 'btn-danger-ghost' : 'btn-ghost'"
            @click="isRecording ? stopRecording() : startRecording()">
            {{ isRecording ? '⏹ 停止 ' + formatRecordTime(recordSeconds) : '⏺ 录制' }}
          </el-button>
        </div>
      </div>

      <aside class="live-rail">
        <!-- 学员 + 连线管理 -->
        <section class="card rail-card">
          <header class="rail-head">
            <span class="rail-title">👥 沙龙学员</span>
            <span class="chip">{{ students.length }} 人在线</span>
          </header>
          <div v-if="!students.length" class="rail-empty">
            还没有学员加入<br/>把顶栏的学生链接发给学员即可
          </div>
          <div class="student-scroll">
            <div v-for="u in students" :key="u.id" class="student-row" :class="{ speaking: u.micOn }">
              <span class="avatar" :class="{ on: u.micOn }">{{ (u.name || '?').slice(0, 1) }}</span>
              <div class="student-meta">
                <span class="student-name">{{ u.name }}</span>
                <span class="student-state" :class="{ on: u.micOn }">
                  <template v-if="speakingId === u.id && speakingStatus === 'live'">● 连线中</template>
                  <template v-else-if="speakingId === u.id && speakingStatus === 'invited'">邀请中…</template>
                  <template v-else>在线</template>
                </span>
              </div>
              <div class="student-actions">
                <template v-if="speakingId === u.id">
                  <el-button size="small" class="btn-ghost" @click="endSpeak">断开</el-button>
                </template>
                <template v-else>
                  <el-button size="small" type="primary" @click="inviteSpeak(u.id)">邀请连线</el-button>
                </template>
                <el-button size="small" class="btn-danger-ghost" @click="kickStudent(u.id)">请出</el-button>
              </div>
            </div>
          </div>
          <p class="rail-hint">点「邀请连线」后，学员端的连线按钮会变绿，TA 点击即接入声音，公屏也会播报</p>
        </section>

        <!-- 公屏聊天 -->
        <section class="card rail-card chat-card">
          <header class="rail-head">
            <span class="rail-title">💬 沙龙公屏</span>
            <span class="chip">{{ chatMessages.length }} 条</span>
          </header>
          <div class="chat-scroll" ref="chatScroll">
            <div v-if="!chatMessages.length" class="chat-empty">学员发的消息会显示在这里</div>
            <div v-else class="chat-list">
              <template v-for="msg in chatMessages" :key="msg.id">
                <div v-if="msg.senderRole === 'system'" class="msg-sys"><span>{{ msg.content }}</span></div>
                <div v-else class="msg-row" :class="'role-' + msg.senderRole">
                  <span class="msg-name">{{ msg.senderName }}</span>
                  <div class="msg-bubble" v-html="escapeHtml(msg.content)"></div>
                </div>
              </template>
            </div>
          </div>
          <div class="chat-input-row">
            <div class="emoji-wrap" ref="emojiWrap">
              <el-button class="emoji-trigger" @click="showEmojiPicker = !showEmojiPicker" title="表情">😊</el-button>
              <div v-if="showEmojiPicker" class="emoji-panel">
                <button v-for="e in emojis" :key="e" class="emoji-btn" @click="insertEmoji(e)">{{ e }}</button>
              </div>
            </div>
            <el-input v-model="chatInput" placeholder="说点什么，回车发送" size="default" @keyup.enter="sendChat" />
            <el-button type="primary" @click="sendChat">发送</el-button>
          </div>
        </section>
      </aside>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { io } from 'socket.io-client'
import SimplePeer from 'simple-peer'
import { ElMessage, ElMessageBox } from 'element-plus'

// 生产模式（前后端同端口部署）用同源连接；vite 开发模式(5173)才需要指定后端地址
const SERVER_URL = import.meta.env && import.meta.env.DEV ? 'http://localhost:3000' : undefined

// ── 流程状态：entry(姓名) → prep(设备) → live(上课中) ──
const stage = ref('entry')
const teacherNameInput = ref('')
const teacherName = ref('')

// 老师端是否使用摄像头作为视频源（移动端没有屏幕共享时用）
const camSourceOn = ref(false)   // 摄像头源是否正在采集
const camFacing = ref('environment') // 摄像头朝向：environment 后置 / user 前置
const camSourcePreview = ref(null) // 本地预览 <video>
let camSourceStream = null       // 摄像头源流

const videoRef = ref(null)
const stageRef = ref(null)
const mainRef = ref(null)
const areaRef = ref(null)
const liveRef = ref(null)
const nativeFs = ref(false)     // 浏览器全屏中
const immersive = ref(false)    // CSS 沉浸式全屏中
const chatScroll = ref(null)

const currentRoomId = ref('')
const classUrl = ref('')
const isClassStarted = ref(false)
const streamReady = ref(false)
const onlineUsers = ref([])
const speakingId = ref(null)
const speakingStatus = ref(null)

// ── 播放守卫状态（浏览器会把全屏切换中的视频暂停，需要主动续播）──
const wantsPlay = ref(false)
const needTap = ref(false)
let playFails = 0

const chatMessages = ref([])
const chatInput = ref('')
const emojis = ['😊', '💗', '😅', '😂', '🙋', '👏', '🤝']
const showEmojiPicker = ref(false)
const emojiWrap = ref(null)
function insertEmoji(e) {
    chatInput.value += e
    showEmojiPicker.value = false
}

// 计时 & 录制
const classSeconds = ref(0)
let classTimer = null
const isRecording = ref(false)
const recordSeconds = ref(0)
let recordTimer = null

// 音频设备
const audioDevices = reactive({ mics: [], speakers: [] })
const selectedMic = ref('')
const selectedSpeaker = ref('')
const micVolume = ref(0)
const isMusicMode = ref(localStorage.getItem('mc_audio_mode') !== 'voice')
const testingMic = ref(false)

// 网络 & 媒体
let socket = null
let socketClosed = false
let peers = {}            // studentId → SimplePeer
let stream = null         // 屏幕共享流
let micStream = null      // 推给学生的麦克风流
let peerStream = null     // 推给学生的完整流（画面+麦声）
let recorder = null
let recordingChunks = []
let audioContext = null, analyser = null, micSource = null, volumeInterval = null
let teacherMicStream = null

const students = computed(() => onlineUsers.value.filter(u => u.role === 'student'))

// ── 工具 ──
function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
}
function formatRecordTime(s) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return (h > 0 ? h + ':' : '') + m + ':' + sec
}
function escapeHtml(str) {
    const div = document.createElement('div'); div.textContent = str; return div.innerHTML
}
function copyLink() {
    navigator.clipboard.writeText(classUrl.value).then(() => ElMessage.success('链接已复制，发给学生即可'))
}
function openLink() { window.open(classUrl.value, '_blank') }

// ── 主列宽度 = 画面宽度，右栏吃掉所有剩余宽度 ──
// 画面是 16:9，窗口又宽又扁时会被「高度」卡住、比整列窄，于是画面和右栏之间空出一大块。
// 这里直接把主列宽度锁成画面宽度，右栏 flex 吃满剩余 → 任何尺寸都没有空隙。
// 关键：必须按「舞台可用高度」反算，绝不能按「当前画面宽度」迭代，
// 否则 width 变窄 → 可用高度变小 → 算出来更窄，会一路缩到底（自反馈死循环）。
let liveRO = null
function layoutLive() {
    const live = liveRef.value, area = areaRef.value, main = mainRef.value
    if (!live || !area || !main || !live.isConnected) return
    if (immersive.value || nativeFs.value) return       // 全屏时画面铺满视口，不用算
    if (window.innerWidth < 900) { main.style.width = ''; fitStageFallback(); return }  // 单列布局，交给 CSS
    const availH = area.clientHeight
    if (availH < 120) return
    const cs = getComputedStyle(live)
    const totalW = live.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    const gap = 16
    // 右栏的理想宽度（跟原来的 CSS clamp 一致），画面放得下就按它，放不下再让右栏吃剩余
    const railIdeal = Math.min(Math.max(window.innerWidth * 0.27, 352), 496)
    const byHeight = Math.round(availH * 16 / 9)
    const byWidth = Math.round(totalW - railIdeal - gap)
    const w = Math.max(320, Math.min(byHeight, byWidth))
    main.style.width = w + 'px'
    fitStageFallback()
}
// 老安卓（Chrome < 88）不认 aspect-ratio，舞台高度会塌：用 JS 按 16:9 补显式高度；
// 支持的浏览器清掉残留、不插手。layoutLive 在全屏时已提前返回，这里不会碰全屏尺寸。
function fitStageFallback() {
    const st = stageRef.value
    if (!st) return
    let ok = false
    try { ok = !!(window.CSS && CSS.supports && CSS.supports('aspect-ratio: 16 / 9')) } catch (e) { ok = false }
    if (ok) { if (st.style.height) st.style.height = ''; return }
    const w = st.clientWidth
    if (w > 0) st.style.height = Math.round(w * 9 / 16) + 'px'
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
// 两条路：① 浏览器全屏（桌面 / Android）② CSS 沉浸式（iPhone / 应用内浏览器）
// 注意：**绝不能用 video.webkitEnterFullscreen()**，那会把 <video> 交给系统播放器，
// 退出后视频被暂停、还可能被搬离播放框，只能手动点播放才能恢复。
// 另外浏览器进出全屏一定会暂停媒体，所以每次状态变化后都要主动续播。
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
    if (fsElement()) {
        try {
            const exit = document.exitFullscreen || document.webkitExitFullscreen
            if (exit) await exit.call(document)
        } catch (e) { /* 忽略 */ }
        return
    }
    if (immersive.value) { setImmersive(false); return }

    if (el.requestFullscreen || el.webkitRequestFullscreen) {
        // 依次尝试：带参（藏导航栏）→ 无参 → webkit 老式。
        // 老安卓 / 旧 WebView 不认带参调用会直接拒绝，以前就直接掉进沉浸式了；
        // 多试一轮无参的，很多设备其实能进真全屏。
        const attempts = []
        if (el.requestFullscreen) {
            attempts.push(() => el.requestFullscreen({ navigationUI: 'hide' }))
            attempts.push(() => el.requestFullscreen())
        }
        if (el.webkitRequestFullscreen) attempts.push(() => el.webkitRequestFullscreen())
        for (const go of attempts) {
            try {
                await go()
                lockLandscape()
                resumeVideoSoon()
                return
            } catch (e) { /* 换下一种试法 */ }
        }
    }
    setImmersive(true)
}

// 手机上顺手锁横屏：讲课画面是 16:9，横着看才够大（不支持的浏览器直接忽略）
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

// ── 播放守卫 ──
// 浏览器在进出全屏、切后台回来时会把 <video> 暂停；只要「应该正在播」就自动续播。
function resumeVideo() {
    const v = videoRef.value
    if (!v || !wantsPlay.value) return
    if (!v.srcObject && stream) v.srcObject = stream
    if (!v.paused) return
    const p = v.play()
    if (p && p.catch) {
        p.then(() => { playFails = 0; needTap.value = false })
            .catch(() => { if (++playFails >= 3) needTap.value = true })
    }
}
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

// ── 学员音频播放（学生连线的声音）──
const studentAudios = {}   // studentId → HTMLAudioElement
const studentStreams = {}  // studentId → MediaStream
function playStudentAudio(id) {
    const s = studentStreams[id]
    if (!s) return
    let a = studentAudios[id]
    if (!a) {
        a = new Audio(); a.autoplay = true; studentAudios[id] = a
        if (selectedSpeaker.value && typeof a.setSinkId === 'function') a.setSinkId(selectedSpeaker.value).catch(() => { })
    }
    if (a.srcObject !== s) a.srcObject = s
    a.play().catch(() => {})
}
function pauseStudentAudio(id) {
    const a = studentAudios[id]
    if (a) a.pause()
}
function stopStudentAudio(id) {
    const a = studentAudios[id]
    if (a) { a.pause(); a.srcObject = null; delete studentAudios[id] }
    delete studentStreams[id]
}

// ── 音频设备 ──
function micConstraints() {
    const base = selectedMic.value ? { deviceId: { exact: selectedMic.value } } : {}
    if (isMusicMode.value) {
        // 音乐模式只关降噪和自动增益（那两个会吃钢琴的音色与强弱），回声消除必须留着：
        // 学员的声音从老师扬声器放出来会被麦克风录回去，学员就会听见自己的回声
        return { audio: { ...base, echoCancellation: true, noiseSuppression: false, autoGainControl: false } }
    }
    return { audio: { ...base, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }
}
/* 取麦克风流：指定的设备已拔掉时 exact 约束会直接失败，回退到默认设备，别让整堂课没声 */
async function getMicStream() {
    try { return await navigator.mediaDevices.getUserMedia(micConstraints()) }
    catch (e) {
        if (e && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError') && selectedMic.value) {
            const c = micConstraints(); delete c.audio.deviceId
            return await navigator.mediaDevices.getUserMedia(c)
        }
        throw e
    }
}
function setMusicMode(v) { if (isMusicMode.value !== v) toggleAudioMode() }
async function toggleAudioMode() {
    isMusicMode.value = !isMusicMode.value
    localStorage.setItem('mc_audio_mode', isMusicMode.value ? 'music' : 'voice')
    ElMessage.success(isMusicMode.value ? '🎵 已切换钢琴音质（保真）' : '🗣️ 已切换说话音质（降噪）')
    // 模式变了约束就变了：重新取流并热换进课堂（旧版只换了检测流，课上其实没生效）
    try { applyMicStreamToClass(await getMicStream()) } catch (e) { console.warn('模式切换重取麦克风失败', e) }
}

async function getAudioDevices() {
    try {
        const temp = await navigator.mediaDevices.getUserMedia({ audio: true })
        temp.getTracks().forEach(t => t.stop())
        const devices = await navigator.mediaDevices.enumerateDevices()
        audioDevices.mics = devices.filter(d => d.kind === 'audioinput')
        audioDevices.speakers = devices.filter(d => d.kind === 'audiooutput')
        if (audioDevices.mics.length > 0 && !selectedMic.value) selectedMic.value = audioDevices.mics[0].deviceId
        await startTeacherMicDetection()
    } catch (e) { console.error('获取设备失败', e) }
}

async function startTeacherMicDetection() {
    try {
        teacherMicStream = await getMicStream()
        startVolumeDetection(teacherMicStream)
    } catch (e) { console.error('[老师麦克风] 获取失败:', e) }
}

/* 把一条新麦克风流接进当前状态：音量检测改用新流；上课中把每个学员连接的
   音频发送轨直接换成新轨（replaceTrack，不用重协商），peerStream 同步更新——
   这样课中切麦克风/切声音模式立刻生效（旧版只换检测流，学员听到的还是旧设备/旧轨道） */
function applyMicStreamToClass(s) {
    if (teacherMicStream && teacherMicStream !== s) teacherMicStream.getTracks().forEach(t => t.stop())
    teacherMicStream = s
    startVolumeDetection(s)
    const newTrack = s.getAudioTracks()[0]
    if (!newTrack || !peerStream) return
    const oldTrack = peerStream.getAudioTracks()[0]
    if (!oldTrack) {
        // 开课时没拿到麦克风、peerStream 里还没有音频轨：给现有连接补一条
        peerStream.addTrack(newTrack)
        Object.values(peers).forEach(p => { if (p && !p.destroyed) { try { p.addTrack(newTrack, peerStream) } catch (e) { } } })
        micStream = s
        return
    }
    if (oldTrack === newTrack) { micStream = s; return }
    if (!oldTrack.enabled) newTrack.enabled = false   // 静音状态延续到新轨
    Object.values(peers).forEach(p => {
        if (!p || p.destroyed || !p._pc) return
        const sender = p._pc.getSenders().find(x => x.track && x.track.kind === 'audio')
        if (sender) sender.replaceTrack(newTrack).catch(() => { })
    })
    peerStream.removeTrack(oldTrack)
    peerStream.addTrack(newTrack)
    oldTrack.stop()
    micStream = s
}

function startVolumeDetection(mediaStream) {
    stopVolumeDetection()
    if (!mediaStream?.getAudioTracks().length) return
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.3
    micSource = audioContext.createMediaStreamSource(mediaStream)
    micSource.connect(analyser)
    const buf = new Uint8Array(analyser.fftSize)
    volumeInterval = setInterval(() => {
        if (audioContext.state === 'suspended') audioContext.resume()
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x }
        micVolume.value = Math.min(100, Math.round(Math.sqrt(sum / buf.length) * 600))
    }, 30)
}
function stopVolumeDetection() {
    if (volumeInterval) { clearInterval(volumeInterval); volumeInterval = null }
    if (micSource) { micSource.disconnect(); micSource = null }
    if (audioContext) { audioContext.close().catch(() => { }); audioContext = null }
    micVolume.value = 0
}

async function testMic() {
    testingMic.value = true
    try {
        const ts = await getMicStream()
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const src = ctx.createMediaStreamSource(ts)
        const ana = ctx.createAnalyser(); ana.fftSize = 2048
        src.connect(ana)
        const buf = new Uint8Array(ana.fftSize)
        let hasSound = false
        const iv = setInterval(() => {
            ana.getByteTimeDomainData(buf)
            let sum = 0
            for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x }
            if (Math.sqrt(sum / buf.length) * 400 > 0.05) hasSound = true
        }, 100)
        setTimeout(() => {
            clearInterval(iv); ctx.close()
            ts.getTracks().forEach(t => t.stop())
            testingMic.value = false
            ElMessage.success(hasSound ? '✅ 麦克风正常' : '⚠️ 未检测到声音，请检查麦克风')
        }, 2000)
    } catch (e) {
        ElMessage.error('测试失败: ' + e.message)
        testingMic.value = false
    }
}

async function onMicChange() {
    try {
        applyMicStreamToClass(await getMicStream())
        ElMessage.success('麦克风已切换')
    } catch (e) { ElMessage.error('切换失败') }
}
function onSpeakerChange() {
    // 老师真正听到的声音走 studentAudios（学员连线声）和本地预览 videoRef，两边都要切
    const sink = selectedSpeaker.value
    let ok = false
    if (videoRef.value && typeof videoRef.value.setSinkId === 'function') {
        videoRef.value.setSinkId(sink).then(() => ElMessage.success('扬声器已切换')).catch(() => ElMessage.warning('切换失败'))
        ok = true
    }
    Object.values(studentAudios).forEach(a => { if (a && typeof a.setSinkId === 'function') a.setSinkId(sink).catch(() => { }) })
    if (!ok && !Object.keys(studentAudios).length) ElMessage.warning('当前浏览器不支持切换输出设备')
}

// ── 录制 ──
function startRecording() {
    if (!peerStream) { ElMessage.warning('请先开始上课'); return }
    if (!window.MediaRecorder) { ElMessage.error('当前浏览器不支持录制'); return }
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)) || ''
    recorder = new MediaRecorder(peerStream, { mimeType: mimeType || undefined, videoBitsPerSecond: 2500000 })
    recordingChunks = []
    recorder.ondataavailable = e => { if (e.data.size > 0) recordingChunks.push(e.data) }
    recorder.onstop = () => {
        const blob = new Blob(recordingChunks, { type: mimeType || 'video/webm' })
        recordingChunks = []
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `沙龙录制_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.webm`
        document.body.appendChild(a); a.click(); a.remove()
        URL.revokeObjectURL(url)
        ElMessage.success('录制已保存')
    }
    recorder.start(1000)
    isRecording.value = true
    recordSeconds.value = 0
    recordTimer = setInterval(() => recordSeconds.value++, 1000)
    ElMessage.success('开始录制（含当前麦克风声音）')
}
function stopRecording() {
    if (recorder && recorder.state !== 'inactive') { recorder.stop(); recorder = null }
    if (recordTimer) { clearInterval(recordTimer); recordTimer = null }
    isRecording.value = false
}

// ── 聊天 ──
function sendChat() {
    const content = chatInput.value.trim()
    if (!content || !currentRoomId.value || !socket) return
    socket.emit('chat-message', { roomId: currentRoomId.value, content })
    chatInput.value = ''
    showEmojiPicker.value = false
}
watch(() => chatMessages.value.length, () => {
    nextTick(() => { const el = chatScroll.value; if (el) el.scrollTop = el.scrollHeight })
})

// ── 连线管理 ──
function inviteSpeak(studentId) {
    if (!socket || !currentRoomId.value) return
    socket.emit('invite-speak', { studentId, roomId: currentRoomId.value })
}
function endSpeak() {
    if (!socket || !currentRoomId.value) return
    socket.emit('teacher-end-speak', currentRoomId.value)
}
function kickStudent(studentId) {
    ElMessageBox.confirm('确定将该学员请出沙龙？', '请出学员', { type: 'warning' })
        .then(() => {
            if (currentRoomId.value) socket.emit('kick-student', { studentId, roomId: currentRoomId.value })
            ElMessage.success('已请出')
        }).catch(() => { })
}

// ── 老师端摄像头源（移动端替代屏幕共享）──
function isMobileEnv() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') ||
        (navigator.maxTouchPoints > 1 && window.innerWidth < 900)
}
// 移动端没有屏幕共享，用摄像头作为视频源；桌面端保留屏幕共享
const mobileTeacher = computed(() => isMobileEnv())
async function startCamSource() {
    if (!navigator.mediaDevices?.getUserMedia) { ElMessage.error('此设备无法使用摄像头'); return }
    try {
        camSourceStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: camFacing.value }
        })
        camSourceOn.value = true
        await nextTick()
        if (camSourcePreview.value) { camSourcePreview.value.srcObject = camSourceStream; camSourcePreview.value.play().catch(() => { }) }
        // 上课中切换视频源 → 重建 peerStream（保留原有音频轨）
        if (stage.value === 'live' && peerStream) {
            const audio = peerStream.getAudioTracks()
            const rebuilt = new MediaStream([camSourceStream.getVideoTracks()[0], ...audio])
            peerStream = rebuilt
            Object.values(peers).forEach(p => {
                if (!p || p.destroyed) return
                try { p.removeStream(rebuilt) } catch (e) { }
                try { p.addStream(rebuilt) } catch (e) { }
            })
        }
        ElMessage.success('📷 摄像头源已开启，学员可看到你的画面')
    } catch (e) {
        console.error('开启摄像头源失败', e)
        ElMessage.error('无法开启摄像头：' + (e.message || e))
    }
}
function stopCamSource() {
    if (camSourceStream) camSourceStream.getTracks().forEach(t => t.stop())
    camSourceStream = null; camSourceOn.value = false
    if (camSourcePreview.value) camSourcePreview.value.srcObject = null
}

// 手机老师翻转摄像头（前置 ↔ 后置）：换一条流并重建上行画面，音频轨不动
async function flipCamSource() {
    if (!camSourceOn.value) return
    const next = camFacing.value === 'environment' ? 'user' : 'environment'
    try {
        const ns = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: next }
        })
        camFacing.value = next
        const old = camSourceStream
        camSourceStream = ns
        stream = ns
        if (peerStream) {
            const rebuilt = new MediaStream([ns.getVideoTracks()[0], ...peerStream.getAudioTracks()])
            peerStream = rebuilt
            Object.values(peers).forEach(p => {
                if (!p || p.destroyed) return
                try { p.removeStream(rebuilt) } catch (e) { }
                try { p.addStream(rebuilt) } catch (e) { }
            })
        }
        if (videoRef.value) { videoRef.value.srcObject = ns; wantsPlay.value = true; resumeVideoSoon() }
        if (old) old.getTracks().forEach(t => t.stop())
        ElMessage.success(next === 'user' ? '📷 已切换到前置摄像头' : '📷 已切换到后置摄像头')
    } catch (e) {
        console.error('翻转摄像头失败', e)
        ElMessage.error('翻转摄像头失败')
    }
}

// ── 排版台画布区域捕获（Region Capture，仅 Chrome）──
// 排版台就部署在本服务里（/composer/，与课堂同源，是本地「钢琴教学排版台」的
// 同一套页面）：点「开始上课」时打开它的标签页——整页大标签页，排版调整都在
// 那边做。靠 window.open 的窗口引用 + postMessage 传递画布的 CropTarget
// （不透明令牌）。开课共享时在系统框里选这个标签页并 cropTo 到画布，学员端
// 只看到 16:9 画布本身：工具栏、状态栏、浏览器边框都不进画面，窗口大小随意。
const PIANO_ORIGIN = location.origin
const PIANO_URL = '/composer/index.html'
let pianoWin = null
let pianoTarget = null
let pianoWaiter = null                // { resolve, timer }
function pianoTargetArrived(target) {
    pianoTarget = target
    if (pianoWaiter) { clearTimeout(pianoWaiter.timer); const w = pianoWaiter; pianoWaiter = null; w.resolve(true) }
}
window.addEventListener('message', e => {
    if (e.origin !== PIANO_ORIGIN || !e.data) return
    if (e.data.type === 'yixue-crop-ready') {
        if (pianoWin && !pianoWin.closed) pianoWin.postMessage({ type: 'yixue-gimme-crop' }, PIANO_ORIGIN)
    } else if (e.data.type === 'yixue-crop-target') {
        pianoTargetArrived(e.data.target)
    } else if (e.data.type === 'yixue-crop-error') {
        if (pianoWaiter) { clearTimeout(pianoWaiter.timer); const w = pianoWaiter; pianoWaiter = null; w.resolve(false) }
    }
})
// 连接排版台拿画布令牌（进设备页时预连一次，点「进入课堂」时若还没拿到再连）：打开排版台标签页，
// 随后弹出的系统共享框里选「钢琴教学排版台」标签页即可自动裁到画布。
// 排版台没开成也不要紧：令牌等不到就按整页共享走，绝不挡上课。
function beginPianoHandshake() {
    if (!window.CropTarget) return Promise.resolve(false)
    if (pianoTarget) return Promise.resolve(true)
    pianoWin = window.open(PIANO_URL, 'yixuePianoCanvas')
    if (!pianoWin) return Promise.resolve(false)
    const got = new Promise(resolve => {
        pianoWaiter = { resolve, timer: setTimeout(() => { pianoWaiter = null; resolve(false) }, 6000) }
    })
    // 排版台已经开着时不会再发 ready，主动请求一次；冷启动时靠 ready 再要
    setTimeout(() => { if (pianoWin && !pianoWin.closed && !pianoTarget) pianoWin.postMessage({ type: 'yixue-gimme-crop' }, PIANO_ORIGIN) }, 800)
    return got
}

// ── 流程 ──
function enterPrep() {
    const name = teacherNameInput.value.trim()
    if (!name) { ElMessage.warning('请先输入您的姓名'); return }
    teacherName.value = name
    stage.value = 'prep'
    // 提前把排版台标签页打开、令牌拿到手：等点「进入课堂」弹系统框时就不用再开，
    // 也避免开标签页和弹系统框挤在同一次点击里互相干扰
    beginPianoHandshake()
}

async function startClass() {
    // 移动端没有屏幕共享：用摄像头 + 麦克风作为视频/音频源
    if (mobileTeacher.value) {
        try {
            camSourceStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: camFacing.value }
            })
            camSourceOn.value = true
        } catch (e) {
            ElMessage.error('无法开启摄像头，移动端需要摄像头才能开课')
            return
        }
        try { micStream = await getMicStream() }
        catch (e) { console.warn('麦克风获取失败', e); micStream = null }

        peerStream = new MediaStream([
            ...(camSourceStream ? camSourceStream.getVideoTracks() : []),
            ...(micStream ? micStream.getAudioTracks() : [])
        ])
        stream = camSourceStream   // 复用 stream 变量：本地预览 + 后续操作都按 stream 处理
        streamReady.value = true
    } else {
        try {
            // 桌面端：屏幕共享 + 麦克风。排版台标签页在「开始上课」时已打开，
            // 系统框里选它即可；共享流到手后等令牌并裁到画布（见 beginPianoHandshake）
            const pianoP = beginPianoHandshake()
            // 不抓系统声音：发给学员的只有麦克风轨，抓了系统声只会让本地预览把学员的
            // 声音再放出来一遍、加重回声；peerStream 本来也不用这条轨
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'hidden', frameRate: 15 },
                audio: false
            })
            // 排版台画布：等令牌最多 2.5 秒（超时按整页共享走）；裁失败自动回退整页画面
            if (pianoP) await Promise.race([pianoP, new Promise(r => setTimeout(r, 2500))])
            if (pianoTarget) {
                const vt = stream.getVideoTracks()[0]
                if (vt && typeof vt.cropTo === 'function') {
                    // cropTo 在个别环境下可能既不成功也不报错地挂住，用超时兜底，绝不拖住开课
                    const r = await Promise.race([
                        vt.cropTo(pianoTarget).then(() => 'ok').catch(() => 'fail'),
                        new Promise(res => setTimeout(() => res('timeout'), 1500))
                    ])
                    if (r === 'ok') ElMessage.success('🎹 已锁定排版台画布，只传画布画面')
                    else if (r === 'fail') ElMessage.warning('区域捕获没成功（共享时要选「钢琴教学排版台」标签页），已改用整页画面')
                }
            }
            streamReady.value = true
            try { micStream = await getMicStream() }
            catch (e) { console.warn('麦克风获取失败，学生可能听不到声音', e); micStream = null }

            peerStream = new MediaStream([
                ...stream.getVideoTracks(),
                ...(micStream ? micStream.getAudioTracks() : [])
            ])
        } catch (e) {
            console.error('屏幕共享失败', e)
            let msg = '获取屏幕共享失败'
            if (e && e.name === 'NotAllowedError') {
                msg = '屏幕共享被拒绝。macOS 请在「系统设置 → 隐私与安全性 → 屏幕录制」中勾选当前浏览器，并重启浏览器'
            } else if (e && e.name === 'NotFoundError') {
                msg = '没有找到可共享的屏幕或窗口'
            } else if (e && e.name === 'NotReadableError') {
                msg = '无法读取屏幕画面，请检查屏幕录制权限'
            } else if (e && e.message) {
                msg = '获取屏幕共享失败：' + e.message
            }
            ElMessage.error(msg)
            return
        }
    }

    stage.value = 'live'
    isClassStarted.value = true
    classSeconds.value = 0
    if (classTimer) clearInterval(classTimer)
    classTimer = setInterval(() => classSeconds.value++, 1000)

    nextTick(() => {
        if (videoRef.value) {
            videoRef.value.srcObject = stream
            wantsPlay.value = true
            bindVideoGuards()
            resumeVideoSoon()
            if (selectedSpeaker.value && typeof videoRef.value.setSinkId === 'function')
                videoRef.value.setSinkId(selectedSpeaker.value).catch(() => { })
        }
        watchLiveLayout()
    })

    // 屏幕共享被手动停止时（桌面端）自动停录制 + 更新 UI；移动端摄像头源没有 ended 事件，忽略
    if (stream && !mobileTeacher.value) {
        stream.getVideoTracks().forEach(t => t.addEventListener('ended', () => {
            if (isRecording.value) stopRecording()
            streamReady.value = false
            stage.value = 'prep'
            isClassStarted.value = false
            if (classTimer) { clearInterval(classTimer); classTimer = null }
            ElMessage.warning('屏幕共享已停止')
        }))
    }

    // ── 建立信令连接（带老师姓名）──
    socket = io(SERVER_URL, {
        reconnection: true, reconnectionAttempts: Infinity,
        reconnectionDelay: 1000, reconnectionDelayMax: 10000, timeout: 5000
    })
    setupListeners()

    socket.emit('create-room', { teacherName: teacherName.value }, roomId => {
        currentRoomId.value = roomId
        classUrl.value = `${location.origin}/student/${roomId}`
        ElMessage.success('课程已开始，把学生链接发给学员吧')
    })

    socket.on('disconnect', reason => {
        if (socketClosed || reason === 'io client disconnect') return
        ElMessage.warning('⚠️ 连接断开，正在自动重连...')
        stopCamSource()
    })
    socket.on('reconnect', () => {
        if (socketClosed) return
        ElMessage.success('✅ 连接已恢复')
        if (isClassStarted.value && peerStream) {
            Object.values(peers).forEach(p => { try { p.destroy() } catch (e) { } })
            peers = {}
            socket.emit('rebuild-peers', { roomId: currentRoomId.value })
        }
    })
}

function setupListeners() {
    socket.on('room-users', users => { onlineUsers.value = users })
    socket.on('speak-state', ({ studentId, status }) => {
        speakingId.value = studentId
        speakingStatus.value = status
    })
    socket.on('user-mic-update', ({ id, micOn }) => {
        const u = onlineUsers.value.find(u => u.id === id)
        if (u) u.micOn = micOn
        if (micOn) playStudentAudio(id); else pauseStudentAudio(id)
    })
    socket.on('chat-history', history => { chatMessages.value = history || [] })
    socket.on('chat-message', msg => { chatMessages.value.push(msg) })

    socket.on('signal', ({ from, signal }) => {
        if (peers[from]) try { peers[from].signal(signal) } catch (e) { }
    })

    // 学生加入 → 提示 + 发起连接（推流）
    socket.on('user-joined', ({ id, name }) => {
        if (name) ElMessage.info(`${name} 加入了沙龙`)
        if (!peerStream || peers[id]) return
        const peer = new SimplePeer({
            initiator: true, trickle: false, stream: peerStream, objectMode: true, sdpTransform: s => s
        })
        peer.on('signal', sig => socket.emit('signal', { to: id, from: socket.id, signal: sig }))
        peer.on('stream', s => {
            studentStreams[id] = s
            // 上行音频
            if (s.getAudioTracks().length) {
                const u = onlineUsers.value.find(u => u.id === id)
                if (u?.micOn) playStudentAudio(id)
            }
        })
        peer.on('error', err => console.error('Peer error', err))
        peer.on('close', () => { stopStudentAudio(id); delete peers[id] })
        peers[id] = peer
    })

    // 学生重连后单独重建 peer
    socket.on('student-rejoined', ({ studentId }) => {
        if (!peerStream) return
        if (peers[studentId]) { try { peers[studentId].destroy() } catch (e) { } }
        stopStudentAudio(studentId)
        const peer = new SimplePeer({
            initiator: true, trickle: false, stream: peerStream, objectMode: true, sdpTransform: s => s
        })
        peer.on('signal', sig => socket.emit('signal', { to: studentId, from: socket.id, signal: sig }))
        peer.on('stream', s => {
            studentStreams[studentId] = s
            if (s.getAudioTracks().length) {
                const u = onlineUsers.value.find(u => u.id === studentId)
                if (u?.micOn) playStudentAudio(studentId)
            }
        })
        peer.on('error', err => console.error('Peer error', err))
        peer.on('close', () => { stopStudentAudio(studentId); delete peers[studentId] })
        peers[studentId] = peer
    })

    // 老师重连 → 重建所有 peer
    socket.on('rebuild-peers', () => {
        if (!peerStream) return
        onlineUsers.value.forEach(u => {
            if (u.role === 'student' && !peers[u.id]) {
                const peer = new SimplePeer({
                    initiator: true, trickle: false, stream: peerStream, objectMode: true, sdpTransform: s => s
                })
                peer.on('signal', sig => socket.emit('signal', { to: u.id, from: socket.id, signal: sig }))
                peer.on('stream', s => {
                    studentStreams[u.id] = s
                    if (s.getAudioTracks().length) {
                        if (u.micOn) playStudentAudio(u.id)
                    }
                })
                peer.on('error', err => console.error('Peer error', err))
                peer.on('close', () => { stopStudentAudio(u.id); delete peers[u.id] })
                peers[u.id] = peer
            }
        })
    })

}

function endClass() {
    ElMessageBox.confirm('确定结束课程？所有学员将被断开。', '结束课程', { type: 'warning' })
        .then(() => {
            if (isRecording.value) stopRecording()
            if (classTimer) { clearInterval(classTimer); classTimer = null }
            if (currentRoomId.value && socket) socket.emit('end-class', currentRoomId.value)
            Object.values(peers).forEach(p => { try { p.destroy() } catch (e) { } })
            Object.keys(studentAudios).forEach(stopStudentAudio)
            peers = {}
            if (stream) stream.getTracks().forEach(t => t.stop())
            if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null }
            stopCamSource()   // 关摄像头源
            peerStream = null
            stopVolumeDetection()
            if (socket) { socketClosed = true; socket.disconnect(); socket = null }
            if (videoRef.value) videoRef.value.srcObject = null
            isClassStarted.value = false
            streamReady.value = false
            speakingId.value = null
            speakingStatus.value = null
            onlineUsers.value = []
            chatMessages.value = []
            stage.value = 'entry'
            teacherNameInput.value = ''
            ElMessage.success('课程已结束')
        }).catch(() => { })
}

function onDocClick(e) {
    if (showEmojiPicker.value && emojiWrap.value && !emojiWrap.value.contains(e.target)) {
        showEmojiPicker.value = false
    }
}
onMounted(async () => {
    document.addEventListener('click', onDocClick)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('keydown', onKeydown)
    await getAudioDevices()
    navigator.mediaDevices.addEventListener('devicechange', getAudioDevices)
})
onBeforeUnmount(() => {
    document.removeEventListener('click', onDocClick)
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
    document.removeEventListener('visibilitychange', onVisibility)
    document.removeEventListener('keydown', onKeydown)
    if (fsElement()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document) } catch (e) { } }
    setImmersive(false)
    unlockOrientation()
    unwatchLiveLayout()
    if (isRecording.value) stopRecording()
    socketClosed = true
    stopVolumeDetection()
    if (teacherMicStream) { teacherMicStream.getTracks().forEach(t => t.stop()); teacherMicStream = null }
    Object.values(peers).forEach(p => { try { p.destroy() } catch (e) { } })
    Object.keys(studentAudios).forEach(stopStudentAudio)
    if (stream) stream.getTracks().forEach(t => t.stop())
    if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null }
    stopCamSource()
    peerStream = null
    if (socket) socket.disconnect()
})
</script>

<style scoped>
.salon { width: 100%; min-height: 100%; min-height: 100vh; min-height: calc(var(--vh, 1vh) * 100); min-height: 100dvh; display: flex; flex-direction: column; }

/* ═══ 顶栏 ═══ */
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: .8rem 1.4rem;
  background: rgba(13,17,23,.82);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
  position: sticky; top: 0; z-index: 50;
  flex-shrink: 0;
}
.brand { display: flex; align-items: center; gap: .65rem; flex-shrink: 0; }
.topbar-title { font-size: 1.2rem; font-weight: 600; letter-spacing: .02em; }
.topbar-right { display: flex; align-items: center; gap: .6rem; flex-shrink: 0; }

/* 顶栏里的学生链接：原来那条占地方的邀请卡挪到这里，画面因此多出 58px 高度 */
.topbar-link {
  display: flex; align-items: center; gap: .5rem; min-width: 0;
  flex: 1 1 auto; max-width: 40rem; margin: 0 1.2rem;
  padding: .26rem .3rem .26rem .8rem;
  background: var(--gold-soft); border: 1px solid var(--gold-line); border-radius: 999px;
}
.tl-label { font-size: .76rem; color: var(--gold); white-space: nowrap; flex-shrink: 0; font-weight: 600; }
.tl-url {
  flex: 1; min-width: 0; font-size: .78rem; color: var(--text-2);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.tl-btn {
  flex-shrink: 0; padding: .2rem .62rem; border-radius: 999px;
  border: 1px solid transparent; background: var(--gold); color: #1A1408;
  font-size: .74rem; font-weight: 600; font-family: inherit; cursor: pointer;
  transition: filter .15s, background .15s;
}
.tl-btn:hover { filter: brightness(1.1); }
.tl-btn.ghost { background: transparent; border-color: var(--gold-line); color: var(--gold); font-weight: 500; }
.tl-btn.ghost:hover { background: rgba(224,177,94,.15); filter: none; }

/* ═══ ① 进入页 ═══ */
.entry { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem 1.2rem; }
.entry-card {
  width: 100%; max-width: 27rem; padding: 2.8rem 2.2rem; text-align: center;
  background: linear-gradient(180deg, var(--panel) 0%, #101620 100%);
  box-shadow: 0 24px 80px rgba(0,0,0,.5), 0 0 0 1px var(--line);
}
.logo-lg { margin-bottom: 1rem; filter: drop-shadow(0 6px 24px rgba(224,177,94,.35)); }
.entry-title { font-size: 1.9rem; font-weight: 600; margin: 0 0 .6rem; letter-spacing: .04em; }
.entry-sub { color: var(--text-2); font-size: .95rem; line-height: 1.7; margin: 0 0 2.2rem; }
.entry-field { text-align: left; margin-bottom: 1.4rem; }
.field-label { display: block; font-size: .92rem; color: var(--text-2); margin-bottom: .5rem; font-weight: 500; }
.field-tip { color: var(--text-3); font-size: .8rem; font-weight: 400; margin-left: .3rem; }
.entry-btn { width: 100%; height: 3.2rem; font-size: 1.1rem; }
.entry-steps {
  display: flex; justify-content: center; gap: 1.6rem; margin-top: 2rem;
  padding-top: 1.6rem; border-top: 1px dashed var(--line-2);
}
.step { display: flex; align-items: center; gap: .45rem; color: var(--text-3); font-size: .85rem; }
.step i {
  width: 1.4rem; height: 1.4rem; border-radius: 50%; font-style: normal;
  background: var(--gold-soft); color: var(--gold); border: 1px solid var(--gold-line);
  display: inline-flex; align-items: center; justify-content: center; font-size: .75rem; font-weight: 600;
}

/* ═══ ② 课前准备 ═══ */
.prep { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 2.4rem 1.2rem; overflow-y: auto; }
.prep-card { width: 100%; max-width: 36rem; padding: 2.2rem; }
.prep-title { font-size: 1.45rem; font-weight: 600; margin: 0 0 .3rem; }
.prep-sub { color: var(--text-2); font-size: .9rem; margin: 0 0 2rem; }
.field { margin-bottom: 1.6rem; }
.field-row { display: flex; align-items: center; gap: .8rem; }
.grow { flex: 1; min-width: 0; }
.mode-cards { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; }
.mode-card {
  border: 1px solid var(--line-2); border-radius: var(--r-md); padding: 1rem 1.1rem;
  cursor: pointer; transition: border-color .15s, background .15s; display: flex; flex-direction: column; gap: .3rem;
}
.mode-card:hover { border-color: var(--gold-line); }
.mode-card.active { border: 1.5px solid var(--gold); background: var(--gold-soft); }
.mode-card b { font-size: 1.02rem; }
.mode-card span { font-size: .8rem; color: var(--text-2); line-height: 1.5; }
.mode-card.active span { color: #D9C39A; }
.start-btn { width: 100%; height: 3.4rem; font-size: 1.15rem; margin-top: .6rem; }
.prep-tip {
  text-align: center; color: var(--text-3); font-size: .82rem; line-height: 1.7;
  margin: 1.2rem 0 0; padding: .8rem 1rem; background: rgba(255,255,255,.03); border-radius: var(--r-md);
}

/* ═══ ③ 上课中 ═══
   主列宽度由 JS 锁成「画面宽度」，右栏 flex 吃掉所有剩余宽度 —— 任何窗口尺寸都不会
   在画面和右栏之间留下空白（画面是 16:9，扁窗口下会被高度卡住而比整列窄）。 */
.live {
  flex: 1; display: flex; gap: 1rem; padding: 1rem 1.4rem 1.4rem;
  min-height: 0;
}
.live-main {
  flex: 0 0 auto; width: 100%;
  display: flex; flex-direction: column; gap: 1rem;
  min-width: 0; min-height: 0;
}
/* min-width 保证极窄屏时右栏不会被画面挤没 */
.live-rail { flex: 1 1 auto; min-width: 22rem; display: flex; flex-direction: column; gap: 1rem; min-height: 0; }

/* ═══ 画面舞台：固定 16:9 ═══
   采集端（教学排版台）输出的是 16:9，这里按同样的比例开框，画面刚好铺满。
   用容器查询单位算「能放下的最大 16:9 矩形」，纯 CSS 完成，窗口怎么拉都是 16:9。 */
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
/* contain：保证源画面完整显示。源是浏览器标签页/窗口时，比例由窗口大小决定、
   往往不是 16:9，用 cover 会把贴边的内容（琴键、工具栏）裁掉；contain 只留黑边，
   黑边与舞台黑底一体，不影响观看。源正好 16:9 时两者等效。 */
.video-stage video {
  display: block; width: 100%; height: 100%;
  object-fit: contain; background: #05070A;
}
.video-hint {
  position: absolute; top: 0; right: 0; bottom: 0; left: 0; inset: 0; display: flex; align-items: center; justify-content: center;
  color: var(--text-3); font-size: .95rem; pointer-events: none;
}
.live-badge {
  position: absolute; top: .8rem; left: .8rem; display: flex; align-items: center; gap: .45rem;
  background: rgba(10,14,20,.78); border: 1px solid var(--line-2); color: #FF7A7F;
  font-size: .78rem; padding: .28rem .8rem; border-radius: 999px; backdrop-filter: blur(8px);
  font-variant-numeric: tabular-nums; pointer-events: none;
}
.rec-dot { width: .5rem; height: .5rem; border-radius: 50%; background: #FF5A5F; animation: recblink 1.2s infinite; }
@keyframes recblink { 0%, 100% { opacity: 1 } 50% { opacity: .25 } }

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
  width: calc(var(--vw, 1vw) * 100); height: calc(var(--vh, 1vh) * 100);
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

/* 全屏就是「干净看画面」：徽标、提示一律收起，只留视频本身和退出按钮 */
.video-stage:fullscreen .live-badge,
.video-stage:-webkit-full-screen .live-badge,
.video-stage.immersive .live-badge,
.video-stage:fullscreen .video-hint,
.video-stage:-webkit-full-screen .video-hint,
.video-stage.immersive .video-hint { display: none; }

/* 竖着拿手机又没进真全屏（拿不到方向锁定）：把画面转 90°，
   用户把手机横过来就是满屏，不用等系统转屏。只对触屏生效，桌面不动。 */
@media (orientation: portrait) {
  html.is-touch .video-stage.immersive {
    width: 100vh; height: 100vw;
    width: calc(var(--vh, 1vh) * 100); height: calc(var(--vw, 1vw) * 100);
    width: 100dvh; height: 100dvw;
    transform: translate(-50%, -50%) rotate(90deg);
  }
  /* 原生全屏同理：方向锁定没生效的老安卓，竖屏进全屏也转 90°，横过来即满屏 */
  html.is-touch .video-stage:fullscreen,
  html.is-touch .video-stage:-webkit-full-screen {
    width: 100vh; height: 100vw;
    width: calc(var(--vh, 1vh) * 100); height: calc(var(--vw, 1vw) * 100);
    width: 100dvh; height: 100dvw;
    transform: translate(-50%, -50%) rotate(90deg);
  }
}

/* 沉浸式下的浮层：右下角圆形小按钮，不挡画面主体 */
.immersive-exit {
  position: fixed; z-index: 10000;
  bottom: calc(env(safe-area-inset-bottom, 0px) + .9rem);
  right: calc(env(safe-area-inset-right, 0px) + .9rem);
  display: inline-flex; align-items: center; justify-content: center;
  width: 2.9rem; height: 2.9rem;
  border-radius: 50%; border: 1.5px solid var(--gold-line);
  background: rgba(10,14,20,.82); color: var(--gold);
  font-family: inherit; cursor: pointer;
  backdrop-filter: blur(8px);
  box-shadow: 0 3px 12px rgba(0,0,0,.5);
  opacity: .95; transition: filter .15s, transform .1s;
}
.immersive-exit svg { width: 1.15rem; height: 1.15rem; }
.immersive-exit:hover,
.immersive-exit:active { filter: brightness(1.2); transform: scale(.96); }

/* 浏览器把播放拦下来时的兜底：给一个明确可点的按钮 */
.resume-btn {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  z-index: 6; padding: .7rem 1.3rem; border-radius: 999px;
  border: 1px solid var(--gold-line); background: rgba(10,14,20,.86);
  color: var(--gold); font-size: .95rem; font-weight: 600;
  font-family: inherit; cursor: pointer; backdrop-filter: blur(8px);
}
.resume-btn:hover { background: rgba(224,177,94,.18); }

.audio-strip {
  display: flex; align-items: center; flex-wrap: wrap; gap: .6rem 1.1rem;
  padding: .7rem 1.1rem; flex-shrink: 0;
  width: 100%;   /* 主列宽度已等于画面宽度，这里自然同宽 */
}
.strip-group { display: flex; align-items: center; gap: .55rem; min-width: 0; }
.strip-label { font-size: .82rem; color: var(--text-2); white-space: nowrap; }
.strip-select { width: 9.5rem; }
.vol-bar.sm { width: 5rem; flex: none; }
.strip-rec { margin-left: auto; }

/* ═══ 右栏卡片 ═══ */
.rail-card { padding: 1.1rem 1.25rem; display: flex; flex-direction: column; min-height: 0; flex-shrink: 1; }
.rail-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: .85rem; flex-shrink: 0; }
.rail-title { font-size: 1.05rem; font-weight: 600; }
.rail-empty { color: var(--text-3); font-size: .85rem; text-align: center; padding: 1.2rem .5rem; line-height: 1.8; }
.student-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: .2rem; }
.rail-hint {
  margin: .9rem 0 0; padding-top: .8rem; border-top: 1px dashed var(--line);
  color: var(--text-3); font-size: .76rem; line-height: 1.6; flex-shrink: 0;
}

.student-row {
  display: flex; align-items: center; gap: .7rem; padding: .62rem .7rem;
  border-radius: var(--r-md); border: 1px solid transparent; transition: background .15s;
}
.student-row + .student-row { margin-top: .3rem; }
.student-row:hover { background: rgba(255,255,255,.03); }
.student-row.speaking { background: var(--green-soft); border-color: rgba(62,207,142,.3); }
.avatar {
  width: 2.4rem; height: 2.4rem; border-radius: 50%; flex-shrink: 0;
  background: var(--panel-3); color: var(--text-2);
  display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 1rem;
}
.avatar.on { background: var(--green-soft); color: var(--green); box-shadow: 0 0 0 1.5px rgba(62,207,142,.5); }
.student-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .1rem; }
.student-name { font-size: 1rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.student-state { font-size: .78rem; color: var(--text-3); }
.student-state.on { color: var(--green); }
.student-actions { display: flex; gap: .4rem; flex-shrink: 0; }

/* ═══ 公屏 ═══ */
.chat-card { flex: 1; min-height: 15rem; }

/* 摄像头源本地预览（老师移动端） */
.cam-source-preview { margin-top: .8rem; border-radius: var(--r-md); overflow: hidden; border: 1px solid rgba(168,120,255,.4); }
.cam-source-preview video { display: block; width: 100%; aspect-ratio: 16/9; object-fit: cover; background: #05070A; }

.chat-scroll { flex: 1; overflow-y: auto; min-height: 0; padding: .2rem; -webkit-overflow-scrolling: touch; }
.chat-empty { color: var(--text-3); font-size: .85rem; text-align: center; padding: 2rem .5rem; }
.chat-input-row { display: flex; gap: .5rem; margin-top: .8rem; flex-shrink: 0; align-items: center; }
.chat-input-row .el-input { flex: 1; }
.emoji-wrap { position: relative; flex-shrink: 0; }
.emoji-trigger { font-size: 1.15rem; padding: .5rem .7rem; }
.emoji-panel {
  position: absolute; bottom: calc(100% + .55rem); left: 0;
  background: var(--panel-2); border: 1px solid var(--line-2); border-radius: var(--r-md);
  padding: .5rem; display: grid; grid-template-columns: repeat(7, 1fr); gap: .3rem;
  box-shadow: 0 10px 34px rgba(0,0,0,.55); z-index: 40;
}

/* ═══ 桌面端：页面锁定视口高度，只有内部区域滚动 ═══ */
@media (min-width: 900px) {
  .salon { height: 100vh; height: calc(var(--vh, 1vh) * 100); height: 100dvh; overflow: hidden; }
  .entry { overflow-y: auto; }
  /* 学员卡按人数长高，最多占右栏 55%，再多才在卡内滚动（原来 42% 放 3 个人就切半行） */
  .rail-card:not(.chat-card) { max-height: 55%; }
}

/* ═══ 响应式 ═══ */
@media (max-width: 899px) {
  .salon { height: 100%; height: 100vh; height: calc(var(--vh, 1vh) * 100); height: 100dvh; overflow: hidden; }
  .live {
    flex: 1; min-height: 0; flex-direction: column;
    overflow-y: auto; -webkit-overflow-scrolling: touch;
  }
  .live-main { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .stage-area { flex: none; display: block; container-type: normal; }
  .video-stage { width: 100%; }
  .live-rail { min-width: 0; max-height: none; flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .rail-card:not(.chat-card) { max-height: 36vh; }
  .audio-strip { width: 100%; }
  .topbar-link { margin: 0 .6rem; }
  .chat-card { flex: 1; min-height: 12rem; }
}
@media (max-width: 640px) {
  .topbar { padding: .6rem .9rem; }
  .live { padding: .8rem; gap: .75rem; }
  .video-stage { border-radius: var(--r-md); }
  .live-badge { top: .5rem; left: .5rem; font-size: .72rem; padding: .22rem .62rem; }
  .fs-btn { right: .5rem; bottom: .5rem; padding: .34rem .68rem .34rem .55rem; font-size: .74rem; }
  .audio-strip { gap: .5rem .8rem; }
  .strip-select { width: 7.5rem; }
  .student-actions .el-button { padding: .4rem .6rem; font-size: .78rem; }
  .chat-card { min-height: 12rem; }
  .mode-cards { grid-template-columns: 1fr; }
  /* 手机上顶栏太挤：只留「学生链接」标签和复制按钮，URL 由标题浮层看 */
  .topbar-link { margin: 0 .5rem; padding: .22rem .26rem .22rem .6rem; }
  .tl-url { display: none; }
  .entry { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
}

/* 老安卓横屏：屏幕高度常常只有 320~400px，功能区按常规尺寸会把画面挤没。
   这一档把顶栏/条带压薄、聊天最小高度放低，优先保住画面。 */
@media (orientation: landscape) and (max-height: 500px) {
  .topbar { padding: .35rem .9rem; }
  .live { padding: .5rem .8rem .7rem; gap: .6rem; }
  .live-main { gap: .6rem; }
  .audio-strip { padding: .45rem .8rem; }
  .rail-card { padding: .7rem .9rem; }
  .chat-card { min-height: 8rem; }
  .rail-card:not(.chat-card) { max-height: 30vh; }
  .entry, .prep { padding: 1rem; }
  .entry-card { padding: 1.4rem 1.2rem; }
  .prep-card { padding: 1.2rem; }
  .entry-steps { margin-top: 1rem; padding-top: 1rem; }
}
</style>
