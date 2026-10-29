document.addEventListener('DOMContentLoaded', function() {
'use strict';
/* 钢琴教学排版台 - 渲染层 */
const $ = s => document.querySelector(s);
const canvas = document.getElementById('canvas');
const guidesBox = $('#guides');
const emptyHint = $('#emptyHint');

let frames = [];
let zTop = 20;
let selectedId = null;
let snapEnabled = true;
const MAX_FRAMES = 12;
const SNAP_PX = 8;
const MIN_W = 80, MIN_H = 50;

/* ---------- 设置持久化 ---------- */
const SET_KEY = 'compositor.settings';
// 只保留真正会读写的项：上次用的镜头、直播模式状态
let ui = { camDeviceId: '', hide: false };
try {
  const s = JSON.parse(localStorage.getItem(SET_KEY) || '{}');
  for (const k in s) if (s.hasOwnProperty(k) && k in ui) ui[k] = s[k];
} catch (e) {}
function saveUI() { try { localStorage.setItem(SET_KEY, JSON.stringify(ui)); } catch (e) {} }

/* ---------- 诊断日志 ---------- */
const diagErrors = [];
function diag(msg) {
  const line = new Date().toLocaleTimeString() + ' ' + msg;
  diagErrors.push(line);
  if (diagErrors.length > 50) diagErrors.shift();
  try { window.compositor && window.compositor.log(msg); } catch (e) {}
}
window.addEventListener('error', e => diag('window.onerror: ' + e.message + ' @' + (e.filename || '') + ':' + (e.lineno || 0)));
window.addEventListener('unhandledrejection', e => diag('unhandledrejection: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)));

function uid() { return 'f' + Math.random().toString(36).slice(2, 9); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fileUrl(p) {
  // 逐段编码，中文/空格路径才稳（本地 file:// 用；http(s):// 直接返回）
  const s = String(p);
  if (/^https?:/i.test(s)) return s;
  return 'file://' + s.split('/').map(encodeURIComponent).join('/');
}
function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}
function toast(msg) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ================= 框体创建与渲染 ================= */

function addFrame(cfg) {
  if (frames.length >= MAX_FRAMES) {
    toast('框体数量已达上限（' + MAX_FRAMES + ' 个），请先删除不用的');
    return null;
  }
  let f;
  try {
    f = Object.assign({
      id: uid(), kind: 'video', name: '源',
      x: 60, y: 60, w: 640, h: 360,
      z: ++zTop, locked: false
    }, cfg);
  } catch (e) {
    diag('addFrame merge error: ' + e.message);
    return null;
  }
  if (f.kind === 'text' && !f.baseW) f.baseW = f.w;
  frames.push(f);
  renderFrame(f);
  selectFrame(f.id);
  persist();
  updateEmptyHint();
  return f;
}

function renderFrame(f) {
  const el = document.createElement('div');
  el.className = 'frame';
  el.dataset.id = f.id;
  el.innerHTML =
    '<div class="fbar">' +
      '<span class="ftitle">' + esc(f.name) + '</span>' +
      '<span class="facts">' +
        (f.kind === 'keys' ? '<button data-act="kopts" title="琴键风格/背景/音域">琴键</button>' : '') +
        (f.kind === 'text' ? '<button data-act="topts" title="字体/字号/颜色/描边/背景/阴影">文字</button>' : '') +
        (f.kind === 'desktop' ? '<button data-act="max" title="铺满整个画布">铺满</button>' : '') +
        '<button data-act="front" title="提到最前">置顶</button>' +
        '<button data-act="lock" title="锁定位置">锁定</button>' +
        '<button data-act="close" title="删除" class="fbtn-x">&times;</button>' +
      '</span>' +
    '</div>' +
    '<div class="fbody"></div>' +
    // 边缘/角落缩放的透明检测层（覆盖 fbody 上方，不显示任何视觉手柄）
    '<div class="edge-zone ez-n" data-zone="n"></div>' +
    '<div class="edge-zone ez-s" data-zone="s"></div>' +
    '<div class="edge-zone ez-w" data-zone="w"></div>' +
    '<div class="edge-zone ez-e" data-zone="e"></div>' +
    '<div class="edge-zone ez-nw" data-zone="nw"></div>' +
    '<div class="edge-zone ez-ne" data-zone="ne"></div>' +
    '<div class="edge-zone ez-sw" data-zone="sw"></div>' +
    '<div class="edge-zone ez-se" data-zone="se"></div>';
  canvas.appendChild(el);
  f.el = el;
  if (f.kind === 'text') {
    el.querySelector('.fbody').classList.add('text-body');
    el.classList.add('text-frame');   // 文字框不要黑底
  }
  applyFrameStyle(f);
  fillBody(f, el.querySelector('.fbody'));
  wireFrame(f, el);
}

function applyFrameStyle(f) {
  f.el.style.left = f.x + 'px';
  f.el.style.top = f.y + 'px';
  f.el.style.width = f.w + 'px';
  f.el.style.height = f.h + 'px';
  f.el.style.zIndex = f.z;
}

function showErr(body, html) {
  body.innerHTML = '<div class="ferr">' + html + '</div>';
}

/* ---------- 窗口/屏幕采集 ---------- */
function acquireDesktop(f, body) {
  // 网页版没有 desktopCapturer，也没有 chromeMediaSource 约束，
  // 唯一可用的就是 getDisplayMedia（浏览器屏幕共享，可选窗口/整个屏幕）
  acquireWebDesktop(f, body);
}

/* 网页版窗口采集：getDisplayMedia（浏览器屏幕共享，可选窗口/整个屏幕） */
function acquireWebDesktop(f, body) {
  body.innerHTML = '<div class="floading">正在请求屏幕共享…<br>请在弹出的浏览器对话框中选择要采集的窗口或屏幕</div>';
  let done = false;
  const timer = setTimeout(() => {
    if (done) return;
    done = true;
    diag('web desktop capture timeout: ' + f.name);
    showErr(body, '屏幕共享请求超时或已取消。' +
      '<div class="fbtns"><button class="fbtn" data-retry="1">重新共享</button></div>');
  }, 30000);

  navigator.mediaDevices.getDisplayMedia({
    video: { cursor: 'always', frameRate: 30 },
    audio: false
  }).then(stream => {
    if (done) { stream.getTracks().forEach(t => t.stop()); return; }
    done = true;
    clearTimeout(timer);
    if (!stream.getVideoTracks().length) {
      showErr(body, '未选择任何屏幕区域。' +
        '<div class="fbtns"><button class="fbtn" data-retry="1">重新共享</button></div>');
      return;
    }
    body.innerHTML = '';
    const v = document.createElement('video');
    v.autoplay = true; v.playsInline = true; v.muted = true;
    v.style.objectFit = 'contain';   // 正常模式用contain保留黑边，直播时CSS覆盖为cover
    v.srcObject = stream;
    body.appendChild(v);
    if (f.stream) f.stream.getTracks().forEach(t => t.stop());
    f.stream = stream;
    followStreamAspect(f, v);       // 框体跟随实际共享画面的比例
    stream.getVideoTracks().forEach(tr => {
      tr.addEventListener('ended', () => showErr(body, '屏幕共享已结束。' +
        '<div class="fbtns"><button class="fbtn" data-retry="1">重新共享</button></div>'));
    });
    const track = stream.getVideoTracks()[0];
    // 共享整个屏幕时 track.label 形如 "screen:0:0" / "Entire screen"，别写成「窗口 · 」
    const lbl = (track && track.label) || '';
    if (lbl && lbl !== 'Screen') {
      const isScreen = /^screen/i.test(lbl) || /^(entire|整个|屏幕)/i.test(lbl);
      const label = (isScreen ? '屏幕 · ' : '窗口 · ') + lbl;
      const title = f.el.querySelector('.ftitle');
      if (title) title.textContent = label;
      f.name = label;
      f.isScreen = isScreen;
      persist();
    }
  }).catch(err => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    diag('web desktop capture failed: ' + f.name + ' -> ' + (err.name || '') + ' ' + (err.message || err));
    if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
      showErr(body, '屏幕共享已取消。' +
        '<div class="fbtns"><button class="fbtn" data-retry="1">重新共享</button></div>');
    } else {
      showErr(body, '屏幕共享失败：' + esc(err.message || err.name) +
        '<div class="fbtns"><button class="fbtn" data-retry="1">重试</button></div>');
    }
  });
}

/* ---------- 镜头采集 ---------- */
function acquireCamera(f, body) {
  // 网络互联相机：后端 ffmpeg 把 RTSP 转成 MJPEG，<img> 能原生播放
  if (f.netUrl) { acquireNetCamera(f, body); return; }

  body.innerHTML = '<div class="floading">正在启动镜头…</div>';
  let done = false;
  const timer = setTimeout(() => {
    if (done) return;
    done = true;
    showErr(body, '镜头启动超时。请检查 系统设置 → 隐私与安全性 → 摄像头 权限，或是否已被其他应用（如 OBS）独占。');
  }, 10000);
  navigator.mediaDevices.getUserMedia({
    audio: false,
    video: f.deviceId ? { deviceId: { exact: f.deviceId } } : { width: { ideal: 1280 }, height: { ideal: 720 } }
  }).then(stream => {
    if (done) { stream.getTracks().forEach(t => t.stop()); return; }
    done = true;
    clearTimeout(timer);
    try {
      body.innerHTML = '';
      const v = document.createElement('video');
      v.autoplay = true; v.playsInline = true; v.muted = true;
      v.style.objectFit = 'contain';   // 正常模式用contain保留黑边，直播时CSS覆盖为cover
      v.srcObject = stream;
      body.appendChild(v);
      f.stream = stream;
      followStreamAspect(f, v);      // 框体跟随镜头实际画面的比例
    } catch (e2) {
      diag('camera attach video failed: ' + e2.message);
      showErr(body, '画面挂载失败：' + esc(e2.message));
    }
  }).catch(err => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    diag('camera failed: ' + (err.name || '') + ' ' + (err.message || ''));
    showErr(body, '镜头启动失败：' + esc(err.message || err.name) +
      '<br>请检查 系统设置 → 隐私与安全性 → 摄像头 权限；若其他应用正在使用镜头，请先退出。');
  });
}

/* ---------- 网络相机（MJPEG over HTTP） ---------- */
// <img> 对 multipart/x-mixed-replace 是原生支持的：换一帧就重绘一次，
// 延迟比 HLS 低（0.2~0.5s），也不需要额外播放器库。
function netCamSrc(url, w, fps) {
  const q = '?url=' + encodeURIComponent(url) + '&w=' + (w || 1280) + '&fps=' + (fps || 20);
  return CAM_API + '/stream' + q;
}

function acquireNetCamera(f, body) {
  body.innerHTML = '<div class="floading">正在连接网络相机…</div>';
  let settled = false;

  const img = document.createElement('img');
  img.alt = '';
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'contain';
  img.style.display = 'block';

  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    showErr(body, '网络相机连接超时。' +
      '<br>请确认相机在线、地址与账号密码正确，且和本机在同一局域网。' +
      '<div class="fbtns"><button class="fbtn" data-retry="1">重试</button></div>');
  }, 12000);

  img.onload = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    body.innerHTML = '';
    body.appendChild(img);
    f.netImg = img;
    // MJPEG 的第一帧尺寸就是相机的真实分辨率
    if (img.naturalWidth && img.naturalHeight) {
      fitFrameToAspect(f, img.naturalWidth / img.naturalHeight);
    }
  };
  img.onerror = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    diag('net camera failed: ' + (f.netUrl || ''));
    showErr(body, '网络相机没有画面。' +
      '<br>常见原因：地址路径不对、需要账号密码、相机被其他设备占满连接数。' +
      '<div class="fbtns"><button class="fbtn" data-retry="1">重试</button></div>');
  };

  img.src = netCamSrc(f.netUrl, 1280, 20);
}

/* ================= 文字源 ================= */
// 精选 5 款 macOS 自带字体：都覆盖中英文、无需安装、直播录屏清晰
const FONTS = {
  pingfang: { label: '苹方 · 系统默认（最清晰，正文首选）', css: '"PingFang SC","Helvetica Neue",sans-serif' },
  kaiti:    { label: '楷体 · 板书手写感（讲乐理最像老师写字）', css: '"Kaiti SC","STKaiti","Songti SC",serif' },
  songti:   { label: '宋体 · 正式古典（曲名、标题）', css: '"Songti SC","STSong","PingFang SC",serif' },
  yuanti:   { label: '圆体 · 亲和圆润（儿童课、口语化）', css: '"Yuanti SC","Hiragino Sans GB","PingFang SC",sans-serif' },
  helv:     { label: 'Helvetica · 英文数字（和弦记号 C Am7）', css: '"Helvetica Neue",Helvetica,Arial,"PingFang SC",sans-serif' }
};
const TEXT_DEFAULT = {
  text: '双击编辑文字',
  font: 'pingfang', size: 48, color: '#ffffff', weight: 600,
  align: 'left', lineHeight: 1.3,
  stroke: 0, strokeColor: '#000000',
  bg: 'none', bgColor: '#000000', bgOpacity: 0.55,
  shadow: 0, shadowColor: '#000000', shadowBlur: 3, shadowX: 1, shadowY: 1
};

function hexToRgba(hex, a) {
  let h = String(hex || '#000000').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16) || 0;
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function textOpts(f) { return Object.assign({}, TEXT_DEFAULT, f.opts || {}); }

// 字号/描边/圆角都按「框宽 / 基准宽」等比缩放，所以缩放框体时文字整体放大而不变形
function applyTextStyle(f, doFit) {
  const body = f.el && f.el.querySelector('.fbody');
  if (!body) return;
  const d = body.querySelector('.ctext');
  if (!d) return;
  const o = textOpts(f);
  const F = FONTS[o.font] || FONTS.pingfang;
  const scale = f.baseW ? (f.w / f.baseW) : 1;
  const size = Math.max(6, o.size * scale);
  const st = d.style;
  st.fontFamily = F.css;
  st.fontSize = size.toFixed(1) + 'px';
  st.fontWeight = String(o.weight);
  st.color = o.color;
  st.textAlign = o.align;
  st.lineHeight = String(o.lineHeight);
  // 文字框体跟随内容大小（padding 让文字周围有留白）
  if (o.bg === 'color') {
    const padY = Math.round(size * 0.35), padX = Math.round(size * 0.55);
    st.padding = padY + 'px ' + padX + 'px';
    st.background = hexToRgba(o.bgColor, o.bgOpacity);
    st.borderRadius = Math.round(size * 0.22) + 'px';
  } else {
    st.padding = '0';
    st.background = 'transparent';
    st.borderRadius = '0';
  }
  st.textShadow = o.shadow
    ? o.shadowBlur + 'px ' + o.shadowX + 'px ' + o.shadowY + 'px ' + hexToRgba(o.shadowColor, 0.62)
    : 'none';
  st.webkitTextStroke = o.stroke > 0 ? (o.stroke * Math.max(0.4, scale)).toFixed(2) + 'px ' + o.strokeColor : '0';
  st.paintOrder = 'stroke fill';
  // 拖动缩放时（doFit === false）不要重新适配，否则会和拖拽互相打架
  if (doFit !== false) fitTextBox(f, o);
}

/* 按文字真实尺寸自动定框体大小。
   关键：先用 width:max-content 量「自然宽度」，绝不能用 scrollWidth——
   .ctext 的宽度是 100% 跟随框宽，拿它测会得到「框宽+留白」，
   再写回框宽就变成每次调用自增一截的死循环。 */
function fitTextBox(f, o) {
  const body = f.el && f.el.querySelector('.fbody');
  if (!body) return;
  const d = body.querySelector('.ctext');
  if (!d) return;
  const Wmax = Math.max(MIN_W, canvas.clientWidth);
  const Hmax = Math.max(MIN_H, canvas.clientHeight);
  const prevW = d.style.width, prevH = d.style.height;
  const withBg = !!(o && o.bg === 'color');

  // 1) 自然宽度：max-content 与框宽无关
  d.style.width = 'max-content';
  d.style.height = 'auto';
  const naturalW = Math.ceil(d.getBoundingClientRect().width);

  // 文字与边框之间的呼吸空间：有背景块时 padding 已经撑开，额外留白少一点
  const gapX = withBg ? 16 : 40;
  const gapY = withBg ? 12 : 18;
  const boxW = Math.min(Math.max(naturalW + gapX, MIN_W), Wmax);

  // 2) 用「缩放后 fbody 的实际宽度」换行，量换行后的真实高度
  //    （框体左右各 1px 边框，所以内容宽 = boxW - 2）
  d.style.width = Math.max(1, boxW - 2) + 'px';
  const textH = Math.ceil(d.scrollHeight);
  d.style.width = prevW;
  d.style.height = prevH;

  const boxH = Math.min(Math.max(textH + 26 + gapY, MIN_H), Hmax);  // 26 = 标题栏

  if (Math.abs(boxW - f.w) > 2 || Math.abs(boxH - f.h) > 2) {
    // 保持当前字号缩放比例不变（f.w / f.baseW），只改框体尺寸
    const curScale = (f.baseW && f.w) ? (f.w / f.baseW) : 1;
    f.w = boxW; f.h = boxH;
    f.baseW = curScale > 0 ? Math.round(boxW / curScale) : boxW;
    f.x = Math.max(0, Math.min(f.x, canvas.clientWidth - boxW));
    f.y = Math.max(0, Math.min(f.y, canvas.clientHeight - boxH));
    applyFrameStyle(f);
    persist();
  }
}

function startEditText(f, d) {
  if (d.isContentEditable) return;
  d.contentEditable = 'true';
  d.classList.add('editing');
  d.focus();
  try {
    const r = document.createRange();
    r.selectNodeContents(d);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(r);
  } catch (e) {}
  const finish = () => {
    if (!d.isContentEditable) return;
    d.contentEditable = 'false';
    d.classList.remove('editing');
    f.opts = Object.assign(textOpts(f), { text: d.innerText.replace(/\n+$/, '') });
    persist();
    diag('text edited: ' + f.opts.text.slice(0, 40));
  };
  d.addEventListener('blur', finish, { once: true });
  d.addEventListener('keydown', ev => {
    ev.stopPropagation();               // 别让 Delete 把整个文字框删掉
    if (ev.key === 'Escape') { ev.preventDefault(); d.blur(); }
  });
}

function renderText(f, body) {
  const d = document.createElement('div');
  d.className = 'ctext';
  d.textContent = textOpts(f).text;
  body.appendChild(d);
  applyTextStyle(f);
  d.addEventListener('dblclick', e => { e.stopPropagation(); startEditText(f, d); });
}

function openTextOpts(f) {
  if (document.getElementById('textOptsModal')) return;
  const o = textOpts(f);
  const backup = JSON.stringify(o);
  const draft = JSON.parse(JSON.stringify(o));

  const wrap = document.createElement('div');
  wrap.id = 'textOptsModal';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)';
  wrap.innerHTML =
    '<div style="width:392px;max-height:88vh;overflow-y:auto;overflow-x:hidden;background:#1c2027;color:#e9ecf2;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.5);font-size:13px">' +
      '<div style="font-weight:600;margin:-18px -18px 12px;padding:13px 18px;border-bottom:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.035);border-radius:14px 14px 0 0">文字设置<span style="float:right;font-weight:400;color:#7c8595;font-size:11px">可拖动</span></div>' +
      '<div class="tp-row"><label>内容</label><textarea data-t="text"></textarea></div>' +
      '<div class="tp-row"><label>字体</label><select data-t="font">' +
        Object.keys(FONTS).map(k => '<option value="' + k + '">' + FONTS[k].label + '</option>').join('') +
      '</select></div>' +
      '<div class="tp-row"><label>字号</label><input type="range" data-t="size" min="10" max="220" step="1"><span class="val" data-v="size"></span></div>' +
      '<div class="tp-row"><label>颜色</label><input type="color" data-t="color">' +
        '<label style="width:auto;margin-left:8px">粗细</label><select data-t="weight" style="flex:0 0 96px">' +
          '<option value="300">细 300</option><option value="400">常规 400</option><option value="500">中 500</option>' +
          '<option value="600">半粗 600</option><option value="700">粗 700</option><option value="800">特粗 800</option>' +
        '</select></div>' +
      '<div class="tp-row"><label>对齐</label><select data-t="align">' +
        '<option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select>' +
        '<label style="width:auto;margin-left:8px">行高</label><input type="range" data-t="lineHeight" min="0.8" max="2.4" step="0.05" style="flex:0 0 96px"><span class="val" data-v="lineHeight"></span></div>' +
      '<div class="tp-row"><label>描边</label><input type="range" data-t="stroke" min="0" max="6" step="0.25"><span class="val" data-v="stroke"></span>' +
        '<input type="color" data-t="strokeColor"></div>' +
      '<div class="tp-row"><label>背景块</label><select data-t="bg"><option value="none">无</option><option value="color">半透明底</option></select>' +
        '<input type="color" data-t="bgColor"><input type="range" data-t="bgOpacity" min="0" max="1" step="0.05" style="flex:0 0 72px"></div>' +
      '<div class="tp-row"><label>阴影</label><label class="chk" style="width:auto"><input type="checkbox" data-t="shadow"> 开</label>' +
        '<input type="color" data-t="shadowColor" title="阴影颜色"></div>' +
      '<div class="tp-row tp-sub"><label>模糊</label><input type="range" data-t="shadowBlur" min="0" max="30" step="0.5"><span class="val" data-v="shadowBlur"></span></div>' +
      '<div class="tp-row tp-sub"><label>水平</label><input type="range" data-t="shadowX" min="-20" max="20" step="0.5"><span class="val" data-v="shadowX"></span></div>' +
      '<div class="tp-row tp-sub"><label>垂直</label><input type="range" data-t="shadowY" min="-20" max="20" step="0.5"><span class="val" data-v="shadowY"></span></div>' +
      '<div style="display:flex;gap:10px;margin-top:16px">' +
        '<button data-x="cancel" style="flex:1;padding:8px;border-radius:9px;border:1px solid rgba(255,255,255,.14);background:#2a2f38;color:#e9ecf2;cursor:pointer">取消</button>' +
        '<button data-x="ok" style="flex:1;padding:8px;border-radius:9px;border:0;background:#ffb84d;color:#1a1d22;font-weight:600;cursor:pointer">应用</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);
  draggableModal(wrap.firstElementChild, wrap.firstElementChild.firstElementChild);

  const q = sel => wrap.querySelector('[data-t="' + sel + '"]');
  const vv = sel => wrap.querySelector('[data-v="' + sel + '"]');

  function syncUI() {
    q('text').value = draft.text;
    q('font').value = draft.font;
    q('size').value = draft.size; vv('size').textContent = draft.size + 'px';
    q('color').value = draft.color;
    q('weight').value = String(draft.weight);
    q('align').value = draft.align;
    q('lineHeight').value = draft.lineHeight; vv('lineHeight').textContent = draft.lineHeight;
    q('stroke').value = draft.stroke; vv('stroke').textContent = draft.stroke;
    q('strokeColor').value = draft.strokeColor;
    q('bg').value = draft.bg;
    q('bgColor').value = draft.bgColor;
    q('bgOpacity').value = draft.bgOpacity;
    q('shadow').checked = !!draft.shadow;
    q('shadowColor').value = draft.shadowColor || '#000000';
    q('shadowBlur').value = draft.shadowBlur || 3;
    q('shadowX').value = draft.shadowX || 1;
    q('shadowY').value = draft.shadowY || 1;
    if (vv('shadowBlur')) vv('shadowBlur').textContent = draft.shadowBlur || 3;
    if (vv('shadowX')) vv('shadowX').textContent = draft.shadowX || 1;
    if (vv('shadowY')) vv('shadowY').textContent = draft.shadowY || 1;
  }
  function preview() {
    f.opts = Object.assign({}, draft);
    const body = f.el.querySelector('.fbody');
    const d = body.querySelector('.ctext');
    if (d && !d.isContentEditable) d.textContent = draft.text;
    applyTextStyle(f);
  }
  function readUI() {
    draft.text = q('text').value;
    draft.font = q('font').value;
    draft.size = +q('size').value;
    draft.color = q('color').value;
    draft.weight = +q('weight').value;
    draft.align = q('align').value;
    draft.lineHeight = +q('lineHeight').value;
    draft.stroke = +q('stroke').value;
    draft.strokeColor = q('strokeColor').value;
    draft.bg = q('bg').value;
    draft.bgColor = q('bgColor').value;
    draft.bgOpacity = +q('bgOpacity').value;
    draft.shadow = q('shadow').checked ? 1 : 0;
    draft.shadowColor = q('shadowColor').value;
    draft.shadowBlur = +q('shadowBlur').value;
    draft.shadowX = +q('shadowX').value;
    draft.shadowY = +q('shadowY').value;
    syncUI();
  }
  wrap.addEventListener('input', e => {
    if (!e.target.matches('[data-t]')) return;
    readUI(); preview();
  });
  wrap.addEventListener('change', e => {
    if (!e.target.matches('[data-t]')) return;
    readUI(); preview();
  });

  const close = () => wrap.remove();
  wrap.addEventListener('click', e => { if (e.target === wrap) { f.opts = JSON.parse(backup); applyTextStyle(f); const d = f.el.querySelector('.ctext'); if (d) d.textContent = textOpts(f).text; close(); } });
  wrap.querySelector('[data-x="cancel"]').addEventListener('click', () => {
    f.opts = JSON.parse(backup);
    const d = f.el.querySelector('.ctext');
    if (d) d.textContent = textOpts(f).text;
    applyTextStyle(f);
    close();
  });
  wrap.querySelector('[data-x="ok"]').addEventListener('click', () => {
    f.opts = Object.assign({}, draft);
    applyTextStyle(f);
    persist();
    close();
    toast('文字设置已应用');
  });
  syncUI();
  q('text').focus();
}

/* ---------- 琴键源：参数拼装 + 样式弹窗 ---------- */
const KEY_DEFAULT = { style: 'real', bg: 'dark', jianpu: 1, names: 0, frame: 1, range: '', accent: 'ffb84d', bar: 0, barColor: 'ffb84d', barScale: '0.26', barMode: 'random' };

function keysSrc(f) {
  const o = Object.assign({}, KEY_DEFAULT, f.opts || {});
  const q = new URLSearchParams();
  q.set('style', o.style);
  q.set('bg', o.bg);
  q.set('jianpu', o.jianpu ? '1' : '0');
  q.set('names', o.names ? '1' : '0');
  q.set('frame', o.frame ? '1' : '0');
  q.set('bar', o.bar ? '1' : '0');
  q.set('barColor', String(o.barColor || o.accent || 'ffb84d').replace(/^#/, ''));
  q.set('barH', String(o.barScale || '0.26'));
  q.set('barMode', o.barMode || 'random');
  q.set('panel', '0');
  q.set('accent', String(o.accent || 'ffb84d').replace(/^#/, ''));
  // MIDI 由排版台统一收，再转发进来：避免排版台和琴键页各订阅一次导致重复触发
  q.set('midiHost', '1');
  if (o.range) q.set('range', o.range);
  // 根级 /sources/keys/（public/sources 已复制），独立页和 Vue 嵌入都能命中
  return '/sources/keys/index.html?' + q.toString();
}

/* ================= MIDI 中枢 =================
   排版台作为唯一的 MIDI 订阅者：
   1) 工具栏里能选设备、能看见「已连接 / 未连接 / 正在收消息」
   2) 把收到的音符转发给所有琴键框（webview guest）
   3) 琴键页自己不再订阅，避免同一设备被订阅两次、键闪两下            */
const midi = {
  access: null,
  inputs: [],
  lastMsgAt: 0,
  noteCount: 0,
  err: null,
  ready: false
};

// 从已有的 access 对象重读设备列表（不再申请新的 access）
function midiRefreshInputs() {
  const acc = midi.access;
  if (!acc) return;
  const list = [];
  acc.inputs.forEach(i => list.push({ id: i.id, name: i.name || i.id, state: i.state }));
  // 新接入的设备也要挂上监听
  acc.inputs.forEach(i => { i.onmidimessage = onMidiRaw; });
  midi.inputs = list;
  renderMidiStatus();
}

async function midiScan(force) {
  if (!navigator.requestMIDIAccess) { midi.err = '本版本不支持 Web MIDI'; renderMidiStatus(); return; }
  // 已经有 access 了，直接重读列表即可（Chromium 的 inputs 是活的，插拔设备会自动反映）
  if (midi.access && !force) { midiRefreshInputs(); return; }
  try {
    const acc = await navigator.requestMIDIAccess({ sysex: false });
    midi.access = acc;
    midi.err = null;
    // ⚠️ 这里绝不能再调用 requestMIDIAccess：
    // Chromium 每次申请都会返回新的 access 对象，并对已连接的端口补发 statechange，
    // 若在 statechange 里重新申请 → statechange → 申请 → … 会打成无限循环（实测 3 秒 15 万次），
    // 渲染进程被请求洪水淹没，界面会假死。
    acc.onstatechange = () => { midiRefreshInputs(); };
    midi.ready = true;
    midiRefreshInputs();
  } catch (e) {
    midi.err = (e && e.name ? e.name : 'Error') + ': ' + (e && e.message ? e.message : String(e));
    midi.ready = false;
  }
  renderMidiStatus();
}

// 原始 MIDI 消息进来 → 转给所有琴键框
// 转发用「每帧一批」的方式：一次 executeJavaScript 把这一帧内的所有消息带过去，
// 比一条消息一次往返快得多，快速演奏也不会明显延迟
const midiQueue = [];
let midiFlushScheduled = false;

function onMidiRaw(e) {
  if (!e || !e.data || e.data.length < 2) return;
  const st = e.data[0] & 0xf0, d1 = e.data[1], d2 = e.data.length > 2 ? e.data[2] : 0;
  midi.lastMsgAt = performance.now();
  // 只统计音符（Note On/Off），控制字节不计数
  if (st === 0x90 && d2 > 0) midi.noteCount++;
  midiQueue.push(st, d1, d2);
  if (midiQueue.length > 512) midiQueue.splice(0, midiQueue.length - 512);
  if (!midiFlushScheduled) {
    midiFlushScheduled = true;
    requestAnimationFrame(flushMidi);
  }
  renderMidiStatus();
}

function flushMidi() {
  midiFlushScheduled = false;
  if (!midiQueue.length) return;
  const batch = midiQueue.slice(0);
  midiQueue.length = 0;
  frames.forEach(f => {
    if (f.kind !== 'keys' || !f.iframe) return;
    try {
      f.iframe.contentWindow.postMessage({ type: 'midiBatch', data: batch }, '*');
    } catch (err) {}
  });
}

function renderMidiStatus() {
  const box = $('#midiBox');
  const el = $('#midiStatus');
  if (!box) return;
  let text, cls;
  if (!navigator.requestMIDIAccess) { text = 'MIDI：不支持'; cls = ''; }
  else if (midi.err) { text = 'MIDI：' + midi.err; cls = 'err'; }
  else if (!midi.inputs.length) { text = 'MIDI：未连接'; cls = 'off'; }
  else {
    const fresh = midi.lastMsgAt && (performance.now() - midi.lastMsgAt < 1500);
    text = 'MIDI：已连接' + (fresh ? ' · 演奏中' : '');
    cls = fresh ? 'live' : 'on';
  }
  box.className = 'midi-box' + (cls ? ' ' + cls : '');
  box.title = text + '（点击圆点重新扫描）';
  if (el) el.textContent = text;
}

function initMidiHub() {
  // 圆点就是「重新扫描」按钮
  const dot = $('#midiDot');
  if (dot) {
    dot.addEventListener('click', async () => {
      await midiScan(true);
      toast(midi.inputs.length ? ('已发现 ' + midi.inputs.length + ' 个 MIDI 设备') : '未检测到 MIDI 设备');
    });
  }
  midiScan();
  // 状态指示每秒刷新一次
  setInterval(renderMidiStatus, 700);
}

function openKeyOpts(f) {
  if (document.getElementById('keyOptsModal')) return;
  const o = Object.assign({}, KEY_DEFAULT, f.opts || {});
  const wrap = document.createElement('div');
  wrap.id = 'keyOptsModal';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)';
  wrap.innerHTML =
    '<div style="width:340px;background:#1c2027;color:#e9ecf2;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.5);font-size:13px">' +
      '<div style="font-weight:600;margin:-18px -18px 14px;padding:13px 18px;border-bottom:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.035);border-radius:14px 14px 0 0">琴键显示设置<span style="float:right;font-weight:400;color:#7c8595;font-size:11px">可拖动</span></div>' +
      '<label style="display:block;margin:10px 0 4px;color:#9aa3b2">键盘风格</label>' +
      '<select data-k="style" style="width:100%;padding:6px;border-radius:8px;background:#2a2f38;color:#e9ecf2;border:1px solid rgba(255,255,255,.12)">' +
        '<option value="real">真实象牙</option><option value="flat">简约平面</option><option value="neon">霓虹暗色</option></select>' +
      '<label style="display:block;margin:10px 0 4px;color:#9aa3b2">背景</label>' +
      '<select data-k="bg" style="width:100%;padding:6px;border-radius:8px;background:#2a2f38;color:#e9ecf2;border:1px solid rgba(255,255,255,.12)">' +
        '<option value="dark">深色</option><option value="green">绿幕</option><option value="trans">半透明</option><option value="light">浅色</option></select>' +
      '<label style="display:block;margin:10px 0 4px;color:#9aa3b2">音域（如 36,61 表示 C2 起 61 键；留空=61 键）</label>' +
      '<input data-k="range" placeholder="36,61" style="width:100%;padding:6px;border-radius:8px;background:#2a2f38;color:#e9ecf2;border:1px solid rgba(255,255,255,.12)">' +
      '<label style="display:block;margin:10px 0 4px;color:#9aa3b2">高亮色</label>' +
      '<input data-k="accent" type="color" style="width:100%;height:28px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:none">' +
      '<div style="display:flex;gap:14px;margin-top:14px">' +
        '<label style="display:flex;gap:5px;align-items:center"><input data-k="jianpu" type="checkbox">简谱</label>' +
        '<label style="display:flex;gap:5px;align-items:center"><input data-k="names" type="checkbox">音名</label>' +
        '<label style="display:flex;gap:5px;align-items:center"><input data-k="frame" type="checkbox">琴身</label>' +
        '<label style="display:flex;gap:5px;align-items:center"><input data-k="bar" type="checkbox">上方简谱条</label>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:12px;align-items:center">' +
        '<span style="color:#9aa3b2;white-space:nowrap">光柱颜色</span>' +
        '<select data-k="barMode" style="flex:1;padding:6px;border-radius:8px;background:#2a2f38;color:#e9ecf2;border:1px solid rgba(255,255,255,.12)">' +
          '<option value="random">随机（每键一色）</option><option value="shuffle">随机变色</option><option value="solid">自定义单色</option></select>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:10px;align-items:center">' +
        '<input data-k="barColor" type="color" style="flex:1;height:26px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:none;padding:0">' +
        '<select data-k="barScale" style="width:104px;padding:6px;border-radius:8px;background:#2a2f38;color:#e9ecf2;border:1px solid rgba(255,255,255,.12)">' +
          '<option value="0.20">紧凑</option><option value="0.26">标准</option><option value="0.34">高</option></select>' +
      '</div>' +
      '<div style="display:flex;gap:10px;margin-top:18px">' +
        '<button data-x="cancel" style="flex:1;padding:8px;border-radius:9px;border:1px solid rgba(255,255,255,.14);background:#2a2f38;color:#e9ecf2;cursor:pointer">取消</button>' +
        '<button data-x="ok" style="flex:1;padding:8px;border-radius:9px;border:0;background:#ffb84d;color:#1a1d22;font-weight:600;cursor:pointer">应用</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);
  draggableModal(wrap.firstElementChild, wrap.firstElementChild.firstElementChild);

  wrap.querySelector('[data-k="style"]').value = o.style;
  wrap.querySelector('[data-k="bg"]').value = o.bg;
  wrap.querySelector('[data-k="range"]').value = o.range || '';
  wrap.querySelector('[data-k="accent"]').value = '#' + String(o.accent || 'ffb84d').replace(/^#/, '');
  wrap.querySelector('[data-k="jianpu"]').checked = !!o.jianpu;
  wrap.querySelector('[data-k="names"]').checked = !!o.names;
  wrap.querySelector('[data-k="frame"]').checked = !!o.frame;
  wrap.querySelector('[data-k="bar"]').checked = !!o.bar;
  wrap.querySelector('[data-k="barColor"]').value = '#' + String(o.barColor || o.accent || 'ffb84d').replace(/^#/, '');
  wrap.querySelector('[data-k="barScale"]').value = String(o.barScale || '0.26');
  wrap.querySelector('[data-k="barMode"]').value = o.barMode || 'random';

  const close = () => wrap.remove();
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  wrap.querySelector('[data-x="cancel"]').addEventListener('click', close);
  wrap.querySelector('[data-x="ok"]').addEventListener('click', () => {
    f.opts = {
      style: wrap.querySelector('[data-k="style"]').value,
      bg: wrap.querySelector('[data-k="bg"]').value,
      range: wrap.querySelector('[data-k="range"]').value.trim(),
      accent: wrap.querySelector('[data-k="accent"]').value.replace(/^#/, ''),
      jianpu: wrap.querySelector('[data-k="jianpu"]').checked ? 1 : 0,
      names: wrap.querySelector('[data-k="names"]').checked ? 1 : 0,
      frame: wrap.querySelector('[data-k="frame"]').checked ? 1 : 0,
      bar: wrap.querySelector('[data-k="bar"]').checked ? 1 : 0,
      barColor: wrap.querySelector('[data-k="barColor"]').value.replace(/^#/, ''),
      barScale: wrap.querySelector('[data-k="barScale"]').value,
      barMode: wrap.querySelector('[data-k="barMode"]').value
    };
    const body = f.el.querySelector('.fbody');
    body.innerHTML = '';
    fillBody(f, body);
    persist();
    close();
    toast('琴键设置已应用');
  });
}

/* 网页版用 iframe 内嵌琴键源，尺寸由 CSS .fbody iframe 控制 */

/* ---------- 各类源的内容填充 ---------- */
function fillBody(f, body) {
  try {
    if (f.kind === 'desktop') {
      if (!f.srcId) {
        showErr(body, '原窗口没找到：<b>' + esc(f.srcName || f.name) + '</b><br>' +
          '可能已关闭，或窗口标题变了。点下面重新选一次，选好后自动绑定到这个框。' +
          '<div class="fbtns"><button class="fbtn" data-repick="1">重新选择窗口</button></div>');
        return;
      }
      // 浏览器要求 getDisplayMedia 必须由用户手势触发：
      // 刷新页面恢复布局时不能自动调用，否则必然 NotAllowedError，改成先放一个按钮
      if (f.needGesture) {
        body.innerHTML = '<div class="floading">浏览器需要你点一下才能重新共享屏幕<br>（刷新页面后屏幕共享不会自动恢复）' +
          '<div class="fbtns"><button class="fbtn" data-share="1">开始共享</button></div></div>';
        return;
      }
      acquireDesktop(f, body);
    } else if (f.kind === 'camera') {
      acquireCamera(f, body);
    } else if (f.kind === 'keys') {
      // 网页版用 iframe 替代 webview（webview 是 Electron 专属）
      const fr = document.createElement('iframe');
      fr.setAttribute('src', keysSrc(f));
      fr.style.cssText = 'display:block;width:100%;height:100%;border:none;background:#000';
      body.appendChild(fr);
      f.iframe = fr;
    } else if (f.kind === 'text') {
      renderText(f, body);
    } else if (f.kind === 'image') {
      if (deadFile(f)) { showFileErr(f, body); return; }
      const img = document.createElement('img');
      img.alt = f.name;
      img.src = f.url;
      img.style.objectFit = 'cover';  // 锁定比例，无黑底
      img.onerror = () => showFileErr(f, body);
      body.appendChild(img);
    } else if (f.kind === 'video') {
      if (deadFile(f)) { showFileErr(f, body); return; }
      const v = document.createElement('video');
      v.controls = true; v.playsInline = true;
      v.src = f.url;
      v.style.objectFit = 'contain';    // 正常模式用contain保留黑边，直播时CSS覆盖为cover
      v.onerror = () => showFileErr(f, body);
      body.appendChild(v);
    } else if (f.kind === 'audio') {
      if (deadFile(f)) { showFileErr(f, body); return; }
      const a = document.createElement('audio');
      a.controls = true;
      a.src = f.url;
      a.onerror = () => showFileErr(f, body);
      body.appendChild(a);
    } else if (f.kind === 'file') {
      if (deadFile(f)) { showFileErr(f, body); return; }
      const fr = document.createElement('iframe');
      fr.setAttribute('src', f.url);
      body.appendChild(fr);
    }
  } catch (e) {
    diag('fillBody error: ' + e.message);
    showErr(body, '源加载异常：' + esc(e.message));
  }
}

/* 从上次会话恢复的文件框：blob: URL 早已失效，不必再去请求（否则控制台一片红） */
function deadFile(f) {
  return !!(f.restored && f.url && f.url.indexOf('blob:') === 0);
}

/* 文件源失效：网页版的文件是 blob: URL，页面刷新后就作废了，必须重新选一次 */
function showFileErr(f, body) {
  const isBlob = f.url && f.url.indexOf('blob:') === 0;
  showErr(body, (isBlob
    ? '文件链接已失效（刷新页面后浏览器会收回本地文件访问权）'
    : '文件加载失败：' + esc(f.name)) +
    '<div class="fbtns"><button class="fbtn" data-repick-file="1">重新选择文件</button></div>');
}

/* 重新给这个框绑定一个本地文件（保持框体位置/大小不变） */
async function repickFile(f) {
  let r = null;
  try { r = await window.compositor.openFile(); } catch (e) { toast('打开文件失败：' + (e.message || e)); return; }
  if (!r) return;
  const item = Array.isArray(r) ? r[0] : r;
  if (!item || !item.url) return;
  if (f.url && f.url.indexOf('blob:') === 0) { try { URL.revokeObjectURL(f.url); } catch (e) {} }
  const ext = extOf(item.name);
  let kind = 'file';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].indexOf(ext) >= 0) kind = 'image';
  else if (['mp4', 'mov', 'm4v', 'webm'].indexOf(ext) >= 0) kind = 'video';
  else if (['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg'].indexOf(ext) >= 0) kind = 'audio';
  f.kind = kind;
  f.name = item.name;
  f.url = item.url;
  f.aspect = 0;
  f.keepRatio = false;
  f.restored = false;   // 已经是本次会话新建的 blob URL，不再是失效文件
  const title = f.el.querySelector('.ftitle');
  if (title) title.textContent = item.name;
  const body = f.el.querySelector('.fbody');
  body.innerHTML = '';
  fillBody(f, body);
  if ((kind === 'image' || kind === 'video') && f.url) fitFrameToFile(f, f.url, kind);
  persist();
  toast('已重新绑定：' + item.name);
}

/* 把框体调成指定画面比例（保持中心点不动）。
   框体 = 画面 + 26px 标题栏 + 上下各 1px 边框，所以高度要按「画面高 + 28」算，
   直接拿整框套比例会差出黑边。文件、窗口采集、镜头采集都走这一套。 */
function fitFrameToAspect(f, aspect) {
  if (!aspect || !isFinite(aspect) || aspect <= 0) return;
  const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
  let bw = Math.max(MIN_W - 2, f.w - 2);
  let bh = bw / aspect;
  const maxBodyH = Math.max(MIN_H - 28, canvas.clientHeight - 28);
  if (bh > maxBodyH) { bh = maxBodyH; bw = bh * aspect; }
  f.w = Math.round(bw + 2);
  f.h = Math.round(bh + 28);
  f.aspect = aspect;
  f.keepRatio = true;
  f.x = Math.max(0, Math.min(Math.round(cx - f.w / 2), canvas.clientWidth - f.w));
  f.y = Math.max(0, Math.min(Math.round(cy - f.h / 2), canvas.clientHeight - f.h));
  applyFrameStyle(f);
  persist();
}

/* 读取文件真实画面比例，把框体调成等比尺寸。
   ⚠️ <video> 不会触发 load 事件，必须监听 loadedmetadata；<img> 才是 load。 */
function fitFrameToFile(f, url, kind) {
  const probe = document.createElement(kind === 'video' ? 'video' : 'img');
  if (kind === 'video') probe.preload = 'metadata';
  const onMeta = () => {
    const nw = probe.naturalWidth || probe.videoWidth;
    const nh = probe.naturalHeight || probe.videoHeight;
    if (!nw || !nh) return;
    fitFrameToAspect(f, nw / nh);
  };
  probe.onload = onMeta;
  probe.onloadedmetadata = onMeta;
  probe.onerror = () => diag('probe failed: ' + (f.name || url));
  probe.src = url;
}

/* 采集类源（窗口共享 / 镜头）：视频流一到就按它的真实画面比例把框体调好。
   没有这一步，框体就一直是新建时的默认尺寸，跟实际画面对不上。 */
function followStreamAspect(f, v) {
  const apply = () => {
    if (v.videoWidth && v.videoHeight) fitFrameToAspect(f, v.videoWidth / v.videoHeight);
  };
  if (v.readyState >= 1) apply();
  else v.addEventListener('loadedmetadata', apply, { once: true });
}

function removeFrame(f) {
  try {
    if (f.stream) f.stream.getTracks().forEach(t => t.stop());
    // 网络相机的 MJPEG 靠 <img> 的长连接维持：清空 src 让浏览器断开，
    // 后端收到 close 事件就会杀掉对应的 ffmpeg 进程，不会留下僵尸转流。
    if (f.netImg) { try { f.netImg.src = ''; } catch (e) {} f.netImg = null; }
    // 文件源用的是 blob: URL，删掉框体时一并释放，否则一直占着内存
    if (f.url && f.url.indexOf('blob:') === 0) { try { URL.revokeObjectURL(f.url); } catch (e) {} }
    if (f.el) f.el.remove();
  } catch (e) {}
  const i = frames.indexOf(f);
  if (i >= 0) frames.splice(i, 1);   // 原地删除：不要重新赋值数组（外部持有的引用会失效）
  if (selectedId === f.id) selectedId = null;
  persist();
  updateEmptyHint();
}

/* ================= 交互：选中 / 拖动 / 缩放 / 吸附 ================= */

function selectFrame(id) {
  selectedId = id;
  frames.forEach(o => o.el.classList.toggle('selected', o.id === id));
}

function cursorForDir(dir) {
  const m = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
              ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };
  return m[dir] || 'move';
}

function wireFrame(f, el) {
  // 边缘/角落透明检测层
  el.querySelectorAll('.edge-zone').forEach(ze => {
    const dir = ze.dataset.zone;
    ze.addEventListener('pointerdown', e => {
      if (f.locked) return;
      selectFrame(f.id);
      e.preventDefault();
      e.stopPropagation();
      startDrag(e, f, 'resize', dir);
    });
    ze.addEventListener('pointermove', e => {
      if (f.locked) return;
      el.style.cursor = cursorForDir(dir);
    });
    ze.addEventListener('pointerleave', () => { el.style.cursor = ''; });
  });

  // 中间区域 → move（四向箭头）光标
  el.addEventListener('pointerdown', e => {
    if (f.locked) return;
    if (e.target.closest('.facts, button, input, select, .edge-zone')) return;
    selectFrame(f.id);
    e.preventDefault();
    startDrag(e, f, 'move', '');
  });

  el.addEventListener('pointermove', e => {
    if (f.locked) { el.style.cursor = 'default'; return; }
    if (!e.target.closest('.edge-zone')) el.style.cursor = 'move';
  });

  // fbody 区域内的移动也更新光标（iframe/video 会吞 frame 级 pointermove）
  const fbody = el.querySelector('.fbody');
  if (fbody) {
    fbody.addEventListener('pointermove', () => {
      if (f.locked) return;
      el.style.cursor = 'move';
    });
  }
  el.addEventListener('pointerup', () => { el.style.cursor = ''; });
  el.addEventListener('pointercancel', () => { el.style.cursor = ''; });
  el.addEventListener('pointerleave', () => { el.style.cursor = ''; });

  const kbtn = el.querySelector('[data-act="kopts"]');
  if (kbtn) kbtn.addEventListener('click', () => openKeyOpts(f));
  const tbtn = el.querySelector('[data-act="topts"]');
  if (tbtn) tbtn.addEventListener('click', () => openTextOpts(f));

  el.querySelector('[data-act="front"]').addEventListener('click', () => {
    f.z = ++zTop;
    f.el.style.zIndex = f.z;
    persist();
  });
  const maxbtn = el.querySelector('[data-act="max"]');
  if (maxbtn) maxbtn.addEventListener('click', () => {
    if (f.maximized) {
      // 还原到铺满前的尺寸
      f.x = f.prev && f.prev.x != null ? f.prev.x : 60;
      f.y = f.prev && f.prev.y != null ? f.prev.y : 60;
      f.w = f.prev && f.prev.w ? f.prev.w : 640;
      f.h = f.prev && f.prev.h ? f.prev.h : 360;
      delete f.maximized; delete f.prev;
      maxbtn.textContent = '铺满';
    } else {
      f.prev = { x: f.x, y: f.y, w: f.w, h: f.h };
      f.maximized = true;
      fitFrameToCanvas(f);
      maxbtn.textContent = '还原';
    }
    applyFrameStyle(f);
    persist();
  });
  el.querySelector('[data-act="lock"]').addEventListener('click', () => {
    f.locked = !f.locked;
    el.classList.toggle('locked', f.locked);
    el.querySelector('[data-act="lock"]').classList.toggle('on', f.locked);
    persist();
  });
  el.querySelector('[data-act="close"]').addEventListener('click', () => removeFrame(f));
}

function startDrag(e, f, mode, dir) {
  e.preventDefault();
  const startX = e.clientX, startY = e.clientY;
  const o = { x: f.x, y: f.y, w: f.w, h: f.h };
  // 用 setPointerCapture 绑定到 frame 元素，彻底解决卡顿问题
  try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
  e.target.addEventListener('pointermove', onMove);
  e.target.addEventListener('pointerup', onUp);
  e.target.addEventListener('pointercancel', onUp);

  function onMove(ev) {
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    if (mode === 'move') {
      let nx = o.x + dx, ny = o.y + dy;
      if (snapEnabled) {
        const s = snapMove(nx, ny, f);
        nx = s.x; ny = s.y;
        showGuides(s.guides);
      }
      f.x = nx; f.y = ny;
      f.el.style.left = f.x + 'px';
      f.el.style.top = f.y + 'px';
    } else {
      let nx = o.x, ny = o.y, nw = o.w, nh = o.h;
      if (dir.indexOf('e') >= 0) nw = o.w + dx;
      if (dir.indexOf('s') >= 0) nh = o.h + dy;
      if (dir.indexOf('w') >= 0) { nw = o.w - dx; nx = o.x + (o.w - nw); }
      if (dir.indexOf('n') >= 0) { nh = o.h - dy; ny = o.y + (o.h - nh); }
      if (nw < MIN_W) { if (dir.indexOf('w') >= 0) nx -= (MIN_W - nw); nw = MIN_W; }
      if (nh < MIN_H) { if (dir.indexOf('n') >= 0) ny -= (MIN_H - nh); nh = MIN_H; }

      // 文件/图片/视频等比缩放：锁定的是「画面」比例，不是整个框体
      // （框体还含 26px 标题栏 + 上下各 1px 边框，直接套比例会差出黑边）
      if (f.keepRatio && f.aspect > 0) {
        const ratio = f.aspect;
        if (dir.indexOf('e') >= 0 || dir.indexOf('w') >= 0) {
          // 水平拖动：画面高跟画面宽等比
          nh = Math.round((nw - 2) / ratio + 28);
          if (nh < MIN_H) { nh = MIN_H; nw = Math.round((nh - 28) * ratio + 2); if (dir.indexOf('w') >= 0) nx = o.x + (o.w - nw); }
        } else {
          // 垂直拖动：画面宽跟画面高等比
          nw = Math.round((nh - 28) * ratio + 2);
          if (nw < MIN_W) { nw = MIN_W; nh = Math.round((nw - 2) / ratio + 28); if (dir.indexOf('n') >= 0) ny = o.y + (o.h - nh); }
        }
      }

      if (snapEnabled) {
        const s = snapResize(nx, ny, nw, nh, f, dir);
        nx = s.x; ny = s.y; nw = s.w; nh = s.h;
        showGuides(s.guides);
      }
      if (f.kind === 'text') {
        // 文字框只等比缩放：字号随框宽缩放，避免文字被拉扁
        const useW = dir.indexOf('e') >= 0 || dir.indexOf('w') >= 0;
        const s2 = Math.max(0.08, useW ? (nw / o.w) : (nh / o.h));
        nw = Math.max(MIN_W, o.w * s2);
        nh = Math.max(MIN_H, o.h * s2);
        if (dir.indexOf('w') >= 0) nx = o.x + (o.w - nw);
        if (dir.indexOf('n') >= 0) ny = o.y + (o.h - nh);
      }
      f.x = nx; f.y = ny; f.w = nw; f.h = nh;
      f.el.style.left = f.x + 'px';
      f.el.style.top = f.y + 'px';
      f.el.style.width = f.w + 'px';
      f.el.style.height = f.h + 'px';
      if (f.kind === 'text') applyTextStyle(f, false);   // 拖拽中不重新适配框体
    }
  }
  function onUp() {
    try { e.target.releasePointerCapture(e.pointerId); } catch (_) {}
    e.target.removeEventListener('pointermove', onMove);
    e.target.removeEventListener('pointerup', onUp);
    e.target.removeEventListener('pointercancel', onUp);
    clearGuides();
    persist();
  }
}

/* ---- 吸附计算 ---- */
function targets(excludeId) {
  const t = {
    v: [0, canvas.clientWidth / 2, canvas.clientWidth],
    h: [0, canvas.clientHeight / 2, canvas.clientHeight]
  };
  frames.forEach(o => {
    if (o.id === excludeId) return;
    t.v.push(o.x, o.x + o.w / 2, o.x + o.w);
    t.h.push(o.y, o.y + o.h / 2, o.y + o.h);
  });
  return t;
}
function nearest(val, arr) {
  let best = null, bd = SNAP_PX;
  arr.forEach(v => {
    const d = Math.abs(v - val);
    if (d < bd) { bd = d; best = v; }
  });
  return best;
}
function snapMove(x, y, f) {
  const t = targets(f.id);
  const guides = [];
  let nx = x, ny = y;
  const candX = [
    { val: x, apply: v => v },
    { val: x + f.w / 2, apply: v => v - f.w / 2 },
    { val: x + f.w, apply: v => v - f.w }
  ];
  let bestX = null;
  candX.forEach(c => {
    const tv = nearest(c.val, t.v);
    if (tv !== null && (bestX === null || Math.abs(tv - c.val) < Math.abs(bestX.tv - bestX.c.val))) bestX = { c: c, tv: tv };
  });
  if (bestX) { nx = bestX.c.apply(bestX.tv); guides.push({ axis: 'v', at: bestX.tv }); }
  const candY = [
    { val: y, apply: v => v },
    { val: y + f.h / 2, apply: v => v - f.h / 2 },
    { val: y + f.h, apply: v => v - f.h }
  ];
  let bestY = null;
  candY.forEach(c => {
    const tv = nearest(c.val, t.h);
    if (tv !== null && (bestY === null || Math.abs(tv - c.val) < Math.abs(bestY.tv - bestY.c.val))) bestY = { c: c, tv: tv };
  });
  if (bestY) { ny = bestY.c.apply(bestY.tv); guides.push({ axis: 'h', at: bestY.tv }); }
  return { x: nx, y: ny, guides: guides };
}
function snapResize(x, y, w, h, f, dir) {
  const t = targets(f.id);
  const guides = [];
  let nx = x, ny = y, nw = w, nh = h;
  if (dir.indexOf('w') >= 0) {
    const v = nearest(x, t.v);
    if (v !== null) { guides.push({ axis: 'v', at: v }); nx = v; nw = x + w - v; }
  }
  if (dir.indexOf('e') >= 0) {
    const v = nearest(x + w, t.v);
    if (v !== null) { guides.push({ axis: 'v', at: v }); nw = v - x; }
  }
  if (dir.indexOf('n') >= 0) {
    const v = nearest(y, t.h);
    if (v !== null) { guides.push({ axis: 'h', at: v }); ny = v; nh = y + h - v; }
  }
  if (dir.indexOf('s') >= 0) {
    const v = nearest(y + h, t.h);
    if (v !== null) { guides.push({ axis: 'h', at: v }); nh = v - y; }
  }
  return { x: nx, y: ny, w: Math.max(MIN_W, nw), h: Math.max(MIN_H, nh), guides: guides };
}
function showGuides(guides) {
  clearGuides();
  guides.forEach(g => {
    const d = document.createElement('div');
    d.className = g.axis === 'v' ? 'guide-v' : 'guide-h';
    if (g.axis === 'v') d.style.left = g.at + 'px'; else d.style.top = g.at + 'px';
    guidesBox.appendChild(d);
  });
}
function clearGuides() { guidesBox.innerHTML = ''; }

/* ---- 错误框内的按钮（事件委托） ---- */
document.addEventListener('click', e => {
  const retry = e.target.closest('[data-retry]');
  if (retry) {
    const frameEl = retry.closest('.frame');
    const f = frames.find(o => o.el === frameEl);
    if (f) {
      const body = frameEl.querySelector('.fbody');
      if (f.kind === 'desktop') acquireDesktop(f, body);
      else if (f.kind === 'camera') acquireCamera(f, body);
    }
    return;
  }
  const rp = e.target.closest('[data-repick]');
  if (rp) {
    const frameEl = rp.closest('.frame');
    const f = frames.find(o => o.el === frameEl);
    if (f) openRepick(f);
    return;
  }
  // 刷新后恢复的屏幕共享：点一下才真正去申请（getDisplayMedia 必须由用户手势触发）
  if (e.target.closest('[data-share]')) {
    const frameEl = e.target.closest('.frame');
    const f = frames.find(o => o.el === frameEl);
    if (f) {
      f.needGesture = false;
      acquireDesktop(f, frameEl.querySelector('.fbody'));
    }
    return;
  }
  // 文件源失效（blob: 刷新后作废）→ 重新选一个文件绑到同一个框
  if (e.target.closest('[data-repick-file]')) {
    const frameEl = e.target.closest('.frame');
    const f = frames.find(o => o.el === frameEl);
    if (f) repickFile(f);
    return;
  }
  if (e.target.closest('[data-relaunch]')) {
    try { window.compositor.relaunch(); } catch (err) { diag('relaunch failed: ' + err.message); }
  }
});

/* ================= 持久化 ================= */
function persist() {
  try {
    const data = frames.map(f => ({
      kind: f.kind, name: f.name, srcId: f.srcId, deviceId: f.deviceId,
      netUrl: f.netUrl || '',
      srcName: f.srcName || '', srcApp: f.srcApp || '', isScreen: !!f.isScreen, displayId: f.displayId || '',
      url: f.url, x: f.x, y: f.y, w: f.w, h: f.h, z: f.z, baseW: f.baseW || 0,
      locked: !!f.locked,
      keepRatio: f.keepRatio || false,
      aspect: f.aspect || 0,
      opts: f.opts || null
    }));
    localStorage.setItem('compositor.layout', JSON.stringify(data));
  } catch (e) { diag('persist failed: ' + e.message); }
}
function updateEmptyHint() {
  emptyHint.style.display = frames.length ? 'none' : 'flex';
}
/* ---- 窗口源自动重连：系统源 id 每次启动都会变，靠「窗口标题 + 应用名」模糊匹配找回 ---- */
function normTitle(v) { return String(v == null ? '' : v).replace(/\s+/g, '').toLowerCase(); }

function matchSource(sources, d) {
  if (!sources || !sources.length) return null;
  if (d.isScreen || String(d.srcId || '').indexOf('screen:') === 0) {
    const same = sources.filter(s => s.isScreen && d.displayId && s.displayId === d.displayId);
    if (same.length) return same[0];
    const screens = sources.filter(s => s.isScreen);
    return screens.length ? screens[0] : null;
  }
  const wins = sources.filter(s => !s.isScreen);
  // 网页版只有「共享屏幕/窗口」这一项（type=webShare），没有按标题匹配的可能，
  // 直接复用它，避免刷新后把窗口源误判成「窗口没找到」
  const share = sources.filter(s => s.type === 'webShare')[0];
  const wantName = normTitle(d.srcName || String(d.name || '').replace(/^窗口 · /, ''));
  const wantApp = normTitle(d.srcApp);
  let best = null, bestScore = 0;
  wins.forEach(s => {
    let sc = 0;
    const n = normTitle(s.name), a = normTitle(s.appName);
    if (wantName && n === wantName) sc += 4;
    else if (wantName && Math.min(n.length, wantName.length) >= 3 &&
             (n.indexOf(wantName) >= 0 || wantName.indexOf(n) >= 0)) sc += 2;
    if (wantApp && a === wantApp) sc += 3;
    else if (wantApp && a && (a.indexOf(wantApp) >= 0 || wantApp.indexOf(a) >= 0)) sc += 1;
    if (sc > bestScore) { bestScore = sc; best = s; }
  });
  if (bestScore >= 2) return best;
  return share || null;
}

async function restore() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem('compositor.layout') || 'null'); } catch (e) {}
  if (!data || !data.length) return;

  // 只有存在窗口/屏幕源时才去枚举（枚举会唤起系统权限）
  let sources = null;
  if (data.some(d => d.kind === 'desktop')) {
    try {
      sources = await window.compositor.listSources();
      diag('restore: sources=' + (sources ? sources.length : 'null'));
    } catch (e) {
      diag('restore listSources failed: ' + (e.message || e));
    }
  }

  let reconnected = 0, lost = 0;
  data.forEach(d => {
    if (d.kind === 'desktop') {
      const hit = matchSource(sources, d);
      if (hit) {
        d.srcId = hit.id;
        d.srcName = hit.name;
        d.srcApp = hit.appName;
        d.isScreen = hit.isScreen;
        d.displayId = hit.displayId || '';
        reconnected++;
      } else {
        d.srcId = null;
        lost++;
      }
      // 恢复的屏幕共享不能自动申请（需要用户手势），先占位等点击
      d.needGesture = true;
    }
    // 标记「来自上次会话」：本地文件（blob:）此时一定失效，直接给重新选择的入口
    d.restored = true;
    const f = addFrame(d);
    if (!f) return;
    if (f.locked) { f.el.classList.add('locked'); const b = f.el.querySelector('[data-act="lock"]'); if (b) b.classList.add('on'); }
  });
  selectedId = null;
  frames.forEach(o => o.el.classList.remove('selected'));
  // 画布现在锁死 16:9，尺寸可能和上次保存时不一样 → 整体等比缩放进画布
  fitFramesIntoCanvas();

  if (reconnected) { persist(); toast('已恢复 ' + reconnected + ' 个屏幕源，点框里的「开始共享」重新接上'); }
  if (lost) toast(lost + ' 个屏幕源没找到，点框里的「重新选择窗口」');
}

/* ================= 窗口/屏幕选择弹窗 ================= */
const srcModal = $('#srcModal');
const srcList = $('#srcList');

async function loadSources() {
  srcList.innerHTML = '<div class="src-empty">读取中…</div>';
  let sources = [];
  try {
    sources = await window.compositor.listSources();
  } catch (e) {
    diag('listSources failed: ' + (e.message || e));
    srcList.innerHTML = '<div class="src-empty">读取失败：' + esc(e.message || e) + '</div>';
    return;
  }
  if (!sources.length) {
    srcList.innerHTML = '<div class="src-empty">没有可采集的窗口。<br><br>请确认目标窗口已打开且未最小化，然后点「重新扫描」<br><br><button class="fbtn" data-relaunch="1">重新扫描</button></div>';
    return;
  }
  srcList.innerHTML = '';
  sources.forEach(s => {
    const item = document.createElement('div');
    item.className = 'src-item';
    item.innerHTML =
      (s.thumbnail ? '<img src="' + s.thumbnail + '" alt="">' : '<div style="height:128px;background:#000"></div>') +
      '<div class="src-name">' + esc(s.name) + (s.appName ? ' <span class="app">· ' + esc(s.appName) + '</span>' : '') + '</div>';
    item.addEventListener('click', () => {
      srcModal.classList.add('hidden');
      // 网页版只有「共享屏幕/窗口」这一项，标题不用再叠「屏幕 · 」前缀
      const label = s.type === 'webShare' ? '屏幕共享' : ((s.isScreen ? '屏幕 · ' : '窗口 · ') + s.name);
      // 从「原窗口没找到」重绑过来：替换原框的源，不再新建
      if (repickTarget) {
        const f = repickTarget; repickTarget = null;
        f.srcId = s.id; f.srcName = s.name; f.srcApp = s.appName || '';
        f.isScreen = s.isScreen; f.displayId = s.displayId || ''; f.name = label;
        const t = f.el.querySelector('.ftitle'); if (t) t.textContent = label;
        const body = f.el.querySelector('.fbody'); body.innerHTML = '';
        acquireDesktop(f, body);
        persist();
        toast('已重新绑定：' + s.name);
        return;
      }
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      const w = Math.min(900, Math.round(cw * 0.62)), h = Math.round(w * 9 / 16);
      addFrame({
        kind: 'desktop',
        srcId: s.id,
        srcName: s.name,
        srcApp: s.appName || '',
        isScreen: s.isScreen,
        displayId: s.displayId || '',
        name: label,
        x: Math.round((cw - w) / 2), y: Math.round((ch - h) / 2),
        w: w, h: h
      });
    });
    srcList.appendChild(item);
  });
}
let repickTarget = null;
function openRepick(f) {
  repickTarget = f;
  srcModal.classList.remove('hidden');
  loadSources();
  toast('请选择要绑定到该框的窗口');
}
$('#addWindow').addEventListener('click', async () => {
  repickTarget = null;
  srcModal.classList.remove('hidden');
  await loadSources();
});
$('#srcRefresh').addEventListener('click', loadSources);
$('#srcClose').addEventListener('click', () => srcModal.classList.add('hidden'));
srcModal.addEventListener('click', e => { if (e.target === srcModal) srcModal.classList.add('hidden'); });

/* ================= 分享屏幕（已移除）================= */
// 网页版不再提供独立分享屏幕按钮，用户通过「窗口」按钮选择屏幕区域

/* ================= 镜头选择 ================= */
// 两块内容：
//   ① 本机镜头 —— getUserMedia 能直接拿到的（内置 / USB / iPhone 连续互通）
//   ② 网络互联相机 —— 局域网 IP 相机，走 RTSP，由后端 ffmpeg 转 MJPEG 播放
const camModal = $('#camModal');
const camList = $('#camList');
const camNetList = $('#camNetList');
const camScanHint = $('#camScanHint');
const camUrlMsg = $('#camUrlMsg');

// 生产环境 composer 与后端同源；vite 开发（5173）时指向 3000
const CAM_API = (location.port === '5173' ? 'http://localhost:3000' : '') + '/api/camera';

/** 从设备名猜类型，给用户一个直观标签 */
function camKindOf(label) {
  const s = String(label || '');
  if (/iphone|ipad|连续互通|continuity/i.test(s)) return { ico: '📱', sub: 'iPhone 连续互通相机' };
  if (/usb|外接|external|webcam/i.test(s)) return { ico: '🔌', sub: 'USB 外接镜头' };
  if (/built.?in|内置|facetime/i.test(s)) return { ico: '💻', sub: '内置镜头' };
  return { ico: '🎥', sub: '本机视频设备' };
}

function addCameraFrame(deviceId, name) {
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  const w = 320, h = 240;   // 先给个 4:3 的位，流一到就按真实画面比例自动调
  addFrame({
    kind: 'camera',
    deviceId: deviceId,
    name: '镜头 · ' + name,
    x: cw - w - 24, y: ch - h - 24,
    w: w, h: h
  });
}

function addNetCameraFrame(url, name) {
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  const w = 400, h = 225;
  addFrame({
    kind: 'camera',
    netUrl: url,
    name: '网络相机 · ' + (name || url),
    x: cw - w - 24, y: ch - h - 24,
    w: w, h: h
  });
}

/* ---- ① 本机镜头列表 ---- */
async function loadLocalCams() {
  camList.innerHTML = '<div class="src-empty">正在读取镜头…</div>';
  // 预热：先申请一次镜头，否则系统未授权时 enumerateDevices 拿不到设备名称
  let warm = null;
  try {
    warm = await navigator.mediaDevices.getUserMedia({ video: true });
  } catch (e) {
    diag('camera warmup failed: ' + (e.name || '') + ' ' + (e.message || ''));
    camList.innerHTML = '<div class="src-empty">无法访问镜头：' + esc(e.message || e.name) +
      '<br><br>请检查 系统设置 → 隐私与安全性 → 摄像头 权限（或镜头是否被其他应用占用）<br><br>' +
      '<button class="fbtn" id="camRetry">重试</button></div>';
    const btn = $('#camRetry');
    if (btn) btn.addEventListener('click', loadLocalCams);
    return;
  }
  let cams = [];
  try {
    cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
  } catch (e) {
    diag('enumerateDevices failed: ' + (e.message || e));
  }
  if (warm) { try { warm.getTracks().forEach(t => t.stop()); } catch (e) {} }
  if (!cams.length) {
    camList.innerHTML = '<div class="src-empty">没有检测到本机镜头<br><br>' +
      '用 iPhone 当摄像头（连续互通相机）：手机<b>锁屏</b>、立起来静止放好、靠近电脑，' +
      '蓝牙和 Wi-Fi 都开着、与电脑登录同一个 Apple ID，几秒后这里会出现「iPhone 的摄像头」</div>';
    return;
  }
  camList.innerHTML = '';
  cams.forEach((d, i) => {
    const name = d.label || ('镜头 ' + (i + 1));
    const k = camKindOf(d.label);
    const item = document.createElement('div');
    item.className = 'src-item';
    item.innerHTML =
      '<span class="cam-ico">' + k.ico + '</span>' +
      '<div class="cam-meta">' +
        '<div class="cam-name">' + esc(name) +
          (ui.camDeviceId === d.deviceId ? ' <span class="app">· 上次使用</span>' : '') + '</div>' +
        '<div class="cam-sub">' + esc(k.sub) + '</div>' +
      '</div>';
    item.addEventListener('click', () => {
      camModal.classList.add('hidden');
      ui.camDeviceId = d.deviceId;
      saveUI();
      diag('camera selected: ' + name + ' (' + d.deviceId + ')');
      addCameraFrame(d.deviceId, name);
    });
    camList.appendChild(item);
  });
}

/* ---- ② 网络相机：搜索 / 测试 / 添加 ---- */

// 常见厂商的默认 RTSP 路径：多数 IP 相机只要知道品牌就能拼出可用地址
const CAM_PRESETS = [
    { label: '海康', path: '/Streaming/Channels/101' },
    { label: '大华', path: '/cam/realmonitor?channel=1&subtype=0' },
    { label: 'TP-Link', path: '/stream1' },
    { label: '小米', path: '/live/ch0' },
    { label: 'Axis', path: '/axis-media/media.amp' }
];

function renderPresets() {
  const box = $('#camPresets');
  if (!box) return;
  box.innerHTML = '<span class="cam-hint">常用路径：</span>';
  CAM_PRESETS.forEach(p => {
    const b = document.createElement('button');
    b.className = 'cam-chip';
    b.textContent = p.label;
    b.title = '填入 rtsp://admin:密码@相机IP:554' + p.path;
    b.addEventListener('click', () => {
      const cur = camUrl.value.trim();
      // 已经填了 IP 就只替换路径部分，否则给一个模板
      const m = cur.match(/^(rtsps?:\/\/[^/]*)/i);
      camUrl.value = m ? m[1] + p.path : 'rtsp://admin:密码@相机IP:554' + p.path;
      camUrl.focus();
      netMsg('已填入「' + p.label + '」常见路径，请把 IP / 账号密码 换成你自己的', '');
    });
    box.appendChild(b);
  });
}

function netMsg(text, cls) {
  camUrlMsg.textContent = text || '';
  camUrlMsg.className = 'cam-msg' + (cls ? ' ' + cls : '');
}

function renderNetList(items) {
  if (!items.length) {
    camNetList.innerHTML = '<div class="src-empty">局域网里没找到相机<br><br>' +
      '常见原因：相机没连同一个 Wi-Fi、开了「禁止局域网发现」、或走的是云平台（需在 App 里打开 RTSP）</div>';
    return;
  }
  camNetList.innerHTML = '';
  items.forEach(it => {
    const item = document.createElement('div');
    item.className = 'src-item';
    const url = it.rtsp || '';
    item.innerHTML =
      '<span class="cam-ico">🌐</span>' +
      '<div class="cam-meta">' +
        '<div class="cam-name">' + esc(it.brand || '相机') + ' · ' + esc(it.ip) + '</div>' +
        '<div class="cam-sub">' + esc(it.note || '') + '</div>' +
      '</div>';
    item.addEventListener('click', () => {
      // 只开了端口的主机没有完整 RTSP 地址，把它填进输入框让用户补全
      if (!url || url.endsWith(':554/')) {
        camUrl.value = url || ('rtsp://' + it.ip + ':554/');
        netMsg('这个地址还不完整，请补上路径和账号，例如 rtsp://admin:密码@' + it.ip + ':554/stream1', 'err');
        camUrl.focus();
        return;
      }
      camModal.classList.add('hidden');
      addNetCameraFrame(url, it.brand + ' ' + it.ip);
    });
    camNetList.appendChild(item);
  });
}

let scanning = false;
async function scanNetworkCams() {
  if (scanning) return;
  scanning = true;
  const btn = $('#camScan');
  btn.disabled = true;
  camScanHint.textContent = '正在搜索…（约 3 秒）';
  camNetList.innerHTML = '<div class="src-empty">正在用 ONVIF 组播 + RTSP 端口探测扫描局域网…</div>';
  try {
    const r = await fetch(CAM_API + '/discover', { cache: 'no-store' });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || '搜索失败');
    renderNetList(j.items || []);
    camScanHint.textContent = j.count
      ? '找到 ' + j.count + ' 个设备 · 用时 ' + (j.elapsed / 1000).toFixed(1) + 's'
      : '未发现设备 · 用时 ' + (j.elapsed / 1000).toFixed(1) + 's';
  } catch (e) {
    camNetList.innerHTML = '<div class="src-empty">搜索失败：' + esc(e.message) +
      '<br><br>请确认后端服务已启动（端口 3000）</div>';
    camScanHint.textContent = '';
  } finally {
    scanning = false;
    btn.disabled = false;
  }
}

async function testCamUrl() {
  const url = camUrl.value.trim();
  if (!url) { netMsg('先填一个 rtsp:// 地址', 'err'); return; }
  netMsg('正在连接相机…', '');
  const btn = $('#camTest');
  btn.disabled = true;
  try {
    const r = await fetch(CAM_API + '/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const j = await r.json();
    if (j.ok) netMsg('连接成功 · ' + (j.label || '画面可用'), 'ok');
    else netMsg('连接失败：' + (j.err || '未知原因'), 'err');
  } catch (e) {
    netMsg('请求失败：' + e.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

async function addCamUrl() {
  const url = camUrl.value.trim();
  if (!url) { netMsg('先填一个 rtsp:// 地址', 'err'); return; }
  // 先探一次，避免把一个连不通的地址放进画布，用户只能看到一个黑框
  netMsg('正在验证地址…', '');
  const btn = $('#camAddUrl');
  btn.disabled = true;
  try {
    const r = await fetch(CAM_API + '/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const j = await r.json();
    if (!j.ok) { netMsg('连接失败：' + (j.err || '未知原因'), 'err'); return; }
    camModal.classList.add('hidden');
    netMsg('');
    addNetCameraFrame(url, j.label || url);
  } catch (e) {
    netMsg('请求失败：' + e.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

function openCamModal() {
  camModal.classList.remove('hidden');
  netMsg('');
  renderPresets();
  loadLocalCams();
}

$('#addCamera').addEventListener('click', openCamModal);
$('#camRefresh').addEventListener('click', () => { loadLocalCams(); camNetList.innerHTML =
  '<div class="src-empty">点「搜索局域网相机」自动查找，或在下方手动填地址</div>'; camScanHint.textContent = ''; });
$('#camScan').addEventListener('click', scanNetworkCams);
$('#camTest').addEventListener('click', testCamUrl);
$('#camAddUrl').addEventListener('click', addCamUrl);
$('#camUrl').addEventListener('keydown', e => { if (e.key === 'Enter') addCamUrl(); });
$('#camClose').addEventListener('click', () => camModal.classList.add('hidden'));
camModal.addEventListener('click', e => { if (e.target === camModal) camModal.classList.add('hidden'); });

/* ================= 琴键源 ================= */
$('#addKeys').addEventListener('click', () => {
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  const w = Math.round(cw * 0.8), h = Math.min(420, Math.round(ch * 0.55));
  addFrame({
    kind: 'keys',
    name: '琴键可视化（Web MIDI）',
    x: Math.round((cw - w) / 2), y: Math.round((ch - h) / 2),
    w: w, h: h
  });
});

/* ================= 文字源 ================= */
$('#addText').addEventListener('click', () => {
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  // 默认小字号，框体跟随内容；用户双击可编辑文字
  const f = addFrame({
    kind: 'text', name: '文字',
    x: Math.round((cw - 360) / 2), y: Math.round((ch - 72) / 2),
    w: 360, h: 72,
    opts: { text: '双击编辑文字', font: 'pingfang', size: 32, color: '#ffffff', weight: 600,
            align: 'center', lineHeight: 1.4, stroke: 0, strokeColor: '#000000',
            bg: 'none', bgColor: '#000000', bgOpacity: 0.55,
            shadow: 0, shadowColor: '#000000', shadowBlur: 3, shadowX: 1, shadowY: 1 }
  });
  if (f) setTimeout(() => { const d = f.el.querySelector('.ctext'); if (d) startEditText(f, d); }, 80);
});

/* ================= 隐藏模式 ================= */
function isHide() { return document.body.classList.contains('hide-ui'); }
/* 隐藏模式退出提示：工具栏藏起来后总得有条明路，鼠标移到窗口顶部就浮出来 */
let hideHintTimer = null;
function showHideHint(ms) {
  const el = $('#liveHint');
  if (!el) return;
  el.classList.add('show');
  clearTimeout(hideHintTimer);
  hideHintTimer = setTimeout(() => el.classList.remove('show'), ms || 2600);
}
function hideHideHint() {
  const el = $('#liveHint');
  if (!el) return;
  clearTimeout(hideHintTimer);
  el.classList.remove('show');
}

let hideSilent = false;   // 父页面（推流）触发的隐藏：连鼠标移顶都不弹提示，避免提示进入画面
function setHide(on, silent) {
  on = !!on;
  document.body.classList.toggle('hide-ui', on);
  $('#optLive').classList.toggle('on', on);
  ui.hide = on; saveUI();
  hideSilent = !!silent && on;
  // silent（由父页面推流触发）时连提示条都不弹，否则提示会出现在学员画面里
  if (on) { if (!silent) showHideHint(3000); } else hideHideHint();
  if (!silent) toast(on ? '已隐藏（点工具栏「隐藏」恢复）' : '已显示');
  // 把当前隐藏状态回报给父页面，让工具条的「隐藏」按钮颜色保持同步
  reportHideState(on);
}
function reportHideState(on) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'HIDE_STATE', on: !!on }, '*');
    }
  } catch (_) {}
}
$('#liveExit').addEventListener('click', () => setHide(false));
window.addEventListener('mousemove', e => {
  if (!isHide() || hideSilent) return;
  if (e.clientY < 96) showHideHint(2400);   // 只在鼠标靠顶部时才浮出来，平时不抢镜
});
$('#optLive').addEventListener('click', () => setHide(!isHide()));

/* ================= 文件源（原生对话框 + 按类型渲染） ================= */
$('#addFile').addEventListener('click', async () => {
  let r = null;
  try {
    r = await window.compositor.openFile();
  } catch (e) {
    diag('openFile failed: ' + (e.message || e));
    toast('打开文件对话框失败：' + (e.message || e));
    return;
  }
  if (!r) return;
  const item = Array.isArray(r) ? r[0] : r;
  if (!item || !item.name) return;
  const ext = extOf(item.name);
  let kind = 'file';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].indexOf(ext) >= 0) kind = 'image';
  else if (['mp4', 'mov', 'm4v', 'webm'].indexOf(ext) >= 0) kind = 'video';
  else if (['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg'].indexOf(ext) >= 0) kind = 'audio';
  const url = item.url || fileUrl(item.path || item.name);
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  // 音频固定 420x120；图片/视频先按画布放，等拿到真实画面尺寸再调成等比
  const fw = kind === 'audio' ? 420 : Math.min(760, Math.round(cw * 0.55));
  const fh = kind === 'audio' ? 120 : Math.min(520, Math.round(ch * 0.7));
  const f = addFrame({ kind: kind, name: item.name, url: url,
    x: Math.round((cw - fw) / 2), y: Math.round((ch - fh) / 2), w: fw, h: fh });
  if (f) {
    // 先不锁比例：等拿到真实画面比例再锁，避免中途按 1:1 拖动
    f.aspect = 0; f.keepRatio = false;
    if ((kind === 'image' || kind === 'video') && url) fitFrameToFile(f, url, kind);
  }
});

/* ================= 清空 ================= */
function clearAll(persistAfter) {
  frames.slice().forEach(f => removeFrame(f));
  if (persistAfter !== false) persist();
  updateEmptyHint();
}
$('#clearAll').addEventListener('click', () => clearAll());

/* ================= 画布：固定 16:9 ================= */
// 画布始终是 16:9 比例，填满可用空间（无黑边）
function layoutCanvas() {
  const stage = document.getElementById('stage');
  if (!stage) return;
  canvas.style.width = stage.clientWidth + 'px';
  canvas.style.height = stage.clientHeight + 'px';
}

// 画布尺寸变化后把框体收回（并等比缩放）
function clampFramesToCanvas() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W || !H || !frames.length) return;
  // 首次运行（还没有基准尺寸）只记录，不缩放
  if (!_lastCanvasW || !_lastCanvasH) { _lastCanvasW = W; _lastCanvasH = H; return; }
  const sx = W / _lastCanvasW, sy = H / _lastCanvasH;
  const needScale = (Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01);
  if (needScale) {
    frames.forEach(f => {
      const nw = Math.max(MIN_W, Math.round(f.w * sx));
      const nh = Math.max(MIN_H, Math.round(f.h * sy));
      const nx = Math.max(0, Math.min(Math.round(f.x * sx), W - nw));
      const ny = Math.max(0, Math.min(Math.round(f.y * sy), H - nh));
      f.w = nw; f.h = nh; f.x = nx; f.y = ny;
      applyFrameStyle(f);
      if (f.kind === 'text') applyTextStyle(f, false);
    });
    persist();
  }
  _lastCanvasW = W; _lastCanvasH = H;
}
let _lastCanvasW = 0;
let _lastCanvasH = 0;

// 把所有框体整体等比缩进画布（只在恢复布局时用一次）
// 上次保存时的画布尺寸可能和现在不同（窗口大小变了 / 横竖屏切换过），
// 直接照搬 x/y/w/h 会有一部分跑到画布外面。
function fitFramesIntoCanvas() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W || !H || !frames.length) return;
  let maxR = 0, maxB = 0;
  frames.forEach(f => {
    maxR = Math.max(maxR, f.x + f.w);
    maxB = Math.max(maxB, f.y + f.h);
  });
  const k = Math.min(1, W / maxR, H / maxB);
  if (!(k < 0.999)) return;               // 没超框就不用动
  frames.forEach(f => {
    f.w = Math.max(MIN_W, Math.round(f.w * k));
    f.h = Math.max(MIN_H, Math.round(f.h * k));
    f.x = Math.max(0, Math.round(f.x * k));
    f.y = Math.max(0, Math.round(f.y * k));
    f.x = Math.min(f.x, Math.max(0, W - f.w));
    f.y = Math.min(f.y, Math.max(0, H - f.h));
    applyFrameStyle(f);
    if (f.kind === 'text') applyTextStyle(f, false);
  });
}

/* 铺满画布：让框体撑满整个画布，保留纵横比（contain）并居中 */
function fitFrameToCanvas(f) {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W || !H) return;
  // 窗口源有固定纵横比（followStreamAspect），铺满时按 contain 算
  const aspect = f.keepRatio && f.aspect ? f.aspect : (f.w && f.h ? f.w / f.h : 16 / 9);
  let w = W, h = Math.round(W / aspect);
  if (h > H) { h = H; w = Math.round(H * aspect); }
  f.w = w; f.h = h;
  f.x = Math.max(0, Math.round((W - w) / 2));
  f.y = Math.max(0, Math.round((H - h) / 2));
}

/* ================= 弹窗可拖动 ================= */
// 设定栏弹出来后能拖到任意位置，不挡住要看的画面
function draggableModal(panel, handle) {
  if (!panel || !handle || panel.dataset.dragReady === '1') return;
  panel.dataset.dragReady = '1';
  handle.style.cursor = 'move';
  handle.style.userSelect = 'none';
  let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, bx = 0, by = 0, bw = 0, bh = 0;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  handle.addEventListener('pointerdown', e => {
    if (e.target.closest('button, input, select, textarea, a, label')) return;
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(panel.style.transform || '');
    ox = m ? parseFloat(m[1]) : 0;
    oy = m ? parseFloat(m[2]) : 0;
    // 记录未平移时的基准位置，拖动时用它算边界，防止把设定栏拖到看不见的地方
    const r = panel.getBoundingClientRect();
    bx = r.left - ox; by = r.top - oy; bw = r.width; bh = r.height;
    try { handle.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    const nx = clamp(ox + e.clientX - sx, 80 - bw - bx, window.innerWidth - 80 - bx);
    const ny = clamp(oy + e.clientY - sy, 40 - bh - by, window.innerHeight - 40 - by);
    panel.style.transform = 'translate(' + Math.round(nx) + 'px,' + Math.round(ny) + 'px)';
  });
  const stop = () => { dragging = false; };
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
  // 双击标题复位
  handle.addEventListener('dblclick', e => {
    if (e.target.closest('button, input, select, textarea, a')) return;
    panel.style.transform = '';
  });
}

/* 键盘快捷键（Tab/Esc 隐藏快捷键已取消，只剩删除/微调） */
document.addEventListener('keydown', e => {
  const t = e.target && e.target.tagName;
  if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return;
  const f = frames.find(o => o.id === selectedId);
  if ((e.key === 'Delete' || e.key === 'Backspace') && f) {
    e.preventDefault();
    removeFrame(f);
    return;
  }
  if (!f || f.locked) return;
  const step = e.shiftKey ? 10 : 1;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[e.key]) {
    e.preventDefault();
    f.x += moves[e.key][0];
    f.y += moves[e.key][1];
    applyFrameStyle(f);
    persist();
  }
});
canvas.addEventListener('pointerdown', e => {
  if (e.target === canvas || e.target === emptyHint) {
    selectedId = null;
    frames.forEach(o => o.el.classList.remove('selected'));
  }
});


/* ================= 启动 ================= */
(async function boot() {
  ['#srcModal', '#camModal'].forEach(sel => {
    const m = $(sel);
    if (m) draggableModal(m.querySelector('.modal-box'), m.querySelector('.modal-head'));
  });
  // 先把画布定成 16:9 —— 必须在 restore() 之前，否则框体会按错误尺寸摆放
  layoutCanvas();
/* 嵌入模式（被 TeachingHall 等父页面当排版台用）下，启动时强制显示：
   隐藏与否完全交给老师手动控制（点「隐藏」按钮），不该自动进入隐藏态，
   避免上次退出时存下来的 hide=true 导致这次一进来就看不到框体标签 */
  const embedded = window.parent && window.parent !== window;
  if (ui.hide && !embedded) {
    document.body.classList.add('hide-ui');
    $('#optLive').classList.add('on');
    showHideHint(3000);   // 一进来就告诉你怎么退出去
  } else if (embedded && ui.hide) {
    ui.hide = false; saveUI();
    document.body.classList.remove('hide-ui');   // 强制显示，不继承上次的隐藏态
    $('#optLive').classList.remove('on');
  }
  // 窗口尺寸变化 / 工具栏换行时：重算 16:9 画布，再把框体收回画布内
  let rzTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(() => { layoutCanvas(); clampFramesToCanvas(); }, 200);
  });

  await restore();
  // 恢复完布局后再校一次：有框体时 clampFramesToCanvas 会以当前画布为基准记下来
  _lastCanvasW = canvas.clientWidth; _lastCanvasH = canvas.clientHeight;
  updateEmptyHint();
  diag('boot ok, frames=' + frames.length);

  // MIDI 中枢：排版台统一订阅设备，再转发给所有琴键框
  initMidiHub();

  // 镜头热插拔：弹窗打开时自动刷新列表
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', () => {
      if (!camModal.classList.contains('hidden')) openCamModal();
    });
  }

  // 调试/自动化测试钩子（不影响正常使用）
  window.__app = { frames, applyTextStyle, fitTextBox, applyFrameStyle, persist };
  
  // 监听父页面请求画布流 / 隐藏编辑工具栏（推流时学员不该看到工具栏）
  window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'SET_HIDE') {
      setHide(!!e.data.on, true);
    }
    // 父页面（工具条「隐藏」按钮）询问当前隐藏状态，用于同步按钮颜色
    if (e.data.type === 'GET_HIDE_STATE') {
      try { window.parent.postMessage({ type: 'HIDE_STATE', on: isHide() }, '*') } catch (_) {}
    }
    // 嵌入模式：工具栏搬到了父页面（教学框上方），这里直接转发点击
    if (e.data.type === 'TOOLBAR_ACTION') {
      const btn = {
        window: '#addWindow', camera: '#addCamera', keys: '#addKeys',
        text: '#addText', file: '#addFile', live: '#optLive', clear: '#clearAll'
      }[e.data.action];
      const el = btn && $(btn);
      if (el) el.click();
    }
  });

  /* 嵌入到父页面（教学框）时：把顶部工具栏彻底藏掉。
     不能只用 body.hide-ui —— 那只是 opacity:0，56px 高度还占着，
     会在画面顶上留一条黑框，还把画布挤成非 16:9。
     这里直接 display:none，画布正好占满 iframe（16:9）。 */
  if (window.parent && window.parent !== window) {
    document.body.classList.add('embed-mode');
  }
})();
}); // end DOMContentLoaded
