#!/bin/bash

echo "========================================================"
echo "             盐选短篇故事工作台 Desktop"
echo "========================================================"
echo ""

if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js，请先前往 https://nodejs.org/ 安装 (推荐 v20+)"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "[状态] 检测到首次运行，正在自动安装依赖，请稍候..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[错误] 依赖安装失败，请检查网络后重试。"
        exit 1
    fi
fi

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "[状态] 正在初始化默认配置 (.env)..."
    cp .env.example .env
fi

echo "[状态] 正在启动桌面版..."
echo "========================================================"
echo ""

npm run desktop
