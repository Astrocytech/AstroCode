#!/bin/bash
# AstroCoder Run Script
# Usage: ./run.sh

cd "$(dirname "$0")/packages/astrocoder"
bun run src/index.ts