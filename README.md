# AstroCoder

<p align="center">
  <img src="logo.png" alt="AstroCoder logo" width="200">
</p>
<p align="center">The open-code AI coding agent for local Ollama models.</p>
<p align="center">
  <a href="https://github.com/Astrocytech/AstroCode">
    <img alt="GitHub" src="https://img.shields.io/github/license/Astrocytech/AstroCode?style=flat-square" />
  </a>
</p>

---

## What is AstroCoder?

AstroCoder is an open-code based AI coding assistant that was forked from OpenCode with one key difference: **AstroCoder is designed specifically for local Ollama models, especially 14B instruct models**.

While OpenCode does not support local Ollama 14B models out of the box (it lacks automatic context window management), AstroCoder handles this automatically. It calculates and sets the optimal `num_ctx` parameter for Ollama models using the formula: `(message_tokens * 1.25) + 8192`.

## Key Features

- **Local-First**: Runs entirely on your machine with Ollama
- **14B Model Support**: Automatic context window handling for 14B instruct models
- **No Cloud Dependencies**: No external API calls or provider dependencies
- **Open Source**: 100% open-code, transparency and control

## Installation

### Prerequisites
- [Ollama](https://ollama.ai) installed and running
- Bun or Node.js for development

### Quick Start

```bash
# Clone the repository
git clone https://github.com/Astrocytech/AstroCode.git
cd AstroCode

# Install dependencies
bun install

# Build the CLI
cd packages/astrocoder
bun run build

# Run with an Ollama model
./dist/astrocoder-linux-x64/bin/opencode --model ollama/llama3.1
```

### Configuration

Create an `astrocoder.json` or `opencode.json` in your project:

```json
{
  "provider": {
    "ollama": {
      "name": "Ollama",
      "npm": "@ai-sdk/openai-compatible",
      "models": {
        "llama3.1": {
          "name": "Llama 3.1 14B",
          "id": "llama3.1",
          "limit": { "context": 16384, "output": 4096 },
          "tool_call": true
        }
      },
      "options": {
        "baseURL": "http://127.0.0.1:11434/v1",
        "apiKey": "not-needed"
      }
    }
  },
  "model": "ollama/llama3.1"
}
```

### Environment Variables

- `OLLAMA_API_BASE` - Ollama server URL (default: http://127.0.0.1:11434)
- `OLLAMA_API_KEY` - API key (default: not-needed)
- `OLLAMA_CONTEXT_LENGTH` - Default context length (default: 4096)

## Why AstroCoder?

OpenCode is a great tool but lacks proper support for local Ollama 14B models. When using Ollama with larger context windows (8k-32k tokens), OpenCode silently truncates requests because it doesn't set the required `num_ctx` parameter. AstroCoder fixes this by:

1. Detecting Ollama models automatically (`ollama/` or `ollama_chat/` prefixes)
2. Calculating the optimal context size: `(tokens * 1.25) + 8192`
3. Injecting `num_ctx` into all LLM requests automatically

## Development

```bash
# Run tests
cd packages/astrocoder
bun test

# Run typecheck
bun run typecheck
```

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Credits

AstroCoder is based on [OpenCode](https://github.com/anomalyco/opencode) - an excellent AI coding tool. This fork focuses on making local Ollama models work properly, something the original project does not support.