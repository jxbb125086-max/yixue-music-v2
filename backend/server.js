// backend/server.js — 易学音乐沙龙服务器
// 架构：Socket.IO 信令 + WebRTC Mesh（simple-peer）
// 连线流程：老师邀请学员 → 学员端按钮变绿 → 点击接受 → 学员音频实时接入
const express = require('express');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');

function generateRoomId() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

const app = express();
const httpServer = createServer(app);
// 生产环境前后端同源（由本服务托管 dist），不需要放开 CORS；
// 开发环境前端在 5173，才需要允许跨域。
const io = new Server(httpServer, {
    cors: { origin: process.env.NODE_ENV === 'production' ? false : '*' }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
    const distPath = path.join(__dirname, '..', 'frontend', 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
} else {
    app.use(express.static(path.join(__dirname, '..', 'frontend')));
}

// ── 房间 / 用户数据 ──
// room: { users[], teacher, teacherName, chatHistory[], speaking: { studentId, status } | null }
// user: { name, role, room, micOn }
const rooms = {};
const users = {}; // socketId → { name, role, room, micOn }

function getRoomUsers(roomId) {
    const room = rooms[roomId];
    if (!room) return [];
    return room.users.map(sid => ({
        id: sid,
        name: users[sid]?.name ?? '未知',
        role: users[sid]?.role ?? 'student',
        micOn: users[sid]?.micOn ?? false
    }));
}

// 服务端系统消息：推送给房间内所有人（两端聊天公屏都能看到）
function pushSystem(roomId, content) {
    const room = rooms[roomId];
    if (!room) return;
    const msg = {
        id: 'sys-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        senderId: 'system', senderName: '系统', senderRole: 'system',
        content, time: Date.now()
    };
    room.chatHistory.push(msg);
    if (room.chatHistory.length > 200) room.chatHistory = room.chatHistory.slice(-200);
    io.to(roomId).emit('chat-message', msg);
}

// 结束当前连线（内部用，发通知 + 清状态）
function clearSpeaking(roomId, reason) {
    const room = rooms[roomId];
    if (!room || !room.speaking) return;
    const { studentId, status } = room.speaking;
    const student = users[studentId];
    const name = student?.name ?? '学员';
    room.speaking = null;
    if (student) student.micOn = false;
    io.to(studentId).emit('speak-ended', { reason });
    io.to(roomId).emit('user-mic-update', { id: studentId, micOn: false });
    io.to(roomId).emit('speak-state', { studentId: null, status: null });
    if (status === 'live') {
        pushSystem(roomId, `⚪ ${name} 已断开连线`);
    } else {
        pushSystem(roomId, reason === 'student' ? `📨 ${name} 没有接受连线邀请` : `📨 已取消对 ${name} 的连线邀请`);
    }
}

io.on('connection', socket => {
    console.log('🔌 连接:', socket.id);

    // ── 创建房间（老师，带姓名）──
    socket.on('create-room', ({ teacherName = '老师' } = {}, cb) => {
        const roomId = generateRoomId();
        rooms[roomId] = { users: [socket.id], teacher: socket.id, teacherName, chatHistory: [], speaking: null };
        users[socket.id] = { name: teacherName, role: 'teacher', room: roomId, micOn: true };
        socket.join(roomId);
        cb && cb(roomId);
    });

    // ── 加入房间（学生）──
    socket.on('join-room', ({ roomId, userName = '学员' }) => {
        if (!rooms[roomId]) return;
        users[socket.id] = { name: userName, role: 'student', room: roomId, micOn: false };
        if (!rooms[roomId].users.includes(socket.id)) rooms[roomId].users.push(socket.id);
        socket.join(roomId);

        socket.emit('chat-history', rooms[roomId].chatHistory || []);
        socket.emit('room-info', { teacherName: rooms[roomId].teacherName, speaking: rooms[roomId].speaking });

        socket.to(roomId).emit('user-joined', { id: socket.id, name: userName });
        io.to(roomId).emit('room-users', getRoomUsers(roomId));
        pushSystem(roomId, `🎉 ${userName} 加入了沙龙`);
    });

    // ── WebRTC 信令转发 ──
    socket.on('signal', ({ to, from, signal }) => {
        io.to(to).emit('signal', { from, signal });
    });

    socket.on('rebuild-peers', ({ roomId }) => {
        io.to(roomId).emit('rebuild-peers', { roomId });
    });

    socket.on('request-video', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        socket.join(roomId);
        io.to(room.teacher).emit('student-rejoined', { studentId: socket.id, roomId });
    });

    // ── 老师邀请学员连线（同时只保留一个连线）──
    socket.on('invite-speak', ({ studentId, roomId }) => {
        const room = rooms[roomId];
        if (!room || room.teacher !== socket.id) return;
        const student = users[studentId];
        if (!student || student.role !== 'student') return;
        // 已有连线 → 先结束
        if (room.speaking) clearSpeaking(roomId, 'teacher');
        room.speaking = { studentId, status: 'invited' };
        io.to(studentId).emit('speak-invited', { teacherName: room.teacherName });
        io.to(roomId).emit('speak-state', { studentId, status: 'invited' });
        pushSystem(roomId, `📨 ${room.teacherName} 邀请 ${student.name} 连线`);
    });

    // ── 学员接受连线 ──
    socket.on('accept-speak', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || !room.speaking || room.speaking.studentId !== socket.id) return;
        const student = users[socket.id];
        if (!student) return;
        room.speaking.status = 'live';
        student.micOn = true;
        io.to(roomId).emit('user-mic-update', { id: socket.id, micOn: true });
        io.to(roomId).emit('speak-state', { studentId: socket.id, status: 'live' });
        pushSystem(roomId, `🟢 ${student.name} 已连线，大家能听到 TA 了`);
    });

    // ── 结束连线（老师操作 / 学员主动断开）──
    socket.on('end-speak', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room || !room.speaking) return;
        const isTeacher = room.teacher === socket.id;
        const isSpeaker = room.speaking.studentId === socket.id;
        if (!isTeacher && !isSpeaker) return;
        clearSpeaking(roomId, isSpeaker ? 'student' : 'teacher');
    });

    // ── 老师强制断开当前连线 ──
    socket.on('teacher-end-speak', roomId => {
        const room = rooms[roomId];
        if (!room || room.teacher !== socket.id || !room.speaking) return;
        clearSpeaking(roomId, 'teacher');
    });

    // ── 学员连线中自行静音/取消静音 ──
    socket.on('toggle-mic', roomId => {
        const user = users[socket.id];
        if (!user || user.role !== 'student' || user.room !== roomId) return;
        const room = rooms[roomId];
        if (!room?.speaking || room.speaking.studentId !== socket.id || room.speaking.status !== 'live') return;
        user.micOn = !user.micOn;
        io.to(roomId).emit('user-mic-update', { id: socket.id, micOn: user.micOn });
    });

    // ── 聊天消息 ──
    socket.on('chat-message', ({ roomId, content }) => {
        const user = users[socket.id];
        if (!user || !roomId || !content || !String(content).trim()) return;
        const msg = {
            id: socket.id + '-' + Date.now(),
            senderId: socket.id,
            senderName: user.name,
            senderRole: user.role,
            content: String(content).slice(0, 500),
            time: Date.now()
        };
        rooms[roomId].chatHistory.push(msg);
        if (rooms[roomId].chatHistory.length > 200) rooms[roomId].chatHistory = rooms[roomId].slice(-200);
        io.to(roomId).emit('chat-message', msg);
    });

    // ── 踢出学生 ──
    socket.on('kick-student', ({ studentId, roomId }) => {
        const room = rooms[roomId];
        if (!room || room.teacher !== socket.id) return;
        const student = users[studentId];
        if (!student) return;
        if (room.speaking && room.speaking.studentId === studentId) {
            room.speaking = null;
            io.to(studentId).emit('speak-ended', { reason: 'kicked' });
            io.to(roomId).emit('speak-state', { studentId: null, status: null });
        }
        pushSystem(roomId, `👋 ${student.name} 被请出了沙龙`);
        io.to(studentId).emit('kicked', { teacherName: room.teacherName });
        const s = io.sockets.sockets.get(studentId);
        if (s) s.leave(roomId);
        room.users = room.users.filter(id => id !== studentId);
        delete users[studentId];
        io.to(roomId).emit('room-users', getRoomUsers(roomId));
    });

    // ── 结束课程 ──
    socket.on('end-class', roomId => {
        const room = rooms[roomId];
        if (!room || room.teacher !== socket.id) return;
        io.to(roomId).emit('class-ended');
        room.users.forEach(sid => delete users[sid]);
        delete rooms[roomId];
    });

    // ── 断开处理 ──
    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (!user) return;
        const roomId = user.room;
        const room = rooms[roomId];
        if (room) {
            room.users = room.users.filter(id => id !== socket.id);
            if (user.role === 'teacher') {
                io.to(roomId).emit('class-ended');
                delete rooms[roomId];
            } else {
                if (room.speaking && room.speaking.studentId === socket.id) {
                    room.speaking = null;
                    io.to(roomId).emit('speak-state', { studentId: null, status: null });
                    pushSystem(roomId, `⚪ ${user.name} 已断开连线`);
                }
                pushSystem(roomId, `👋 ${user.name} 离开了沙龙`);
                io.to(roomId).emit('room-users', getRoomUsers(roomId));
            }
        }
        delete users[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 易学音乐沙龙 Server listening on http://0.0.0.0:${PORT}`);
});
