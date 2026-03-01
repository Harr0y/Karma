#!/bin/sh
set -e

# Create required directories if they don't exist
mkdir -p /home/karma/.karma/logs
mkdir -p /home/karma/.karma/skills

# Configure Exa MCP for Agent-Reach search (if not already configured)
if ! mcporter list 2>/dev/null | grep -q "exa"; then
  echo "Configuring Exa MCP..."
  mcporter config add exa https://mcp.exa.ai/mcp 2>/dev/null || true
fi

# Execute the main command
exec node dist/index.js server
