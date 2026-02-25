#!/bin/sh
set -e

# Create required directories if they don't exist
mkdir -p /home/karma/.karma/logs
mkdir -p /home/karma/.karma/skills

# Execute the main command
exec node dist/index.js server
