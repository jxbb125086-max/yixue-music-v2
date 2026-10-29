// backend/camera.js — 网络互联相机（IP Camera）发现与转流
//
// 为什么需要这一层：
//   浏览器的 getUserMedia 只能拿到「系统注册过的本机摄像头」（内置/USB/iPhone 连续互通）。
//   局域网里的 IP 相机（小米、海康、大华、TP-Link、ONVIF 通用机）走的是 RTSP 协议，
//   浏览器不能直接播放 RTSP，所以由后端用 ffmpeg 转成 MJPEG 推给前端 <img>。
//
// 三个能力：
//   1) discover()  —— ONVIF WS-Discovery 组播 + 本地子网 RTSP 端口探测，找出局域网里的相机
//   2) probe()     —— ffprobe 一个地址，确认能连通并读出分辨率/编码
//   3) stream()    —— ffmpeg 拉 RTSP，转 MJPEG multipart，客户端断开时杀进程
//
// 安全约束：只允许私有网段（10/8、172.16/12、192.168/16、127/8、169.254/16）作为目标，
// 避免被当成内网探测跳板。

const dgram = require('dgram');
const net = require('net');
const os = require('os');
const { spawn } = require('child_process');
const crypto = require('crypto');

// ── 常见 RTSP 端口 ──
const RTSP_PORTS = [554, 8554, 10554];

/* ================= 工具 ================= */

function isPrivateHost(host) {
    const h = String(host || '').trim();
    if (!h) return false;
    if (h === 'localhost') return true;
    // 只处理 IPv4 字面量；域名一律拒绝（防止被用来探测任意公网地址）
    const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return false;
    const [a, b] = [Number(m[1]), Number(m[2])];
    if ([a, b, Number(m[3]), Number(m[4])].some(n => n > 255)) return false;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    return false;
}

function parseUrl(url) {
    try {
        const u = new URL(String(url));
        return { proto: u.protocol.replace(':', ''), host: u.hostname, port: u.port, ok: true };
    } catch (e) {
        return { ok: false };
    }
}

/** 校验：只允许 rtsp/rtmp/http/https，且目标是私有地址 */
function safeStreamUrl(url) {
    const p = parseUrl(url);
    if (!p.ok) return { ok: false, err: '地址格式不正确' };
    if (!['rtsp', 'rtsps', 'rtmp', 'http', 'https'].includes(p.proto))
        return { ok: false, err: '只支持 rtsp / rtmp / http(s) 地址' };
    if (!isPrivateHost(p.host))
        return { ok: false, err: '只允许局域网内地址（10.x / 172.16-31.x / 192.168.x）' };
    return { ok: true };
}

/** 拿本机所有 IPv4 私有网段，例如 ['192.168.1', '10.0.0'] */
function localSubnets() {
    const out = [];
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
        for (const ni of ifaces[name] || []) {
            if (ni.family !== 'IPv4' && ni.family !== 4) continue;
            if (ni.internal) continue;
            if (!isPrivateHost(ni.address)) continue;
            const seg = ni.address.split('.').slice(0, 3).join('.');
            if (!out.includes(seg)) out.push(seg);
        }
    }
    return out;
}

/** TCP 探测某端口是否开放 */
function probePort(host, port, timeout = 350) {
    return new Promise(resolve => {
        const sock = new net.Socket();
        let settled = false;
        const finish = ok => {
            if (settled) return;
            settled = true;
            try { sock.destroy(); } catch (e) { }
            resolve(ok);
        };
        sock.setTimeout(timeout);
        sock.once('connect', () => finish(true));
        sock.once('timeout', () => finish(false));
        sock.once('error', () => finish(false));
        try { sock.connect(port, host); } catch (e) { finish(false); }
    });
}

/** 有限并发地跑一批异步任务 */
async function mapLimit(items, limit, worker) {
    const results = [];
    let idx = 0;
    const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
        while (idx < items.length) {
            const i = idx++;
            try { results[i] = await worker(items[i], i); } catch (e) { results[i] = null; }
        }
    });
    await Promise.all(runners);
    return results;
}

/* ================= ① ONVIF WS-Discovery ================= */

/**
 * 组播探测 ONVIF 设备。返回 [{ ip, xaddr, scopes }]
 * 原理：向 239.255.255.250:3702 发一条 SOAP Probe，设备会 UDP 单播回自己的服务地址。
 */
function onvifDiscover(timeout = 2500) {
    return new Promise(resolve => {
        const found = new Map();
        const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        const msgId = 'uuid:' + crypto.randomUUID();

        const probe = `<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"
            xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"
            xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
            xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <e:Header>
    <w:MessageID>${msgId}</w:MessageID>
    <w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
    <w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>
  </e:Header>
  <e:Body>
    <d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe>
  </e:Body>
</e:Envelope>`;

        const buf = Buffer.from(probe, 'utf8');

        const done = () => {
            try { sock.close(); } catch (e) { }
            resolve(Array.from(found.values()));
        };

        sock.on('message', (data, rinfo) => {
            const xml = data.toString('utf8');
            if (!/XAddrs|NetworkVideoTransmitter/i.test(xml)) return;
            const xaddrMatch = xml.match(/<[^>]*XAddrs[^>]*>([^<]+)</i);
            const scopesMatch = xml.match(/<[^>]*Scopes[^>]*>([^<]+)</i);
            const xaddr = xaddrMatch ? xaddrMatch[1].trim().split(/\s+/)[0] : '';
            let ip = rinfo.address;
            if (xaddr) {
                const m = xaddr.match(/^https?:\/\/([\d.]+)/i);
                if (m) ip = m[1];
            }
            if (!found.has(ip)) {
                found.set(ip, {
                    ip,
                    xaddr,
                    scopes: scopesMatch ? scopesMatch[1].trim() : '',
                    source: 'onvif'
                });
            }
        });
        sock.on('error', () => { try { sock.close(); } catch (e) { } resolve(Array.from(found.values())); });

        try {
            sock.bind(() => {
                try {
                    sock.setBroadcast(true);
                    sock.setMulticastTTL(2);
                    sock.send(buf, 0, buf.length, 3702, '239.255.255.250', () => { });
                } catch (e) { /* 组播被系统拒绝时静默降级到端口探测 */ }
            });
        } catch (e) { /* 忽略 */ }

        setTimeout(done, timeout);
    });
}

/* ================= ② 本地子网 RTSP 端口探测 ================= */

async function scanSubnet(timeout = 350, concurrency = 96) {
    const segs = localSubnets();
    if (!segs.length) return [];
    const targets = [];
    for (const seg of segs) {
        for (let i = 1; i <= 254; i++) targets.push({ host: `${seg}.${i}`, port: 554 });
    }
    const hits = await mapLimit(targets, concurrency, async t => {
        const ok = await probePort(t.host, t.port, timeout);
        return ok ? t.host : null;
    });
    return Array.from(new Set(hits.filter(Boolean)));
}

/* ================= ③ 探测流信息 ================= */

/** 只有 rtsp 协议才需要指定传输方式；对 http/mp4 加这个参数会直接报错 */
function rtspArgs(url) {
    const p = parseUrl(url);
    if (p.ok && (p.proto === 'rtsp' || p.proto === 'rtsps')) {
        return ['-rtsp_transport', 'tcp'];
    }
    return [];
}

/**
 * 用 ffprobe 读一个地址的流信息。用于「测试连接」和选相机前确认可用。
 * 返回 { ok, width, height, codec, err }
 */
function ffprobeStream(url, timeoutMs = 8000) {
    return new Promise(resolve => {
        const check = safeStreamUrl(url);
        if (!check.ok) return resolve({ ok: false, err: check.err });

        const p = parseUrl(url);
        const isRtsp = p.ok && (p.proto === 'rtsp' || p.proto === 'rtsps');
        const args = [
            '-v', 'error',
            ...rtspArgs(url),
            '-select_streams', 'v:0',
            '-show_entries', 'stream=width,height,codec_name',
            '-of', 'json',
            // -timeout 是 rtsp/http 协议级参数，本地文件类地址加了会报错
            ...(isRtsp ? ['-timeout', String(timeoutMs * 1000)] : []),
            url
        ];
        let out = '', err = '';
        let child;
        try {
            child = spawn('ffprobe', args, { stdio: ['ignore', 'pipe', 'pipe'] });
        } catch (e) {
            return resolve({ ok: false, err: '未找到 ffprobe，请先安装 ffmpeg' });
        }
        const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch (e) { } }, timeoutMs + 1500);

        child.stdout.on('data', d => out += d.toString());
        child.stderr.on('data', d => err += d.toString());
        child.on('error', e => {
            clearTimeout(timer);
            resolve({ ok: false, err: '无法执行 ffprobe：' + e.message });
        });
        child.on('close', code => {
            clearTimeout(timer);
            if (code !== 0) {
                const brief = (err || '').trim().split('\n').slice(-2).join(' ') || `退出码 ${code}`;
                return resolve({ ok: false, err: brief.slice(0, 200) });
            }
            try {
                const j = JSON.parse(out || '{}');
                const s = (j.streams || [])[0] || {};
                resolve({
                    ok: true,
                    width: s.width || 0,
                    height: s.height || 0,
                    codec: s.codec_name || '',
                    label: s.width && s.height ? `${s.width}×${s.height} ${s.codec || ''}`.trim() : (s.codec || '未知')
                });
            } catch (e) {
                resolve({ ok: false, err: '返回数据解析失败' });
            }
        });
    });
}

/* ================= ④ RTSP → MJPEG 转流 ================= */

// 每个流记一份进程，客户端断开要能立刻杀掉，否则 ffmpeg 会一直拉流吃 CPU
const streams = new Map(); // id → { child, url, clients, createdAt }

function startMjpegStream(req, res, opts) {
    const url = opts.url;
    const check = safeStreamUrl(url);
    if (!check.ok) {
        res.status(400).json({ ok: false, error: check.err });
        return;
    }

    const w = Math.max(160, Math.min(1920, Number(opts.w) || 1280));
    const fps = Math.max(1, Math.min(30, Number(opts.fps) || 20));
    const q = Math.max(2, Math.min(20, Number(opts.q) || 5));
    // 只限宽度、高度按比例自适应：保持相机原始画面比例，且小分辨率不被放大
    const vf = `scale=w='min(iw,${w})':h=-2,fps=${fps}`;

    const p = parseUrl(url);
    const isRtsp = p.ok && (p.proto === 'rtsp' || p.proto === 'rtsps');

    const args = [
        '-hide_banner', '-loglevel', 'error',
        ...rtspArgs(url),
        // 低延迟参数只对 RTSP 实时流有意义；加在 mp4/http 上会让 demuxer 读不出数据（实测 0 字节）
        ...(isRtsp
            ? ['-fflags', 'nobuffer', '-flags', 'low_delay',
               '-analyzeduration', '1000000', '-probesize', '1000000']
            // 非实时源（http 视频 / 文件）按原生速率读，否则 ffmpeg 会一口气把整段推完
            : ['-re']),
        '-i', url,
        '-an',
        '-vf', vf,
        '-c:v', 'mjpeg',
        '-q:v', String(q),
        '-f', 'image2pipe',
        'pipe:1'
    ];

    let child;
    try {
        child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        res.status(500).json({ ok: false, error: '未找到 ffmpeg，请先安装 ffmpeg' });
        return;
    }

    const id = crypto.randomUUID();
    streams.set(id, { child, url, createdAt: Date.now() });

    res.writeHead(200, {
        'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Connection': 'close'
    });

    // JPEG 以 FFD8 开头、FFD9 结尾。在熵编码数据里 FF 会被转义成 FF00，
    // 所以流里出现 FFD9 一定是一帧结束，直接按标记切分即可。
    let buf = Buffer.alloc(0);
    const MAX = 8 * 1024 * 1024;   // 单帧上限，防止异常数据把内存吃满

    child.stdout.on('data', chunk => {
        buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
        if (buf.length > MAX) { buf = Buffer.alloc(0); return; }

        let start = buf.indexOf(Buffer.from([0xFF, 0xD8]));
        while (start !== -1) {
            const end = buf.indexOf(Buffer.from([0xFF, 0xD9]), start + 2);
            if (end === -1) break;
            const jpeg = buf.subarray(start, end + 2);
            buf = buf.subarray(end + 2);
            try {
                res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`);
                res.write(jpeg);
                res.write('\r\n');
            } catch (e) { break; }
            start = buf.indexOf(Buffer.from([0xFF, 0xD8]));
        }
    });

    let errText = '';
    child.stderr.on('data', d => {
        errText += d.toString();
        if (errText.length > 4000) errText = errText.slice(-2000);
    });

    const cleanup = () => {
        streams.delete(id);
        try { child.kill('SIGKILL'); } catch (e) { }
        try { res.end(); } catch (e) { }
    };

    child.on('error', () => cleanup());
    child.on('close', () => {
        streams.delete(id);
        // 还没写出任何画面就退出 → 把 ffmpeg 的错误原因告诉前端
        try { res.end(); } catch (e) { }
        console.warn('[camera] 转流结束', url, (errText || '').trim().slice(0, 200));
    });

    req.on('close', cleanup);
    req.on('aborted', cleanup);
}

/** 服务关闭时把所有 ffmpeg 杀掉 */
function killAll() {
    for (const [id, s] of streams) {
        try { s.child.kill('SIGKILL'); } catch (e) { }
        streams.delete(id);
    }
}

/* ================= 对外挂载 ================= */

function mountCamera(app) {
    const express = require('express');
    const router = express.Router();

    router.get('/discover', async (req, res) => {
            const t0 = Date.now();
            try {
                const [onvif, hosts] = await Promise.all([
                    onvifDiscover(2200),
                    scanSubnet(350, 96)
                ]);

                const items = [];
                const seen = new Set();

                for (const d of onvif) {
                    seen.add(d.ip);
                    const brand = /hikvision/i.test(d.scopes) ? '海康 Hikvision'
                        : /dahua/i.test(d.scopes) ? '大华 Dahua'
                        : /axis/i.test(d.scopes) ? 'Axis'
                        : /tp-?link/i.test(d.scopes) ? 'TP-Link'
                        : /xiaomi|mijia/i.test(d.scopes) ? '小米'
                        : 'ONVIF 相机';
                    items.push({
                        ip: d.ip,
                        brand,
                        source: 'onvif',
                        rtsp: '',                       // ONVIF 设备的 RTSP 路径需要凭据，留给手动填
                        note: '已识别为 ONVIF 设备，填入账号密码后可用'
                    });
                }

                for (const ip of hosts) {
                    if (seen.has(ip)) continue;
                    seen.add(ip);
                    // 只报「开了 554」这个事实，不猜用户名密码
                    items.push({
                        ip,
                        brand: '未知（554 端口开放）',
                        source: 'portscan',
                        rtsp: `rtsp://${ip}:554/`,
                        note: '开放 RTSP 端口，通常需要填完整路径和账号'
                    });
                }

                res.json({
                    ok: true,
                    count: items.length,
                    items,
                    subnets: localSubnets(),
                    elapsed: Date.now() - t0
                });
            } catch (e) {
                res.status(500).json({ ok: false, error: e.message || '搜索失败' });
            }
    });

    router.post('/probe', async (req, res) => {
        const { url } = req.body || {};
        if (!url) return res.status(400).json({ ok: false, error: '缺少 url' });
        const r = await ffprobeStream(url, 8000);
        res.json(r);
    });

    router.get('/stream', (req, res) => {
        startMjpegStream(req, res, req.query || {});
    });

    app.use('/api/camera', router);
}

module.exports = { mountCamera, killAll, ffprobeStream, isPrivateHost, safeStreamUrl };
