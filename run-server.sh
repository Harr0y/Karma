#!/bin/bash
# Karma 测试启动脚本
# 在独立终端中运行此脚本

cd /Users/lizhengchen/project/karma

# 加载环境变量
export ANTHROPIC_AUTH_TOKEN="cb428b0262ee4d058a45f13504184448.184yEdtywoA2WHFz"
export ANTHROPIC_BASE_URL="https://open.bigmodel.cn/api/anthropic"
export ANTHROPIC_MODEL="glm-5"

# 解除 Claude Code 嵌套限制
unset CLAUDECODE

echo "=========================================="
echo "  Karma 测试服务器"
echo "=========================================="
echo ""
echo "环境变量已设置:"
echo "  ANTHROPIC_BASE_URL: $ANTHROPIC_BASE_URL"
echo "  ANTHROPIC_MODEL: $ANTHROPIC_MODEL"
echo "  CLAUDECODE: (已清除)"
echo ""
echo "启动服务器..."
echo ""

# 启动服务器
npx tsx src/index.ts server --port 3080
