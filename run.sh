#!/bin/bash
# AstroCoder Run Script
# Usage: ./run.sh

cd "$(dirname "$0")/packages/astrocoder"

# Install dependencies if node_modules missing
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    bun install
fi

bun run src/index.ts