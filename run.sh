#!/bin/bash
# AstroCoder Run Script
# Usage: ./run.sh

cd "$(dirname "$0")/packages/astrocoder"
./dist/astrocoder-linux-x64/bin/opencode
