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
    <main v-if="stage === 'entry'" class="entry">      <div class="entry-card card">
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
        <el-button class="btn-primary entry-btn" size="large" @click="enterPrep">进入沙龙 →</el-button>
        <div class="entry-steps">
          <div class="step"><i>1</i><span>输入姓名</span></div>
          <div class="step"><i>2</i><span>选设备</span></div>
          <div class="step"><i>3</i><span>教学大厅</span></div>
        </div>
      </div>
    </main>

    <!-- ═══ ② 第2步：选设备 ═══ -->
    <main v-if="stage === 'device'" class="prep">
      <div class="prep-layout prep-layout--single">
        <div class="prep-card card step-card">
          <div class="step-head">
            <span class="step-no">2</span>
            <div>
              <h2 class="prep-title">选择设备</h2>
              <p class="prep-sub">花三十秒检查一下，上课后也能随时改</p>
            </div>
          </div>

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

          <div class="step-actions">
            <el-button class="btn-ghost" size="large" @click="stage = 'entry'">← 返回</el-button>
            <el-button class="btn-primary" size="large" @click="enterHall">进入教学大厅 →</el-button>
          </div>
        </div>
      </div>
    </main>

    <!-- ═══ ③ 教学大厅 ═══ -->
    <main v-show="stage === 'live'" class="live" ref="liveRef">
      <div class="live-main" ref="mainRef">
        <!-- 排版工具条：从教学框里搬出来放在框上方。
             好处：画面里永远不会出现工具栏、也不会留一条黑框，画布正好铺满 16:9 -->
        <div class="stage-tools">
          <button class="stool" @click="toolAction('window')" title="采集某个窗口/屏幕">窗口</button>
          <button class="stool" @click="toolAction('camera')" title="接入摄像头">镜头</button>
          <button class="stool" @click="toolAction('keys')" title="加一块 MIDI 琴键">键盘</button>
          <button class="stool" @click="toolAction('text')" title="加一个文字框">文字</button>
          <button class="stool" @click="toolAction('file')" title="加图片 / 视频 / 音频">文件</button>
          <button class="stool" @click="toggleStageUiHidden()"
            :title="stageUiHidden ? '框体标签已隐藏，点击显示' : '隐藏所有框体的标签 / 边框'">隐藏</button>
          <span class="stool-gap"></span>
          <button class="stool danger" @click="toolAction('clear')" title="清空所有内容">清空</button>
        </div>

        <!-- 教学框：里面就是排版台本身，老师可以直接拖拽排版 -->
        <div class="stage-area" ref="areaRef">
          <div class="video-stage card" ref="stageRef">
            <iframe
              ref="stageIframeRef"
              class="stage-iframe"
              src="/composer/index.html"
              allow="microphone; midi"
              @load="onStageLoaded"
            ></iframe>
          </div>
        </div>

        <div class="audio-strip card">
          <!-- 直播开关：灰灯=未开播，红灯亮=直播中 -->
          <button class="live-toggle" :class="{ on: pushing }" @click="togglePush"
                  :title="pushing ? '点击停止直播，学员立刻看不到画面' : '点击开始直播，学员能看到画面'">
            <span class="live-dot"></span>
            <span class="live-label">直播</span>
          </button>
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
          <div class="strip-group no-shrink">
            <span class="strip-label">声音</span>
            <el-button size="small" class="btn-ghost" @click="toggleAudioMode">
              {{ isMusicMode ? '🎵 钢琴音质' : '🗣️ 说话音质' }}
            </el-button>
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
import { rtcConfig } from '../utils/rtc'
import { ElMessage, ElMessageBox } from 'element-plus'

// 生产模式（前后端同端口部署）用同源连接；vite 开发模式(5173)才需要指定后端地址
const SERVER_URL = import.meta.env && import.meta.env.DEV ? 'http://localhost:3000' : undefined

// ── 流程状态 ──
const stage = ref('entry')
const teacherNameInput = ref('')
const teacherName = ref('')

// ── 直播状态 ──
const pushing = ref(false)      // 是否正在把教学框直播给学员
const stageIframeRef = ref(null)
const stageUiHidden = ref(false) // 老师手动控制的「隐藏框体标签」开关状态

const stageRef = ref(null)
const mainRef = ref(null)
const areaRef = ref(null)
const liveRef = ref(null)
const chatScroll = ref(null)

const currentRoomId = ref('')
const classUrl = ref('')
const isClassStarted = ref(false)
const preparing = ref(false)      // 「直播」开关 loading
const onlineUsers = ref([])
const speakingId = ref(null)
const speakingStatus = ref(null)

const chatMessages = ref([])
const chatInput = ref('')
const emojis = ['😊', '💗', '😅', '😂', '🙋', '👏', '🤝', '🎁']
const showEmojiPicker = ref(false)
const emojiWrap = ref(null)
function insertEmoji(e) {
    chatInput.value += e
    showEmojiPicker.value = false
}

// 录制
const isRecording = ref(false)
const recordSeconds = ref(0)
let recordTimer = null

// 音频设备
const audioDevices = reactive({ mics: [], speakers: [] })
const selectedMic = ref('')
const selectedSpeaker = ref('')
const testingMic = ref(false)
const micVolume = ref(0)
const isMusicMode = ref(localStorage.getItem('mc_audio_mode') !== 'voice')

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

/* 老款安卓 / 老 WebView 不支持 container-type + cqw/cqh、也不支持 aspect-ratio，
   纯 CSS 算出来的教学框尺寸会塌成 0。这里用 JS 写死 px 兜底，新老浏览器结果一致。 */
function fitStage() {
    const area = areaRef.value, stage = stageRef.value
    if (!area || !stage) return
    const aw = area.clientWidth, ah = area.clientHeight
    if (aw < 40 || ah < 40) return
    const w = Math.min(aw, ah * 16 / 9)
    stage.style.width = Math.round(w) + 'px'
    stage.style.height = Math.round(w * 9 / 16) + 'px'
}

function layoutLive() {
    const live = liveRef.value, area = areaRef.value, main = mainRef.value
    if (!live || !area || !main || !live.isConnected) return
    if (window.innerWidth < 900) { main.style.width = ''; fitStage(); return }  // 单列布局
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
    // 浏览器全屏/退出全屏时，ResizeObserver 不一定触发，额外监听全屏事件
    function onFsChange() { layoutLive() }
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange)
    live._fsListeners = { onFsChange, docFs: onFsChange }
}
function unwatchLiveLayout() {
    if (liveRO) { liveRO.disconnect(); liveRO = null }
    const live = liveRef.value
    if (live && live._fsListeners) {
        document.removeEventListener('fullscreenchange', live._fsListeners.onFsChange)
        document.removeEventListener('webkitfullscreenchange', live._fsListeners.docFs)
        live._fsListeners = null
    }
}

// ── 学员音频播放（学生连线的声音）──
const studentAudios = {}   // studentId → HTMLAudioElement
const studentStreams = {}  // studentId → MediaStream
function playStudentAudio(id) {
    const s = studentStreams[id]
    if (!s) return
    let a = studentAudios[id]
    if (!a) { a = new Audio(); a.autoplay = true; studentAudios[id] = a }
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
    const base = selectedMic.value ? { deviceId: selectedMic.value } : {}
    if (isMusicMode.value) {
        return { audio: { ...base, echoCancellation: false, noiseSuppression: false, autoGainControl: false } }
    }
    return { audio: { ...base, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }
}
function toggleAudioMode() {
    isMusicMode.value = !isMusicMode.value
    localStorage.setItem('mc_audio_mode', isMusicMode.value ? 'music' : 'voice')
    ElMessage.success(isMusicMode.value ? '🎵 已切换钢琴音质（保真）' : '🗣️ 已切换说话音质（降噪）')
    if (teacherMicStream) { teacherMicStream.getTracks().forEach(t => t.stop()); teacherMicStream = null }
    startTeacherMicDetection()
}
function setMusicMode(v) { if (isMusicMode.value !== v) toggleAudioMode() }

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
        teacherMicStream = await navigator.mediaDevices.getUserMedia(micConstraints())
        startVolumeDetection(teacherMicStream)
    } catch (e) { console.error('[老师麦克风] 获取失败:', e) }
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
        const ts = await navigator.mediaDevices.getUserMedia(micConstraints())
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

function onMicChange() {
    if (teacherMicStream) { teacherMicStream.getTracks().forEach(t => t.stop()); teacherMicStream = null }
    startTeacherMicDetection()
    if (stream) {
        const old = stream.getAudioTracks()[0]
        if (old) old.stop()
        navigator.mediaDevices.getUserMedia(micConstraints())
            .then(newStream => { stream.addTrack(newStream.getAudioTracks()[0]); ElMessage.success('麦克风已切换') })
            .catch(() => ElMessage.error('切换失败'))
    }
}
function onSpeakerChange() {
    // 老师端没有 <video> 了，把选中的扬声器应用到「学员连线的声音」上
    let applied = false
    Object.values(studentAudios).forEach(a => {
        if (a && typeof a.setSinkId === 'function' && selectedSpeaker.value) {
            a.setSinkId(selectedSpeaker.value).then(() => { applied = true }).catch(() => {})
        }
    })
    if (applied) ElMessage.success('扬声器已切换')
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

// ── 流程 ──
function enterPrep() {
    const name = teacherNameInput.value.trim()
    if (!name) { ElMessage.warning('请先输入您的姓名'); return }
    teacherName.value = name
    stage.value = 'device'
}

// ── 教学框 iframe 加载完成 ──
function onStageLoaded() {
    console.log('[TeacherLive] 教学框已加载')
    nextTick(layoutLive)
    // 从排版台同步当前「隐藏」状态，让工具条的隐藏按钮颜色跟实际状态一致
    const win = stageIframeRef.value && stageIframeRef.value.contentWindow
    if (win) {
        try {
            win.postMessage({ type: 'GET_HIDE_STATE' }, '*')
        } catch (e) { /* 忽略 */ }
    }
}

/* ══════ 第4步：进入教学大厅 ══════
   进大厅即建房，学员能提前加入并看到「老师正在准备」的等待状态。
   老师觉得可以了再点「开始直播」。 */
function enterHall() {
    stage.value = 'live'
    isClassStarted.value = true
    nextTick(() => {
        watchLiveLayout()
        requestAnimationFrame(() => { layoutLive(); layoutLive() })
    })
    connectSignaling()
}

function connectSignaling() {
    if (socket) return
    socket = io(SERVER_URL, {
        reconnection: true, reconnectionAttempts: Infinity,
        reconnectionDelay: 1000, reconnectionDelayMax: 10000, timeout: 5000
    })
    setupListeners()

    socket.emit('create-room', { teacherName: teacherName.value }, roomId => {
        currentRoomId.value = roomId
        classUrl.value = `${location.origin}/student/${roomId}`
        ElMessage.success('已进入教学大厅，把学生链接发给学员吧')
    })

    socket.on('disconnect', reason => {
        if (socketClosed || reason === 'io client disconnect') return
        ElMessage.warning('⚠️ 连接断开，正在自动重连...')
    })
    socket.on('reconnect', () => {
        if (socketClosed) return
        ElMessage.success('✅ 连接已恢复')
        if (peerStream) rebuildAllPeers()
    })
}

/* 教学框里是 DOM 排版台（#canvas 是个 div），拿不到 captureStream。
   直播走「屏幕捕获 + CropTarget 裁剪到教学框」：
   isWeb=true 时不裁切，直接共享当前标签页（网页模式）。 */
async function acquireStageCapture(options = {}) {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
        console.warn('[TeacherLive] 浏览器不支持屏幕捕获')
        return null
    }
    let cap = null
    try {
        const hint = options.isWeb
            ? '请选择要共享的浏览器标签页，学员将看到该标签页内容'
            : '请选择「此标签页」，学员将看到教学框里的画面'
        ElMessage.info(hint)
        cap = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 30 },
            audio: false,
            preferCurrentTab: true,
            selfBrowserSurface: 'include',
            surfaceSwitching: 'exclude'
        })
    } catch (e) {
        console.warn('[TeacherLive] 屏幕捕获被取消或失败', e)
        return null
    }
    // 网页模式：直接返回整页画面，不裁切
    if (options.isWeb) return cap
    // 裁剪到教学框：画面里只留教学框，不含顶栏/右栏/操作条
    const track = cap.getVideoTracks()[0]
    const el = stageIframeRef.value
    if (track && el && typeof window.CropTarget !== 'undefined' && typeof track.cropTo === 'function') {
        try {
            const cropTarget = await window.CropTarget.fromElement(el)
            await track.cropTo(cropTarget)
            console.log('[TeacherLive] 已裁剪到教学框区域')
        } catch (e) {
            console.warn('[TeacherLive] 裁剪失败，使用整页画面', e)
        }
    }
    return cap
}

/* 工具条按钮 → 转发给教学框里的排版台执行（工具栏现在长在框外，只能靠消息驱动） */
function toolAction(action) {
    const win = stageIframeRef.value && stageIframeRef.value.contentWindow
    if (!win) return
    try { win.postMessage({ type: 'TOOLBAR_ACTION', action }, '*') } catch (e) { /* 忽略 */ }
}

/* 「隐藏」开关：老师手动控制，隐藏/显示所有框体的标签、边框和编辑工具条。 */
function toggleStageUiHidden() {
    stageUiHidden.value = !stageUiHidden.value
    sendHideToComposer()
}

function sendHideToComposer() {
    const win = stageIframeRef.value && stageIframeRef.value.contentWindow
    if (!win) return
    try { win.postMessage({ type: 'SET_HIDE', on: stageUiHidden.value, manual: true }, '*') } catch (e) { /* 忽略 */ }
}

/* 接收排版台回报的隐藏状态，保持工具条「隐藏」按钮 title 与框内状态一致。 */
function onComposerMessage(e) {
    if (!e.data || typeof e.data !== 'object') return
    if (e.data.type === 'HIDE_STATE') stageUiHidden.value = !!e.data.on
}

/* ══════ 直播开关 ══════
   不按「开始直播」学员看不到教学框内容（但能看到「老师正在准备」）；
   按下才把教学框直播给学员，随时可以停。 */
async function togglePush() {
    if (pushing.value) { stopPush(); return }
    await startPush()
}

async function startPush(options = {}) {
    if (preparing.value) return
    preparing.value = true
    try {
        const cap = await acquireStageCapture(options)
        if (!cap) {
            ElMessage.warning('没有拿到画面授权，学员暂时看不到画面')
            return
        }
        // 麦克风（一次就好，之后复用）
        if (!micStream) {
            try { micStream = await navigator.mediaDevices.getUserMedia(micConstraints()) }
            catch (e) { console.warn('麦克风获取失败，学生可能听不到声音', e); micStream = null }
        }
        const vTracks = cap.getVideoTracks()
        const aTracks = micStream ? micStream.getAudioTracks() : []
        stream = cap
        peerStream = new MediaStream([...vTracks, ...aTracks])
        pushing.value = true

        // 老师点了浏览器自带的「停止共享」→ 自动回到未直播
        vTracks.forEach(t => t.addEventListener('ended', () => {
            if (pushing.value) { stopPush(); ElMessage.warning('画面共享已停止') }
        }))

        rebuildAllPeers()
        ElMessage.success('已开始直播，学员现在能看到画面了')
    } catch (e) {
        console.error('直播失败', e)
        ElMessage.error('直播失败：' + (e?.message || e))
    } finally {
        preparing.value = false
    }
}

function stopPush() {
    if (stream) {
        try { stream.getTracks().forEach(t => t.stop()) } catch (e) { /* 忽略 */ }
    }
    stream = null
    peerStream = null
    pushing.value = false
    rebuildAllPeers()
    ElMessage.info('已停止直播，学员看不到画面了')
}

/* 直播状态变了要让每个在线学员重新协商（画面来了/没了） */
function rebuildAllPeers() {
    Object.keys(peers).forEach(id => {
        try { peers[id].destroy() } catch (e) { /* 忽略 */ }
        delete peers[id]
    })
    if (!socket) return
    students.value.forEach(u => connectToStudent(u.id))
}

/* 给某个学员建立连接。没有 peerStream（未直播）时不建，
   学员端会停在「老师正在准备画面」，老师一开直播就立刻连上。 */
function connectToStudent(id) {
    if (!socket || !socket.connected) return
    if (!peerStream) return
    if (peers[id]) return
    const peer = new SimplePeer({
        initiator: true, trickle: false, stream: peerStream, objectMode: true,
        sdpTransform: s => s, config: rtcConfig()
    })
    peer.on('signal', sig => socket.emit('signal', { to: id, from: socket.id, signal: sig }))
    peer.on('stream', s => {
        studentStreams[id] = s
        if (s.getAudioTracks().length) {
            const u = onlineUsers.value.find(x => x.id === id)
            if (u?.micOn) playStudentAudio(id)
        }
    })
    peer.on('error', err => console.error('Peer error', err))
    peer.on('close', () => { stopStudentAudio(id); delete peers[id] })
    peers[id] = peer
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

    // 学生加入 → 提示；只有推流中才建立画面连接
    socket.on('user-joined', ({ id, name }) => {
        if (name) ElMessage.info(`${name} 加入了沙龙`)
        connectToStudent(id)
    })

    // 学生重连后单独重建 peer
    socket.on('student-rejoined', ({ studentId }) => {
        if (peers[studentId]) { try { peers[studentId].destroy() } catch (e) { /* 忽略 */ } }
        delete peers[studentId]
        stopStudentAudio(studentId)
        connectToStudent(studentId)
    })

    // 老师重连 → 重建所有 peer
    socket.on('rebuild-peers', () => {
        if (!peerStream) return
        onlineUsers.value.forEach(u => {
            if (u.role === 'student' && !peers[u.id]) connectToStudent(u.id)
        })
    })

    // 学员麦克风状态
    socket.on('user-mic-update', ({ id, micOn: m }) => {
        const u = onlineUsers.value.find(x => x.id === id)
        if (u) u.micOn = m
    })

    socket.on('kicked', ({ teacherName: tn }) => {
        ElMessage.error(`您已被老师 ${tn || '老师'} 请出沙龙`)
    })
}

function endClass() {
    ElMessageBox.confirm('确定结束课程？所有学员将被断开。', '结束课程', { type: 'warning' })
        .then(() => {
            if (isRecording.value) stopRecording()
            if (currentRoomId.value && socket) socket.emit('end-class', currentRoomId.value)
            Object.values(peers).forEach(p => { try { p.destroy() } catch (e) { } })
            Object.keys(studentAudios).forEach(stopStudentAudio)
            peers = {}
            if (stream) stream.getTracks().forEach(t => t.stop())
            if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null }
            peerStream = null
            pushing.value = false
            stopVolumeDetection()
            if (socket) { socketClosed = true; socket.disconnect(); socket = null }
            isClassStarted.value = false
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
/* 老款安卓 / 老 WebView：flex gap（Chrome < 84）无效 → 打 .no-flex-gap 用 margin 兜底 */
function detectLegacyWebView() {
    const html = document.documentElement
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
}

onMounted(async () => {
    detectLegacyWebView()
    document.addEventListener('click', onDocClick)
    window.addEventListener('message', onComposerMessage)
    await getAudioDevices()
    try {
        if (navigator.mediaDevices && navigator.mediaDevices.addEventListener)
            navigator.mediaDevices.addEventListener('devicechange', getAudioDevices)
    } catch (e) { /* 老浏览器没有 devicechange，忽略 */ }
})
onBeforeUnmount(() => {
    document.removeEventListener('click', onDocClick)
    window.removeEventListener('message', onComposerMessage)
    if (navigator.mediaDevices) {
      try { navigator.mediaDevices.removeEventListener('devicechange', getAudioDevices) } catch (_) {}
    }
    unwatchLiveLayout()
    if (isRecording.value) stopRecording()
    socketClosed = true
    stopVolumeDetection()
    if (teacherMicStream) { teacherMicStream.getTracks().forEach(t => t.stop()); teacherMicStream = null }
    Object.values(peers).forEach(p => { try { p.destroy() } catch (e) { } })
    Object.keys(studentAudios).forEach(stopStudentAudio)
    if (stream) stream.getTracks().forEach(t => t.stop())
    if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null }
    peerStream = null
    if (socket) socket.disconnect()
})
</script>

<style scoped>
.salon { width: 100%; min-height: 100%; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; }

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
.prep { flex: 1; display: flex; align-items: stretch; padding: 2rem; overflow: hidden; gap: 1.5rem; }
.prep-layout { display: flex; gap: 1.5rem; flex: 1; min-height: 0; }
.prep-sidebar { flex: 0 0 380px; min-width: 320px; }
.prep-card { width: 100%; max-width: none; padding: 2.2rem; height: 100%; }
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

/* ═══ 步骤页（选设备 / 选内容）═══ */
.prep-layout--single { justify-content: center; }
.step-card {
  width: 100%; max-width: 720px; height: auto; align-self: center;
  padding: 2.4rem 2.6rem; max-height: 100%; overflow-y: auto;
}
.step-head { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 2rem; }
.step-no {
  flex: none; width: 2.3rem; height: 2.3rem; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--gold-soft); color: var(--gold); border: 1px solid var(--gold-line);
  font-weight: 700; font-size: 1.05rem; margin-top: .1rem;
}
.step-head .prep-sub { margin-bottom: 0; }
.step-actions { display: flex; gap: .9rem; justify-content: flex-end; margin-top: 2rem; }
.step-actions .el-button { min-width: 8rem; height: 2.9rem; font-size: 1rem; }

/* ═══ ③ 上课中 ═══
   主列宽度由 JS 锁成「画面宽度」，右栏 flex 吃掉所有剩余宽度 —— 任何窗口尺寸都不会
   在画面和右栏之间留下空白（画面是 16:9，扁窗口下会被高度卡住而比整列窄）。 */
.live {
  flex: 1; display: flex; gap: 1rem; padding: 1rem 1.4rem 1.4rem;
  min-height: 0;
  position: relative; z-index: 1; background: var(--bg);
}
.live-main {
  /* 宽度由 layoutLive() 用 JS 锁成「画面宽度」：必须 flex:0 0 auto，
     否则 flex-shrink 会把它压回内容宽度，画面被挤成窄条 */
  flex: 0 0 auto; min-width: 0; display: flex; flex-direction: column; gap: 1rem; padding: 0;
  min-height: 0;
}
/* 右栏吃掉所有剩余宽度（画面 16:9 被高度卡住时，剩余空间全给右栏，中间不留缝） */
.live-rail { flex: 1 1 0; min-width: 22rem; display: flex; flex-direction: column; gap: 1rem; min-height: 0; }

/* 老款安卓降级：flex gap 在 Chrome < 84 无效，卡片会全贴在一起 → 用 margin 顶替 */
.no-flex-gap .live-rail > * + * { margin-top: 1rem; }
.no-flex-gap .live-main > * + * { margin-top: 1rem; }
.no-flex-gap .audio-strip > * + * { margin-left: 1rem; }
.no-flex-gap .chat-input-row .el-button { margin-left: .5rem; }
.no-flex-gap .student-actions > * + * { margin-left: .4rem; }
.no-flex-gap .audio-strip > * + * { margin-left: .6rem; }

/* ═══ 排版工具条（在教学框外面）═══
   以前它在 iframe 内部，隐藏时只把 opacity 归零、56px 高度还在，
   画面顶上就留一条黑框；现在搬出来，框里只剩内容，画布正好 16:9。 */
.stage-tools {
  display: flex; align-items: center; gap: .38rem; flex-shrink: 0;
  padding: .32rem .45rem;
  background: var(--panel); border: 1px solid var(--line);
  border-radius: var(--r-md);
  overflow-x: auto; overflow-y: hidden; scrollbar-width: none;
}
.stage-tools::-webkit-scrollbar { height: 0; }
.stool {
  padding: .32rem .72rem; border-radius: 6px;
  border: 1px solid var(--line-2); background: var(--panel-2);
  color: var(--text-2); font-size: .78rem; font-family: inherit;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
  transition: color .15s, border-color .15s, background .15s;
  -webkit-tap-highlight-color: transparent;
}
.stool:hover { color: var(--gold); border-color: var(--gold-line); background: var(--panel-3); }
.stool.danger { color: #FF7A7F; border-color: rgba(255,90,95,.32); }
.stool.danger:hover { background: rgba(255,90,95,.14); border-color: rgba(255,90,95,.55); }
.stool-gap { flex: 1; min-width: .4rem; }

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
.video-stage {
  position: relative;
  width: min(100cqw, calc(100cqh * 16 / 9));
  aspect-ratio: 16 / 9;
  margin: 0;
  background: #05070A; border-color: #222D3D;
  overflow: hidden; display: block;
}
/* 教学框里就是排版台本身，老师可直接在里面拖拽 */
.stage-iframe {
  position: absolute; top: 0; right: 0; bottom: 0; left: 0; width: 100%; height: 100%;
  border: none; background: #0f1216; display: block;
}

/* ── 直播开关（灰灯 = 未开播，红灯亮 = 直播中）── */
.live-toggle {
  display: inline-flex; align-items: center; gap: .42rem;
  padding: .36rem .8rem .36rem .62rem; border-radius: 999px;
  border: 1px solid var(--line-2); background: var(--panel-3);
  color: var(--text-3); font-size: .78rem; font-family: inherit; font-weight: 600;
  cursor: pointer; flex-shrink: 0; transition: all .18s;
  -webkit-tap-highlight-color: transparent;
}
.live-toggle:hover { border-color: var(--gold-line); color: var(--text-2); }
.live-label { letter-spacing: .02em; }
/* 灰灯：熄灭状态 */
.live-dot {
  width: .54rem; height: .54rem; border-radius: 50%;
  background: #4C5766;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.07);
  transition: background .18s, box-shadow .18s;
}
/* 红灯：亮起 + 呼吸光晕 */
.live-toggle.on {
  color: #FF7A7F; border-color: rgba(255,90,95,.5); background: rgba(46,12,14,.72);
}
.live-toggle.on .live-dot {
  background: #FF5A5F;
  box-shadow: 0 0 0 2px rgba(255,90,95,.2), 0 0 10px 2px rgba(255,90,95,.6);
  animation: recblink 1.5s ease-in-out infinite;
}

@keyframes recblink { 0%, 100% { opacity: 1 } 50% { opacity: .25 } }


/* 控制条永远单行：一旦换行，音频条会从 57px 涨到 91px，
   把教学框整体挤矮 100 多 px（看起来像"页面缩小了"）、录制按钮被挤到第二行。
   做法：nowrap + 各控件可压缩，实在放不下才横向滚动。 */
.audio-strip {
  display: flex; align-items: center; flex-wrap: nowrap; gap: .6rem 1rem;
  padding: .7rem 1.1rem; flex-shrink: 0;
  width: auto;
  overflow-x: auto; overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.audio-strip::-webkit-scrollbar { height: 0; }
.strip-group { display: flex; align-items: center; gap: .5rem; min-width: 0; flex: 0 1 auto; }
/* 含按钮的组不参与收缩（否则「钢琴音质」会被压成只剩图标） */
.strip-group.no-shrink { flex-shrink: 0; }
.strip-group .el-button { flex-shrink: 0; white-space: nowrap; }
.strip-label { font-size: .82rem; color: var(--text-2); white-space: nowrap; flex-shrink: 0; }
/* 下拉框可被压缩（9.5rem → 最低 5rem），窗口变窄时先挤它，而不是换行 */
.strip-select { width: 9.5rem; min-width: 5rem; flex: 0 1 9.5rem; }
.vol-bar.sm { width: 5rem; flex: 0 1 5rem; min-width: 2rem; }
.strip-rec { margin-left: auto; flex-shrink: 0; }

/* ═══ 右栏卡片 ═══ */
.rail-card { padding: 1.1rem 1.25rem; display: flex; flex-direction: column; min-height: 0; flex-shrink: 1; }
.rail-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: .85rem; flex-shrink: 0; }
.rail-title { font-size: 1.05rem; font-weight: 600; }
.rail-empty { color: var(--text-3); font-size: .85rem; text-align: center; padding: 1.2rem .5rem; line-height: 1.8; flex-shrink: 0; }
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

.chat-scroll { flex: 1; overflow-y: auto; min-height: 0; padding: .2rem; -webkit-overflow-scrolling: touch; }
.chat-empty { color: var(--text-3); font-size: .85rem; text-align: center; padding: 2rem .5rem; }
.chat-input-row { display: flex; gap: .5rem; margin-top: .8rem; flex-shrink: 0; align-items: center; }
.chat-input-row .el-input { flex: 1; }
.emoji-wrap { position: relative; flex-shrink: 0; }
.emoji-trigger { font-size: 1.15rem; padding: .5rem .7rem; }
.emoji-panel {
  position: absolute; bottom: calc(100% + .55rem); left: 0;
  background: var(--panel-2); border: 1px solid var(--line-2); border-radius: var(--r-md);
  padding: .5rem; display: grid; grid-template-columns: repeat(8, 1fr); gap: .3rem;
  box-shadow: 0 10px 34px rgba(0,0,0,.55); z-index: 40;
}

/* ═══ 桌面端：页面锁定视口高度，只有内部区域滚动 ═══ */
@media (min-width: 900px) {
  .salon { height: 100dvh; overflow: hidden; }
  .entry { overflow-y: auto; }
  /* 学员卡按人数长高，最多占右栏 55%，再多才在卡内滚动（原来 42% 放 3 个人就切半行） */
  .rail-card:not(.chat-card) { max-height: 55%; }
}

/* ═══ 响应式 ═══ */
@media (max-width: 1024px) and (min-width: 641px) {
  /* 窄窗口里「扬声器」组先让位（改扬声器在选设备那步也能改），
     否则它的文字会被压成单个「扬」字 */
  .audio-strip .strip-group.hide-m { display: none; }
}

@media (max-width: 899px) {
  .salon { height: 100%; height: 100vh; height: 100dvh; overflow: hidden; }
  .live {
    flex: 1; min-height: 0; flex-direction: column;
    overflow-y: auto; -webkit-overflow-scrolling: touch;
  }
  /* 手机上不再让内部 flex 抢高度（会把学员卡压成一条缝）：
     主列和右栏都按内容自然高，整个 .live 作为唯一滚动容器 */
  .live-main { flex: none; display: flex; flex-direction: column; }
  .stage-area { flex: none; display: block; container-type: normal; }
  .video-stage { width: 100%; }
  .live-rail { min-width: 0; max-height: none; flex: none; display: flex; flex-direction: column; }
  .rail-card:not(.chat-card) { max-height: none; }
  .audio-strip { width: 100%; }
  .topbar-link { margin: 0 .6rem; }
  .chat-card { flex: none; min-height: 14rem; }
}
@media (max-width: 640px) {
  .topbar { padding: .6rem .9rem; }
  .live { padding: .8rem; gap: .75rem; }
  .video-stage { border-radius: var(--r-md); }
  .audio-strip { gap: .5rem .8rem; }
  .strip-select { width: 7.5rem; }
  .student-actions .el-button { padding: .4rem .6rem; font-size: .78rem; }
  .chat-card { min-height: 12rem; }
  .mode-cards { grid-template-columns: 1fr; }
  /* 手机上顶栏太挤：只留「学生链接」标签和复制按钮，URL 由标题浮层看 */
  .topbar-link { margin: 0 .5rem; padding: .22rem .26rem .22rem .6rem; }
  .tl-url { display: none; }
  .entry { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  /* 步骤页：手机上三列卡片太窄，改成单列横排（图标左、标题+说明右） */
  .prep { padding: 1rem .9rem; }
  .step-card { padding: 1.5rem 1.2rem; }
  .step-head { gap: .75rem; margin-bottom: 1.4rem; }
  .step-actions { margin-top: 1.4rem; }
  .step-actions .el-button { min-width: 0; flex: 1; height: 2.7rem; font-size: .95rem; }
  /* 直播开关在手机上别太占地方 */
  .live-toggle { padding: .34rem .72rem .34rem .56rem; font-size: .76rem; }
  /* 手机上控制条太挤：音量条让位（设备名本身够用） */
  .audio-strip .vol-bar.sm { display: none; }
  .audio-strip { gap: .5rem .7rem; padding: .6rem .8rem; }
  /* 360 宽的老安卓放不下 6 个工具按钮，压缩间距和字号 */
  .stage-tools { gap: .3rem; padding: .28rem .38rem; }
  .stool { padding: .28rem .58rem; font-size: .74rem; }
  .stool-gap { min-width: 0; }
}

/* 超窄屏（≤400px）：控制条里省略「麦克风/声音」标签文字，
   否则「钢琴音质」会被裁成「琴音质」。下拉框自己会显示设备名，不影响理解。 */
@media (max-width: 400px) {
  .audio-strip .strip-label { display: none; }
}
</style>
