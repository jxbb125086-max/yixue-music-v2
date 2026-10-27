#!/bin/bash
# 一键启动易学音乐融合 本地开发服务（后端 3000 + 前端 5173）
cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKEND_DIR="$PROJECT_DIR/backend"

echo "🚀 启动易学音乐融合开发服务..."

# ── 后端（信令 / 房间号 / 公屏，必须起，否则拿不到学生链接）──
if lsof -ti :3000 > /dev/null 2>&1; then
    echo "✅ 3000 端口后端已在运行"
else
    if [ ! -d "$BACKEND_DIR/node_modules" ]; then
        echo "   安装后端依赖..."
        (cd "$BACKEND_DIR" && npm install)
    fi
    echo "   正在启动后端 (端口 3000)..."
    (cd "$BACKEND_DIR" && nohup node server.js > /tmp/yixue-backend.log 2>&1 &)
    for i in $(seq 1 20); do
        lsof -ti :3000 > /dev/null 2>&1 && break
        sleep 0.5
    done
    if lsof -ti :3000 > /dev/null 2>&1; then
        echo "✅ 后端已启动"
    else
        echo "❌ 后端启动失败，查看 /tmp/yixue-backend.log"
    fi
fi

# ── 前端 ──
if lsof -ti :5173 > /dev/null 2>&1; then
    echo "✅ 5173 端口前端已在运行"
    echo ""
    echo "   教师端:  http://localhost:5173/"
    open "http://localhost:5173/" 2>/dev/null
    exit 0
fi

if [ ! -f "$FRONTEND_DIR/node_modules/.bin/vite" ]; then
    echo "⚠️  未安装前端依赖，先执行 npm install..."
    (cd "$FRONTEND_DIR" && npm install)
fi

echo "   正在启动 Vite 开发服务器 (端口 5173)..."
(cd "$FRONTEND_DIR" && nohup node node_modules/.bin/vite --host 0.0.0.0 --port 5173 > /tmp/yixue-vite.log 2>&1 &)

for i in $(seq 1 30); do
    if lsof -ti :5173 > /dev/null 2>&1; then
        echo ""
        echo "✅ 服务已启动！"
        echo "   教师端:  http://localhost:5173/"
        echo "   学员端:  http://localhost:5173/student/<房间号>（开课后顶栏自动显示）"
        echo "   排版台:  http://localhost:5173/composer/index.html"
        echo ""
        echo "   日志: /tmp/yixue-vite.log  /tmp/yixue-backend.log"
        echo "   停止: 双击「清理本地服务.command」"
        open "http://localhost:5173/" 2>/dev/null
        exit 0
    fi
    sleep 0.5
done

echo "❌ 启动超时，请检查日志: /tmp/yixue-vite.log"
exit 1
