#!/bin/bash

echo "========================================================"
echo "                 盐选短篇故事工作台"
echo "========================================================"
echo ""

# 1. 检查 Node.js 环境
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js，请先前往 https://nodejs.org/ 安装 (推荐 v20+)"
    exit 1
fi

# 2. 检查并安装依赖
if [ ! -d "node_modules" ]; then
    echo "[状态] 检测到首次运行，正在自动安装依赖，请稍候..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[错误] 依赖安装失败，请检查网络后重试。"
        exit 1
    fi
    echo "[状态] 依赖安装完成！"
    echo ""
fi

# 3. 检查并初始化配置
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "[状态] 正在初始化默认配置 (.env)..."
        cp .env.example .env
    else
        echo "[警告] 未找到 .env.example 模板，跳过配置初始化。"
    fi
fi

# 4. 自动打开浏览器 (跨平台处理)
echo "[状态] 准备就绪，正在启动服务并在浏览器中打开页面..."
echo "[提示] 如果浏览器未自动刷新，请手动访问 http://127.0.0.1:4173"
echo "========================================================"
echo ""

(sleep 2 && (
    if command -v xdg-open > /dev/null; then
        xdg-open http://127.0.0.1:4173
    elif command -v open > /dev/null; then
        open http://127.0.0.1:4173
    fi
)) &

# 5. 启动 Node.js 服务
npm start
