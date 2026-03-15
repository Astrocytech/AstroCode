#!/bin/bash
# AstroCoder Installation Script
# Usage: ./install.sh

set -e

echo "========================================"
echo "AstroCoder Installation Script"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo -e "${RED}Error: bun is not installed${NC}"
    echo "Please install bun first: https://bun.sh"
    exit 1
fi

echo -e "${GREEN}bun found: $(bun --version)${NC}"

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}Error: git is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}git found: $(git --version)${NC}"

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo -e "${YELLOW}Warning: Ollama is not installed${NC}"
    echo "Please install Ollama from https://ollama.ai"
    echo "After installation, run: ollama pull llama3.1"
else
    echo -e "${GREEN}Ollama found: $(ollama --version)${NC}"
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
cd "$SCRIPT_DIR"
bun install

# Build astrocoder (clean build)
echo -e "${YELLOW}Building astrocoder (clean)...${NC}"
cd "$SCRIPT_DIR/packages/astrocoder"
rm -rf dist node_modules
cd "$SCRIPT_DIR"
bun install
cd "$SCRIPT_DIR/packages/astrocoder"
bun run build

# Verify build
if [ -f "./dist/astrocoder-linux-x64/bin/opencode" ]; then
    echo -e "${GREEN}Build successful!${NC}"
    echo ""
    echo "AstroCoder has been installed successfully!"
    echo ""
    echo "To run AstroCoder:"
    echo "  cd $SCRIPT_DIR/packages/astrocoder"
    echo "  ./dist/astrocoder-linux-x64/bin/opencode"
    echo ""
    echo "Or link globally:"
    echo "  cd $SCRIPT_DIR/packages/astrocoder && npm link"
    echo ""
    echo "Then run: astrocoder"
else
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}Installation complete!${NC}"