#!/bin/bash
# 一键清理本地开发服务
echo "🧹 清理本地开发服务..."

# 清理 5173 端口（Vite 前端）
if lsof -ti :5173 > /dev/null; then
    echo "  关闭 5173 端口 (Vite)"
    kill $(lsof -ti :5173) 2>/dev/null
fi

# 清理 8888 端口（静态文件服务）
if lsof -ti :8888 > /dev/null; then
    echo "  关闭 8888 端口 (静态服务)"
    kill $(lsof -ti :8888) 2>/dev/null
fi

# 清理 3000 端口（原始易学音乐后端）
if lsof -ti :3000 > /dev/null; then
    echo "  关闭 3000 端口 (易学音乐后端)"
    kill $(lsof -ti :3000) 2>/dev/null
fi

# 清理 4000 端口
if lsof -ti :4000 > /dev/null; then
    echo "  关闭 4000 端口"
    kill $(lsof -ti :4000) 2>/dev/null
fi

# 清理 node 进程（易学音乐融合项目）
pkill -f "易学音乐融合" 2>/dev/null
echo "  清理易学音乐融合相关进程"

# 清理 PID 文件
rm -f /tmp/piano-compositor-web.pid 2>/dev/null

echo "✅ 清理完成！"
echo ""
echo "启动服务："
echo "  cd ~/Desktop/易学音乐融合/frontend && npm run dev"
