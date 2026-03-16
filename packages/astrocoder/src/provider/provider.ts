import z from "zod"
import os from "os"
import fuzzysort from "fuzzysort"
import { Config } from "../config/config"
import { mapValues, mergeDeep, omit, pickBy, sortBy } from "remeda"
import { NoSuchModelError, type Provider as SDK } from "ai"
import { Log } from "../util/log"
import { BunProc } from "../bun"
import { Hash } from "../util/hash"
import { Plugin } from "../plugin"
import { NamedError } from "@opencode-ai/util/error"
import { ModelsDev } from "./models"
import { Auth } from "../auth"
import { Env } from "../env"
import { Instance } from "../project/instance"
import { Flag } from "../flag/flag"
import { iife } from "@/util/iife"
import { Global } from "../global"
import path from "path"
import { Filesystem } from "../util/filesystem"

// Direct imports for bundled providers
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { LanguageModelV2 } from "@ai-sdk/provider"
import { ProviderTransform } from "./transform"
import { Installation } from "../installation"
import { ModelID, ProviderID } from "./schema"

const timeout = 300_000

export namespace Provider {
  const log = Log.create({ service: "provider" })

  function wrapSSE(res: Response, ms: number, ctl: AbortController) {
    if (typeof ms !== "number" || ms <= 0) return res
    if (!res.body) return res
    if (!res.headers.get("content-type")?.includes("text/event-stream")) return res

    const reader = res.body.getReader()
    const body = new ReadableStream<Uint8Array>({
      async pull(ctrl) {
        const part = await new Promise<Awaited<ReturnType<typeof reader.read>>>((resolve, reject) => {
          const id = setTimeout(() => {
            const err = new Error("SSE read timed out")
            ctl.abort(err)
            void reader.cancel(err)
            reject(err)
          }, ms)

          reader.read().then(
            (part) => {
              clearTimeout(id)
              resolve(part)
            },
            (err) => {
              clearTimeout(id)
              reject(err)
            },
          )
        })

        if (part.done) {
          ctrl.close()
          return
        }

        ctrl.enqueue(part.value)
      },
      async cancel(reason) {
        ctl.abort(reason)
        await reader.cancel(reason)
      },
    })

    return new Response(body, {
      headers: new Headers(res.headers),
      status: res.status,
      statusText: res.statusText,
    })
  }

  function isOllamaModel(modelID: string, providerID?: string): boolean {
    if (providerID === "ollama") return true
    return modelID.startsWith("ollama/") || modelID.startsWith("ollama_chat/")
  }

  function calculateOllamaContext(contextLength: number = 0, extraTokens: number = 8192): number {
    return Math.ceil(contextLength * 1.25) + extraTokens
  }

  async function checkNvidiaGpu(): Promise<boolean> {
    try {
      const result = await BunProc.run(["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"])
      const output = result.stdout.toString().trim()
      // Must have actual GPU name, not just empty
      return output.length > 0 && !output.includes("No devices")
    } catch {
      return false
    }
  }

  async function getOllamaContextLength(): Promise<number> {
    const base = Env.get("OLLAMA_API_BASE") || "http://127.0.0.1:11434"
    const env = Env.get("OLLAMA_CONTEXT_LENGTH")
    if (env) return parseInt(env, 10)
    try {
      const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data = await res.json()
        const model = data.models?.[0]
        if (model?.model_info?.context_length) {
          return model.model_info.context_length
        }
      }
    } catch {}
    return 8192
  }

  async function getGpuStatus(): Promise<"GPU" | "CPU" | ""> {
    try {
      const gpu = await checkNvidiaGpu()
      return gpu ? "GPU" : ""
    } catch {
      return ""
    }
  }

  export async function isGpuAvailable(): Promise<boolean> {
    const status = await getGpuStatus()
    return status === "GPU"
  }

  export function clearGpuCache(): void {
    // No longer caching, kept for API compatibility
  }

  let ollamaStarted = false
  let ollamaStartedByUs = false
  export async function getGpuDisplay(): Promise<string> {
    return await getGpuStatus()
  }

  export async function ensureOllamaRunning(): Promise<boolean> {
    if (ollamaStarted) return true

    const base = Env.get("OLLAMA_API_BASE") || "http://127.0.0.1:11434"
    const url = base.endsWith("/v1") ? base : `${base}/v1`

    try {
      const res = await fetch(`${url}/models`, { method: "GET", signal: AbortSignal.timeout(5000) }).catch(() => null)
      if (res) {
        console.log("[AstroCoder] Ollama already running - using existing instance")
        ollamaStarted = true
        console.log("[AstroCoder] Ollama already running")
        return true
      }
    } catch {
      // Ollama not running
    }

    console.log("[AstroCoder] Starting Ollama automatically...")

    try {
      const proc = Bun.spawn(["ollama", "serve"], {
        stdout: "ignore",
        stderr: "ignore",
        detached: true,
      })
      proc.unref()

      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        try {
          const res = await fetch(`${url}/models`, { method: "GET" }).catch(() => null)
          if (res) {
            ollamaStarted = true
            ollamaStartedByUs = true
            log.info("ollama-started-automatically")
            console.log("[AstroCoder] Ollama ready!")
            return true
          }
        } catch {
          // keep waiting
        }
        console.log("[AstroCoder] Waiting for Ollama...")
      }
    } catch (err) {
      log.error("failed-to-start-ollama", { error: String(err) })
      console.log("[AstroCoder] Failed to start Ollama:", err)
    }

    return false
  }

  export async function stopOllamaIfStarted(): Promise<void> {
    if (!ollamaStarted) return

    log.info("stopping-ollama-started-by-astrocoder")
    console.log("[AstroCoder] Stopping Ollama server...")
    try {
      await BunProc.run(["pkill", "-f", "ollama"])
    } catch {}
    try {
      await BunProc.run(["killall", "ollama"])
    } catch {}
    ollamaStarted = false
  }

  const bundled: Record<string, (options: any) => SDK> = {
    "@ai-sdk/openai-compatible": createOpenAICompatible,
  }

  type CustomModelLoader = (sdk: any, modelID: string, options?: Record<string, any>) => Promise<any>
  type CustomVarsLoader = (options: Record<string, any>) => Record<string, string>
  type CustomLoader = (provider: Info) => Promise<{
    autoload: boolean
    getModel?: CustomModelLoader
    vars?: CustomVarsLoader
    options?: Record<string, any>
    models?: Record<string, any>
  }>

  const custom: Record<string, CustomLoader> = {
    async anthropic() {
      return {
        autoload: false,
        options: {
          headers: {
            "anthropic-beta":
              "claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
          },
        },
      }
    },
    async opencode(input) {
      const key = await (async () => {
        const env = Env.all()
        if (input.env.some((item) => env[item])) return true
        if (await Auth.get(input.id)) return true
        const config = await Config.get()
        if (config.provider?.["opencode"]?.options?.apiKey) return true
        return false
      })()

      if (!key) {
        for (const [key, value] of Object.entries(input.models)) {
          if (value.cost.input === 0) continue
          delete input.models[key]
        }
      }

      return {
        autoload: Object.keys(input.models).length > 0,
        options: key ? {} : { apiKey: "public" },
      }
    },
    ollama: async (input) => {
      await ensureOllamaRunning()
      const base = Env.get("OLLAMA_API_BASE") || "http://127.0.0.1:11434"
      const key = Env.get("OLLAMA_API_KEY") || "not-needed"

      // Fetch available models from local ollama server
      let local: any[] = []
      try {
        const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          const data = await res.json()
          local = data.models ?? []
        }
      } catch {
        // ignore - models will be empty
      }

      // Build models from local ollama
      const models: Record<string, any> = {}
      for (const m of local) {
        const name = m.name // e.g., "registry.ollama.ai/library/qwen2.5-coder-14b-local:latest"
        
        // Extract just the model name (e.g., "qwen2.5-coder-14b-local")
        let modelName = name
        if (name.includes("/library/")) {
          modelName = name.split("/library/")[1]
        }
        if (modelName.endsWith(":latest")) {
          modelName = modelName.replace(":latest", "")
        }
        
        const key = `ollama/${modelName}`
        const context = m.model_info?.context_length || 8192

        models[key] = {
          id: key,
          providerID: "ollama",
          api: {
            id: modelName, // Use cleaned name for API
            url: "",
            npm: "@ai-sdk/openai-compatible",
          },
          name: modelName,
          family: modelName.split(":")[0],
          release_date: "",
          attachment: false,
          reasoning: false,
          temperature: true,
          tool_call: false,
          cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
          limit: { context: context, output: 4096 },
          options: { num_ctx: calculateOllamaContext(context) },
          headers: {},
          status: "active",
          capabilities: {
            temperature: true,
            reasoning: false,
            attachment: false,
            toolcall: false,
            input: { text: true, audio: false, image: false, video: false, pdf: false },
            output: { text: true, audio: false, image: false, video: false, pdf: false },
            interleaved: false,
          },
        }
      }

      return {
        autoload: true,
        options: {
          baseURL: base.endsWith("/v1") ? base : `${base}/v1`,
          apiKey: key,
        },
        models,
      }
    },
  }

  export const Model = z
    .object({
      id: ModelID.zod,
      providerID: ProviderID.zod,
      api: z.object({
        id: z.string(),
        url: z.string(),
        npm: z.string(),
      }),
      name: z.string(),
      family: z.string().optional(),
      capabilities: z.object({
        temperature: z.boolean(),
        reasoning: z.boolean(),
        attachment: z.boolean(),
        toolcall: z.boolean(),
        input: z.object({
          text: z.boolean(),
          audio: z.boolean(),
          image: z.boolean(),
          video: z.boolean(),
          pdf: z.boolean(),
        }),
        output: z.object({
          text: z.boolean(),
          audio: z.boolean(),
          image: z.boolean(),
          video: z.boolean(),
          pdf: z.boolean(),
        }),
        interleaved: z.union([
          z.boolean(),
          z.object({
            field: z.enum(["reasoning_content", "reasoning_details"]),
          }),
        ]),
      }),
      cost: z.object({
        input: z.number(),
        output: z.number(),
        cache: z.object({
          read: z.number(),
          write: z.number(),
        }),
        experimentalOver200K: z
          .object({
            input: z.number(),
            output: z.number(),
            cache: z.object({
              read: z.number(),
              write: z.number(),
            }),
          })
          .optional(),
      }),
      limit: z.object({
        context: z.number(),
        input: z.number().optional(),
        output: z.number(),
      }),
      status: z.enum(["alpha", "beta", "deprecated", "active"]),
      options: z.record(z.string(), z.any()),
      headers: z.record(z.string(), z.string()),
      release_date: z.string(),
      variants: z.record(z.string(), z.record(z.string(), z.any())).optional(),
    })
    .meta({
      ref: "Model",
    })
  export type Model = z.infer<typeof Model>

  export const Info = z
    .object({
      id: ProviderID.zod,
      name: z.string(),
      source: z.enum(["env", "config", "custom", "api"]),
      env: z.string().array(),
      key: z.string().optional(),
      options: z.record(z.string(), z.any()),
      models: z.record(z.string(), Model),
    })
    .meta({
      ref: "Provider",
    })
  export type Info = z.infer<typeof Info>

  function fromModelsDevModel(provider: ModelsDev.Provider, model: ModelsDev.Model): Model {
    const m: Model = {
      id: ModelID.make(model.id),
      providerID: ProviderID.make(provider.id),
      name: model.name,
      family: model.family,
      api: {
        id: model.id,
        url: model.provider?.api ?? provider.api!,
        npm: model.provider?.npm ?? provider.npm ?? "@ai-sdk/openai-compatible",
      },
      status: model.status ?? "active",
      headers: model.headers ?? {},
      options: model.options ?? {},
      cost: {
        input: model.cost?.input ?? 0,
        output: model.cost?.output ?? 0,
        cache: {
          read: model.cost?.cache_read ?? 0,
          write: model.cost?.cache_write ?? 0,
        },
        experimentalOver200K: model.cost?.context_over_200k
          ? {
              cache: {
                read: model.cost.context_over_200k.cache_read ?? 0,
                write: model.cost.context_over_200k.cache_write ?? 0,
              },
              input: model.cost.context_over_200k.input,
              output: model.cost.context_over_200k.output,
            }
          : undefined,
      },
      limit: {
        context: model.limit.context,
        input: model.limit.input,
        output: model.limit.output,
      },
      capabilities: {
        temperature: model.temperature,
        reasoning: model.reasoning,
        attachment: model.attachment,
        toolcall: isOllamaModel(model.id, provider.id) ? false : model.tool_call,
        input: {
          text: model.modalities?.input?.includes("text") ?? false,
          audio: model.modalities?.input?.includes("audio") ?? false,
          image: model.modalities?.input?.includes("image") ?? false,
          video: model.modalities?.input?.includes("video") ?? false,
          pdf: model.modalities?.input?.includes("pdf") ?? false,
        },
        output: {
          text: model.modalities?.output?.includes("text") ?? false,
          audio: model.modalities?.output?.includes("audio") ?? false,
          image: model.modalities?.output?.includes("image") ?? false,
          video: model.modalities?.output?.includes("video") ?? false,
          pdf: model.modalities?.output?.includes("pdf") ?? false,
        },
        interleaved: model.interleaved ?? false,
      },
      release_date: model.release_date,
      variants: {},
    }

    m.variants = mapValues(ProviderTransform.variants(m), (v) => v)

    return m
  }

  export function fromModelsDevProvider(provider: ModelsDev.Provider): Info {
    return {
      id: ProviderID.make(provider.id),
      source: "custom",
      name: provider.name,
      env: provider.env ?? [],
      options: {},
      models: mapValues(provider.models, (model) => fromModelsDevModel(provider, model)),
    }
  }

  const state = Instance.state(async () => {
    using _ = log.time("state")
    const config = await Config.get()
    const dev = await ModelsDev.get()
    const database = mapValues(dev, fromModelsDevProvider)

    const disabled = new Set(config.disabled_providers ?? [])
    const enabled = config.enabled_providers ? new Set(config.enabled_providers) : null

    function isProviderAllowed(providerID: ProviderID): boolean {
      if (enabled && !enabled.has(providerID)) return false
      if (disabled.has(providerID)) return false
      return true
    }

    const providers: { [providerID: string]: Info } = {}
    const languages = new Map<string, LanguageModelV2>()
    const loaders: {
      [providerID: string]: CustomModelLoader
    } = {}
    const vars: {
      [providerID: string]: CustomVarsLoader
    } = {}
    const sdk = new Map<string, SDK>()

    log.info("init")

    // Add Ollama provider manually since models come from local server
    ;(database as any)["ollama"] = {
      id: ProviderID.ollama,
      name: "Ollama",
      env: [],
      models: {},
      source: "custom",
      options: {},
    }

    const providersConfig = Object.entries(config.provider ?? {})

    // Add GitHub Copilot Enterprise provider that inherits from GitHub Copilot
    if (database["github-copilot"]) {
      const copilot = database["github-copilot"]
      database["github-copilot-enterprise"] = {
        ...copilot,
        id: ProviderID.githubCopilotEnterprise,
        name: "GitHub Copilot Enterprise",
        models: mapValues(copilot.models, (model) => ({
          ...model,
          providerID: ProviderID.githubCopilotEnterprise,
        })),
      }
    }

    function mergeProvider(providerID: ProviderID, provider: Partial<Info>) {
      const existing = providers[providerID]
      if (existing) {
        // @ts-expect-error
        providers[providerID] = mergeDeep(existing, provider)
        return
      }
      const match = database[providerID]
      if (!match) return
      // @ts-expect-error
      providers[providerID] = mergeDeep(match, provider)
    }

    // extend database from config
    for (const [providerID, provider] of providersConfig) {
      const existing = database[providerID]
      const parsed: Info = {
        id: ProviderID.make(providerID),
        name: provider.name ?? existing?.name ?? providerID,
        env: provider.env ?? existing?.env ?? [],
        options: mergeDeep(existing?.options ?? {}, provider.options ?? {}),
        source: "config",
        models: existing?.models ?? {},
      }

      for (const [modelID, model] of Object.entries(provider.models ?? {})) {
        const existing = parsed.models[model.id ?? modelID]
        const name = iife(() => {
          if (model.name) return model.name
          if (model.id && model.id !== modelID) return modelID
          return existing?.name ?? modelID
        })
        const modelObj: Model = {
          id: ModelID.make(modelID),
          api: {
            id: model.id ?? existing?.api.id ?? modelID,
            npm:
              model.provider?.npm ??
              provider.npm ??
              existing?.api.npm ??
              dev[providerID]?.npm ??
              "@ai-sdk/openai-compatible",
            url: model.provider?.api ?? provider?.api ?? existing?.api.url ?? dev[providerID]?.api,
          },
          status: model.status ?? existing?.status ?? "active",
          name,
          providerID: ProviderID.make(providerID),
          capabilities: {
            temperature: model.temperature ?? existing?.capabilities.temperature ?? false,
            reasoning: model.reasoning ?? existing?.capabilities.reasoning ?? false,
            attachment: model.attachment ?? existing?.capabilities.attachment ?? false,
            toolcall: isOllamaModel(modelID, providerID) ? false : (model.tool_call ?? existing?.capabilities.toolcall ?? true),
            input: {
              text: model.modalities?.input?.includes("text") ?? existing?.capabilities.input.text ?? true,
              audio: model.modalities?.input?.includes("audio") ?? existing?.capabilities.input.audio ?? false,
              image: model.modalities?.input?.includes("image") ?? existing?.capabilities.input.image ?? false,
              video: model.modalities?.input?.includes("video") ?? existing?.capabilities.input.video ?? false,
              pdf: model.modalities?.input?.includes("pdf") ?? existing?.capabilities.input.pdf ?? false,
            },
            output: {
              text: model.modalities?.output?.includes("text") ?? existing?.capabilities.output.text ?? true,
              audio: model.modalities?.output?.includes("audio") ?? existing?.capabilities.output.audio ?? false,
              image: model.modalities?.output?.includes("image") ?? existing?.capabilities.output.image ?? false,
              video: model.modalities?.output?.includes("video") ?? existing?.capabilities.output.video ?? false,
              pdf: model.modalities?.output?.includes("pdf") ?? existing?.capabilities.output.pdf ?? false,
            },
            interleaved: model.interleaved ?? false,
          },
          cost: {
            input: model?.cost?.input ?? existing?.cost?.input ?? 0,
            output: model?.cost?.output ?? existing?.cost?.output ?? 0,
            cache: {
              read: model?.cost?.cache_read ?? existing?.cost?.cache.read ?? 0,
              write: model?.cost?.cache_write ?? existing?.cost?.cache.write ?? 0,
            },
          },
          options: mergeDeep(existing?.options ?? {}, model.options ?? {}),
          limit: {
            context: model.limit?.context ?? existing?.limit?.context ?? 0,
            output: model.limit?.output ?? existing?.limit?.output ?? 0,
          },
          headers: mergeDeep(existing?.headers ?? {}, model.headers ?? {}),
          family: model.family ?? existing?.family ?? "",
          release_date: model.release_date ?? existing?.release_date ?? "",
          variants: {},
        }
        const merged = mergeDeep(ProviderTransform.variants(modelObj), model.variants ?? {})
        modelObj.variants = mapValues(
          pickBy(merged, (v) => !v.disabled),
          (v) => omit(v, ["disabled"]),
        )
        parsed.models[modelID] = modelObj
      }
      database[providerID] = parsed
    }

    // load env
    const envVars = Env.all()
    for (const [id, provider] of Object.entries(database)) {
      const providerID = ProviderID.make(id)
      if (disabled.has(providerID)) continue
      const key = provider.env.map((item) => envVars[item]).find(Boolean)
      if (!key) continue
      mergeProvider(providerID, {
        source: "env",
        key: provider.env.length === 1 ? key : undefined,
      })
    }

    // load apikeys
    for (const [id, provider] of Object.entries(await Auth.all())) {
      const providerID = ProviderID.make(id)
      if (disabled.has(providerID)) continue
      if (provider.type === "api") {
        mergeProvider(providerID, {
          source: "api",
          key: provider.key,
        })
      }
    }

    for (const plugin of await Plugin.list()) {
      if (!plugin.auth) continue
      const providerID = ProviderID.make(plugin.auth.provider)
      if (disabled.has(providerID)) continue

      // For github-copilot plugin, check if auth exists for either github-copilot or github-copilot-enterprise
      let authExists = false
      const auth = await Auth.get(providerID)
      if (auth) authExists = true

      // Special handling for github-copilot: also check for enterprise auth
      if (providerID === ProviderID.githubCopilot && !authExists) {
        const enterpriseAuth = await Auth.get("github-copilot-enterprise")
        if (enterpriseAuth) authExists = true
      }

      if (!authExists) continue
      if (!plugin.auth.loader) continue

      // Load for the main provider if auth exists
      if (auth) {
        const options = await plugin.auth.loader(() => Auth.get(providerID) as any, database[plugin.auth.provider])
        const opts = options ?? {}
        const patch: Partial<Info> = providers[providerID] ? { options: opts } : { source: "custom", options: opts }
        mergeProvider(providerID, patch)
      }

      // If this is github-copilot plugin, also register for github-copilot-enterprise if auth exists
      if (providerID === ProviderID.githubCopilot) {
        const enterpriseProviderID = ProviderID.githubCopilotEnterprise
        if (!disabled.has(enterpriseProviderID)) {
          const enterpriseAuth = await Auth.get(enterpriseProviderID)
          if (enterpriseAuth) {
            const enterpriseOptions = await plugin.auth.loader(
              () => Auth.get(enterpriseProviderID) as any,
              database[enterpriseProviderID],
            )
            const opts = enterpriseOptions ?? {}
            const patch: Partial<Info> = providers[enterpriseProviderID]
              ? { options: opts }
              : { source: "custom", options: opts }
            mergeProvider(enterpriseProviderID, patch)
          }
        }
      }
    }

    for (const [id, fn] of Object.entries(custom)) {
      const providerID = ProviderID.make(id)
      if (disabled.has(providerID)) continue
      const data = database[providerID]
      if (!data) {
        log.error("Provider does not exist in model list " + providerID)
        continue
      }
      const result = await fn(data)
      if (result && (result.autoload || providers[providerID])) {
        if (result.getModel) loaders[providerID] = result.getModel
        if (result.vars) vars[providerID] = result.vars
        const opts = result.options ?? {}
        const models = result.models
        const patch: Partial<Info> = providers[providerID]
          ? { ...(models ? { models } : {}), options: opts }
          : { source: "custom", ...(models ? { models } : {}), options: opts }
        mergeProvider(providerID, patch)
      }
    }

    // load config
    for (const [id, provider] of providersConfig) {
      const providerID = ProviderID.make(id)
      const partial: Partial<Info> = { source: "config" }
      if (provider.env) partial.env = provider.env
      if (provider.name) partial.name = provider.name
      if (provider.options) partial.options = provider.options
      mergeProvider(providerID, partial)
    }

    for (const [id, provider] of Object.entries(providers)) {
      const providerID = ProviderID.make(id)
      if (!isProviderAllowed(providerID)) {
        delete providers[providerID]
        continue
      }

      const configProvider = config.provider?.[providerID]

      for (const [modelID, model] of Object.entries(provider.models)) {
        model.api.id = model.api.id ?? model.id ?? modelID
        if (
          modelID === "gpt-5-chat-latest" ||
          (providerID === ProviderID.openrouter && modelID === "openai/gpt-5-chat")
        )
          delete provider.models[modelID]
        if (model.status === "alpha" && !Flag.OPENCODE_ENABLE_EXPERIMENTAL_MODELS) delete provider.models[modelID]
        if (model.status === "deprecated") delete provider.models[modelID]
        if (
          (configProvider?.blacklist && configProvider.blacklist.includes(modelID)) ||
          (configProvider?.whitelist && !configProvider.whitelist.includes(modelID))
        )
          delete provider.models[modelID]

        model.variants = mapValues(ProviderTransform.variants(model), (v) => v)

        // Filter out disabled variants from config
        const configVariants = configProvider?.models?.[modelID]?.variants
        if (configVariants && model.variants) {
          const merged = mergeDeep(model.variants, configVariants)
          model.variants = mapValues(
            pickBy(merged, (v) => !v.disabled),
            (v) => omit(v, ["disabled"]),
          )
        }
      }

      if (Object.keys(provider.models).length === 0) {
        delete providers[providerID]
        continue
      }

      log.info("found", { providerID })
    }

    return {
      models: languages,
      providers,
      sdk,
      loaders,
      vars,
    }
  })

  export async function list() {
    return state().then((state) => state.providers)
  }

  async function getSDK(model: Model) {
    try {
      using _ = log.time("getSDK", {
        providerID: model.providerID,
      })
      const s = await state()
      const provider = s.providers[model.providerID]
      const options = { ...provider.options }

      if (model.providerID === "google-vertex" && !model.api.npm.includes("@ai-sdk/openai-compatible")) {
        delete options.fetch
      }

      if (model.api.npm.includes("@ai-sdk/openai-compatible") && options["includeUsage"] !== false) {
        options["includeUsage"] = true
      }

      if (model.providerID === "ollama" || isOllamaModel(model.id)) {
        const env = Env.get("OLLAMA_CONTEXT_LENGTH")
        const context = model.limit.context || (env ? parseInt(env, 10) : 4096)
        if (!options["num_ctx"]) {
          options["num_ctx"] = calculateOllamaContext(context)
        }
        log.info("ollama-context", { modelId: model.id, numCtx: options["num_ctx"] })
      }

      const url = iife(() => {
        let url =
          typeof options["baseURL"] === "string" && options["baseURL"] !== "" ? options["baseURL"] : model.api.url
        if (!url) return

        // some models/providers have variable urls, ex: "https://${AZURE_RESOURCE_NAME}.services.ai.azure.com/anthropic/v1"
        // We track this in models.dev, and then when we are resolving the baseURL
        // we need to string replace that literal: "${AZURE_RESOURCE_NAME}"
        const loader = s.vars[model.providerID]
        if (loader) {
          const v = loader(options)
          for (const [key, value] of Object.entries(v)) {
            const field = "${" + key + "}"
            url = url.replaceAll(field, value)
          }
        }

        url = url.replace(/\$\{([^}]+)\}/g, (item, key) => {
          const val = Env.get(String(key))
          return val ?? item
        })
        return url
      })

      if (url !== undefined) options["baseURL"] = url
      if (options["apiKey"] === undefined && provider.key) options["apiKey"] = provider.key
      if (model.headers)
        options["headers"] = {
          ...options["headers"],
          ...model.headers,
        }

      const key = Hash.fast(JSON.stringify({ providerID: model.providerID, npm: model.api.npm, options }))
      const existing = s.sdk.get(key)
      if (existing) return existing

      const custom = options["fetch"]
      const chunk = options["chunkTimeout"] || timeout
      delete options["chunkTimeout"]

      options["fetch"] = async (input: any, init?: BunFetchRequestInit) => {
        // Preserve custom fetch if it exists, wrap it with timeout logic
        const fetchFn = custom ?? fetch
        const opts = init ?? {}
        const ctl = typeof chunk === "number" && chunk > 0 ? new AbortController() : undefined
        const signals: AbortSignal[] = []

        if (opts.signal) signals.push(opts.signal)
        if (ctl) signals.push(ctl.signal)
        if (options["timeout"] !== undefined && options["timeout"] !== null && options["timeout"] !== false)
          signals.push(AbortSignal.timeout(options["timeout"]))

        const combined = signals.length === 0 ? null : signals.length === 1 ? signals[0] : AbortSignal.any(signals)
        if (combined) opts.signal = combined

        // Strip openai itemId metadata following what codex does
        // Codex uses #[serde(skip_serializing)] on id fields for all item types:
        // Message, Reasoning, FunctionCall, LocalShellCall, CustomToolCall, WebSearchCall
        // IDs are only re-attached for Azure with store=true
        if (model.api.npm === "@ai-sdk/openai" && opts.body && opts.method === "POST") {
          const body = JSON.parse(opts.body as string)
          const azure = model.providerID.includes("azure")
          const keepIds = azure && body.store === true
          if (!keepIds && Array.isArray(body.input)) {
            for (const item of body.input) {
              if ("id" in item) {
                delete item.id
              }
            }
            opts.body = JSON.stringify(body)
          }
        }

        const res = await fetchFn(input, {
          ...opts,
          // @ts-ignore see here: https://github.com/oven-sh/bun/issues/16682
          timeout: false,
        })

        if (!ctl) return res
        return wrapSSE(res, chunk, ctl)
      }

      const fn = bundled[model.api.npm]
      if (fn) {
        log.info("using bundled provider", { providerID: model.providerID, pkg: model.api.npm })
        const loaded = fn({
          name: model.providerID,
          ...options,
        })
        s.sdk.set(key, loaded)
        return loaded as SDK
      }

      let installedPath: string
      if (!model.api.npm.startsWith("file://")) {
        installedPath = await BunProc.install(model.api.npm, "latest")
      } else {
        log.info("loading local provider", { pkg: model.api.npm })
        installedPath = model.api.npm
      }

      const mod = await import(installedPath)

      const creator = mod[Object.keys(mod).find((key) => key.startsWith("create"))!]
      const loaded = creator({
        name: model.providerID,
        ...options,
      })
      s.sdk.set(key, loaded)
      return loaded as SDK
    } catch (e) {
      throw new InitError({ providerID: model.providerID }, { cause: e })
    }
  }

  export async function getProvider(providerID: ProviderID) {
    return state().then((s) => s.providers[providerID])
  }

  export async function getModel(providerID: ProviderID, modelID: ModelID) {
    const s = await state()
    const provider = s.providers[providerID]
    if (!provider) {
      const availableProviders = Object.keys(s.providers)
      const matches = fuzzysort.go(providerID, availableProviders, { limit: 3, threshold: -10000 })
      const suggestions = matches.map((m) => m.target)
      throw new ModelNotFoundError({ providerID, modelID, suggestions })
    }

    const info = provider.models[modelID]
    if (!info) {
      const availableModels = Object.keys(provider.models)
      const matches = fuzzysort.go(modelID, availableModels, { limit: 3, threshold: -10000 })
      const suggestions = matches.map((m) => m.target)
      throw new ModelNotFoundError({ providerID, modelID, suggestions })
    }
    return info
  }

  export async function getLanguage(model: Model): Promise<LanguageModelV2> {
    const s = await state()
    const key = `${model.providerID}/${model.id}`
    if (s.models.has(key)) return s.models.get(key)!

    const provider = s.providers[model.providerID]
    const sdk = await getSDK(model)

    try {
      const language = s.loaders[model.providerID]
        ? await s.loaders[model.providerID](sdk, model.api.id, provider.options)
        : sdk.languageModel(model.api.id)
      s.models.set(key, language)
      return language
    } catch (e) {
      if (e instanceof NoSuchModelError)
        throw new ModelNotFoundError(
          {
            modelID: model.id,
            providerID: model.providerID,
          },
          { cause: e },
        )
      throw e
    }
  }

  export async function closest(providerID: ProviderID, query: string[]) {
    const s = await state()
    const provider = s.providers[providerID]
    if (!provider) return undefined
    for (const item of query) {
      for (const modelID of Object.keys(provider.models)) {
        if (modelID.includes(item))
          return {
            providerID,
            modelID,
          }
      }
    }
  }

  export async function getSmallModel(providerID: ProviderID) {
    const cfg = await Config.get()

    if (cfg.small_model) {
      const parsed = parseModel(cfg.small_model)
      return getModel(parsed.providerID, parsed.modelID)
    }

    const provider = await state().then((state) => state.providers[providerID])
    if (provider) {
      let priority = [
        "claude-haiku-4-5",
        "claude-haiku-4.5",
        "3-5-haiku",
        "3.5-haiku",
        "gemini-3-flash",
        "gemini-2.5-flash",
        "gpt-5-nano",
      ]
      if (providerID.startsWith("opencode")) {
        priority = ["gpt-5-nano"]
      }
      if (providerID.startsWith("github-copilot")) {
        // prioritize free models for github copilot
        priority = ["gpt-5-mini", "claude-haiku-4.5", ...priority]
      }
      for (const item of priority) {
        if (providerID === ProviderID.amazonBedrock) {
          const prefixes = ["global.", "us.", "eu."]
          const candidates = Object.keys(provider.models).filter((m) => m.includes(item))

          // Model selection priority:
          // 1. global. prefix (works everywhere)
          // 2. User's region prefix (us., eu.)
          // 3. Unprefixed model
          const match = candidates.find((m) => m.startsWith("global."))
          if (match) return getModel(providerID, ModelID.make(match))

          const region = provider.options?.region
          if (region) {
            const prefix = region.split("-")[0]
            if (prefix === "us" || prefix === "eu") {
              const match = candidates.find((m) => m.startsWith(`${prefix}.`))
              if (match) return getModel(providerID, ModelID.make(match))
            }
          }

          const unprefixed = candidates.find((m) => !prefixes.some((p) => m.startsWith(p)))
          if (unprefixed) return getModel(providerID, ModelID.make(unprefixed))
          return
        }
        for (const model of Object.keys(provider.models)) {
          if (model.includes(item)) return getModel(providerID, ModelID.make(model))
        }
      }
    }

    return undefined
  }

  const priority = ["gpt-5", "claude-sonnet-4", "big-pickle", "gemini-3-pro"]
  export function sort<T extends { id: string }>(models: T[]) {
    return sortBy(
      models,
      [(model) => priority.findIndex((filter) => model.id.includes(filter)), "desc"],
      [(model) => (model.id.includes("latest") ? 0 : 1), "asc"],
      [(model) => model.id, "desc"],
    )
  }

  export async function defaultModel() {
    const cfg = await Config.get()
    if (cfg.model) return parseModel(cfg.model)

    const providers = await list()
    const ollama = Object.fromEntries(
      Object.entries(providers).filter(([id]) => id === "ollama" || id.startsWith("ollama/")),
    )
    const recent = (await Filesystem.readJson<{ recent?: { providerID: ProviderID; modelID: ModelID }[] }>(
      path.join(Global.Path.state, "model.json"),
    )
      .then((x) => (Array.isArray(x.recent) ? x.recent : []))
      .catch(() => [])) as { providerID: ProviderID; modelID: ModelID }[]
    for (const entry of recent) {
      const provider = ollama[entry.providerID]
      if (!provider) continue
      if (!provider.models[entry.modelID]) continue
      return { providerID: entry.providerID, modelID: entry.modelID }
    }

    const provider = Object.values(ollama).find((p) => !cfg.provider || Object.keys(cfg.provider).includes(p.id))
    if (!provider) throw new Error("no providers found")
    const [model] = sort(Object.values(provider.models))
    if (!model) throw new Error("no models found")
    return {
      providerID: provider.id,
      modelID: model.id,
    }
  }

  export function parseModel(model: string) {
    const [providerID, ...rest] = model.split("/")
    return {
      providerID: ProviderID.make(providerID),
      modelID: ModelID.make(rest.join("/")),
    }
  }

  export const ModelNotFoundError = NamedError.create(
    "ProviderModelNotFoundError",
    z.object({
      providerID: ProviderID.zod,
      modelID: ModelID.zod,
      suggestions: z.array(z.string()).optional(),
    }),
  )

  export const InitError = NamedError.create(
    "ProviderInitError",
    z.object({
      providerID: ProviderID.zod,
    }),
  )
}
