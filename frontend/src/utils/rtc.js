/* WebRTC ICE 配置
   ─────────────────────────────────────────────────────────────
   STUN：帮双方发现自己对外的公网地址，家用宽带大多数能靠它打通。
   TURN：在对称型 NAT / 企业网 / 部分移动网络下 STUN 打不通，
         必须由中继服务器转发音视频，否则学员会一直停在「正在连接老师的画面」。

   ⚠️ 注意：以前网上流传的「公共免费 TURN」（openrelay.metered.ca）已经停服，
   该域名现在解析到保留地址 192.0.2.1，配上它只会让 ICE 收集白等超时、连接更慢。
   所以这里默认只开 STUN，TURN 通过环境变量注入（没配就自动跳过）。

   怎么开 TURN（免费额度够小班课用）：
     1. https://dashboard.metered.ca/ 注册 → 创建 TURN App（免费 20GB/月）
     2. 在 frontend/.env.production（或 Render 的环境变量）里填：
          VITE_TURN_URL=turn:xxx.metered.live:80,turn:xxx.metered.live:443,turns:xxx.metered.live:443
          VITE_TURN_USER=你的用户名
          VITE_TURN_PASS=你的密码
     3. 重新 build 即可生效

   说明：TURN 凭据在前端是公开的（WebRTC 固有特性），所以额度要够用。
   自建 coturn 的话把地址换成自己的即可。 */

const STUN = [
    'stun:stun.l.google.com:19302',
    'stun:global.stun.twilio.com:3478'
]

const turnUrl = import.meta.env.VITE_TURN_URL
const turnUser = import.meta.env.VITE_TURN_USER
const turnPass = import.meta.env.VITE_TURN_PASS

const ICE_SERVERS = [
    { urls: STUN },
    ...(turnUrl && turnUser
        ? [{
            urls: String(turnUrl).split(',').map(s => s.trim()).filter(Boolean),
            username: turnUser,
            credential: turnPass
        }]
        : [])
]

/** 统一构造 SimplePeer 的 config，避免两端配置漂移 */
export function rtcConfig() {
    return { iceServers: ICE_SERVERS }
}
