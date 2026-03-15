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

While OpenCode does not support local Ollama 14B models out of the box (it lacks automatic context window management), AstroCoder handles this automatically. It calculates and sets the optimal `num_ctx` parameter for Ollama models.

## Prerequisites

1. **Ollama installed and running** - Download from https://ollama.ai
2. **A model pulled** - Run `ollama pull llama3.1` or your preferred model

```bash
# Start Ollama (if not already running)
ollama serve

# Pull a model (example: Llama 3.1)
ollama pull llama3.1

# Check available models
ollama list
```

## Quick Start

### Option 1: No Config Required (Recommended)

Just run AstroCoder - it will automatically detect and use your running Ollama instance:

```bash
cd packages/astrocoder

# Build first (only needed once)
bun run build

# Run - uses Ollama automatically if running
./dist/astrocoder-linux-x64/bin/opencode
```

That's it! AstroCoder will:
1. Find your running Ollama at http://127.0.0.1:11434
2. Auto-detect your installed models
3. Use the first available model
4. Automatically set the correct context size (`num_ctx`) for 14B models

### Option 2: Specify a Model

If you want to use a specific model, create a minimal config in your project directory:

**File: `astrocoder.json`**
```json
{
  "model": "ollama/llama3.1"
}
```

Then run:
```bash
./dist/astrocoder-linux-x64/bin/opencode --model ollama/llama3.1
```

### Option 3: Full Configuration

If you need to customize Ollama settings:

**File: `astrocoder.json`**
```json
{
  "model": "ollama/llama3.1",
  "provider": {
    "ollama": {
      "options": {
        "baseURL": "http://127.0.0.1:11434/v1",
        "apiKey": "not-needed"
      }
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_API_BASE` | http://127.0.0.1:11434 | Ollama server URL |
| `OLLAMA_API_KEY` | not-needed | API key (usually not needed) |
| `OLLAMA_CONTEXT_LENGTH` | 4096 | Default context length |

## Troubleshooting

### "No providers found" error
- Make sure Ollama is running: `ollama serve`
- Check Ollama is accessible: `curl http://127.0.0.1:11434/api/tags`

### Model not found
- Pull the model first: `ollama pull llama3.1`
- List installed models: `ollama list`

## Development

```bash
# Run tests
cd packages/astrocoder
bun test

# Run in development mode
bun run dev

# Run typecheck
bun run typecheck
```

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Credits

AstroCoder is based on [OpenCode](https://github.com/anomalyco/opencode) - an excellent AI coding tool. This fork focuses on making local Ollama models work properly.