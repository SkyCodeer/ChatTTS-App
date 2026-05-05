#!/bin/bash
# 启动 ChatTTS Web 应用

cd "$(dirname "$0")"

# 检查并安装依赖
if [ ! -d "backend" ] || [ ! -f "backend/requirements.txt" ]; then
    echo "❌ backend 目录不存在"
    exit 1
fi

# 安装 Python 依赖
echo "📦 安装 Python 依赖..."
pip install -r backend/requirements.txt -q

# 启动服务
echo "🚀 启动 ChatTTS Web 服务..."
echo "   访问 http://localhost:8000"
echo "   按 Ctrl+C 停止服务"
echo ""

uvicorn backend.main:app --reload --port 8000 --host 0.0.0.0
