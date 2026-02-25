#!/bin/bash
# Karma Docker 启动脚本
# 使用方法: ./start.sh [up|down|logs|restart]

set -e

# 进入脚本所在目录
cd "$(dirname "$0")"

# 加载 .env 文件中的环境变量（优先级高于 shell 环境变量）
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

case "${1:-up}" in
  up)
    echo "🚀 启动 Karma 服务..."
    docker compose up -d
    echo "✅ 服务已启动: http://localhost:3000"
    echo "📋 查看日志: ./start.sh logs"
    ;;
  down)
    echo "🛑 停止 Karma 服务..."
    docker compose down
    echo "✅ 服务已停止"
    ;;
  logs)
    docker compose logs -f
    ;;
  restart)
    echo "🔄 重启 Karma 服务..."
    docker compose down
    docker compose up -d
    echo "✅ 服务已重启"
    ;;
  status)
    docker compose ps
    ;;
  *)
    echo "用法: $0 {up|down|logs|restart|status}"
    exit 1
    ;;
esac
