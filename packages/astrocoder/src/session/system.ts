import { Ripgrep } from "../file/ripgrep"

import { Instance } from "../project/instance"

import PROMPT_ANTHROPIC from "./prompt/anthropic.txt"
import PROMPT_ANTHROPIC_WITHOUT_TODO from "./prompt/qwen.txt"
import PROMPT_BEAST from "./prompt/beast.txt"
import PROMPT_GEMINI from "./prompt/gemini.txt"
import PROMPT_OLLAMA from "./prompt/ollama.txt"
import PROMPT_OLLAMA_SMALL from "./prompt/ollama-small.txt"

import PROMPT_CODEX from "./prompt/codex_header.txt"
import PROMPT_TRINITY from "./prompt/trinity.txt"
import type { Provider } from "@/provider/provider"
import type { Agent } from "@/agent/agent"
import { PermissionNext } from "@/permission/next"
import { Skill } from "@/skill"

function isSmallModel(modelID: string): boolean {
  const id = modelID.toLowerCase()
  return id.includes("3b") || id.includes("1b") || id.includes("0.5b") || 
         id.includes("q2_") || id.includes("q3_") || id.includes("q4_0") ||
         id.includes("-1b") || id.includes("-3b")
}

export namespace SystemPrompt {
  export function instructions() {
    return PROMPT_CODEX.trim()
  }

  export function provider(model: Provider.Model) {
    const isOllama = model.providerID === "ollama" || model.id.startsWith("ollama/") || model.id.startsWith("ollama_chat/")
    if (isOllama) {
      // Use simplified prompt for small models
      if (isSmallModel(model.id)) {
        return [PROMPT_OLLAMA_SMALL]
      }
      return [PROMPT_OLLAMA]
    }
    if (model.api.id.includes("gpt-5")) return [PROMPT_CODEX]
    if (model.api.id.includes("gpt-") || model.api.id.includes("o1") || model.api.id.includes("o3"))
      return [PROMPT_BEAST]
    if (model.api.id.includes("gemini-")) return [PROMPT_GEMINI]
    if (model.api.id.includes("claude")) return [PROMPT_ANTHROPIC]
    if (model.api.id.toLowerCase().includes("trinity")) return [PROMPT_TRINITY]
    return [PROMPT_ANTHROPIC_WITHOUT_TODO]
  }

  export async function environment(model: Provider.Model) {
    const project = Instance.project
    
    // Small models get minimal environment info
    if (isSmallModel(model.id)) {
      return [
        `cwd: ${Instance.directory}`,
        `root: ${Instance.worktree}`,
      ]
    }
    
    return [
      [
        `You are powered by the model named ${model.api.id}. The exact model ID is ${model.providerID}/${model.api.id}`,
        `Here is some useful information about the environment you are running in:`,
        `<env>`,
        `  Working directory: ${Instance.directory}`,
        `  Workspace root folder: ${Instance.worktree}`,
        `  Is directory a git repo: ${project.vcs === "git" ? "yes" : "no"}`,
        `  Platform: ${process.platform}`,
        `  Today's date: ${new Date().toDateString()}`,
        `</env>`,
        `<directories>`,
        `  ${
          project.vcs === "git" && false
            ? await Ripgrep.tree({
                cwd: Instance.directory,
                limit: 50,
              })
            : ""
        }`,
        `</directories>`,
      ].join("\n"),
    ]
  }

  export async function skills(agent: Agent.Info, modelID?: string) {
    // Skip skills for small models - they don't need specialized instructions
    if (modelID && isSmallModel(modelID)) {
      return undefined
    }
    
    if (PermissionNext.disabled(["skill"], agent.permission).has("skill")) return

    const list = await Skill.available(agent)

    return [
      "Skills provide specialized instructions and workflows for specific tasks.",
      "Use the skill tool to load a skill when a task matches its description.",
      // the agents seem to ingest the information about skills a bit better if we present a more verbose
      // version of them here and a less verbose version in tool description, rather than vice versa.
      Skill.fmt(list, { verbose: true }),
    ].join("\n")
  }
}
