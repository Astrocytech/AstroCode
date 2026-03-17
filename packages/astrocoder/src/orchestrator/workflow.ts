import { spawn } from "child_process"
import path from "path"
import fs from "fs/promises"

const PROJECT_ROOT = "/home/njonji/Desktop/ASTROCYTECH/AstroCode"

interface OllamaChatResponse {
  message?: { content?: string }
}

export class WorkflowEngine {
  private modelID: string
  private history: string[]
  private quiet: boolean

  constructor(modelID = "llama3.1:8b-instruct-q4_K_M", quiet = false) {
    this.modelID = modelID
    this.history = []
    this.quiet = quiet
  }

  private async callOllama(prompt: string): Promise<string> {
    const baseUrl = "http://localhost:11434"

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.modelID,
        messages: [
          { role: "system", content: "You are an autonomous coding assistant. Write working Python code to accomplish tasks. Don't ask questions. Don't discuss. Read the provided file contents, understand them, then write code that uses those functions." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`)
    }

    const data = await response.json() as OllamaChatResponse
    return data.message?.content || ""
  }

  private async runBash(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      const proc = spawn("/bin/bash", ["-c", command], {
        cwd: PROJECT_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      })

      let stdout = ""
      let stderr = ""

      proc.stdout?.on("data", (d) => { stdout += d.toString() })
      proc.stderr?.on("data", (d) => { stderr += d.toString() })

      proc.on("close", (code) => {
        resolve({ stdout, stderr, exitCode: code || 0 })
      })

      proc.on("error", (err) => {
        resolve({ stdout: "", stderr: err.message, exitCode: 1 })
      })
    })
  }

  private extractFilePaths(text: string): string[] {
    const paths: string[] = []
    const regex = /(?:^|[^\w\/])(\/[\w\-.\/]+(?:\.\w+)?)/g
    let match
    while ((match = regex.exec(text)) !== null) {
      const p = match[1]
      if (p.includes('.py') || p.includes('.txt') || p.includes('.js') || p.includes('.ts')) {
        paths.push(p)
      }
    }
    return [...new Set(paths)]
  }

  private async readFileContent(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return content
    } catch {
      return null
    }
  }

  private extractCode(output: string): string[] {
    const codeBlocks: string[] = []
    const blockRegex = /```(?:python|py)?\n?([\s\S]*?)```/g
    let match
    while ((match = blockRegex.exec(output)) !== null) {
      codeBlocks.push(match[1].trim())
    }
    if (codeBlocks.length === 0 && output.includes('import ')) {
      codeBlocks.push(output.trim())
    }
    return codeBlocks
  }

  async run(userPrompt: string, sessionHistory: string[] = []): Promise<{ success: boolean; finalSummary: string }> {
    this.history = sessionHistory || []
    const maxAttempts = 5

    const filePaths = this.extractFilePaths(userPrompt)
    let fileContents = ""
    
    for (const fp of filePaths) {
      const content = await this.readFileContent(fp)
      if (content) {
        fileContents += `\n\n=== FILE: ${fp} ===\n${content}\n`
      }
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const context = this.history.length > 0 
        ? `\nPrevious attempts failed:\n${this.history.join('\n')}\n\n`
        : ""

      const prompt = `${fileContents}
${context}TASK: ${userPrompt}

Read the file contents above. Now write a Python script that accomplishes this task. The script should import and use functions from the provided files. Output ONLY the code in a python code block. No explanation. No discussion. Just code.`

      const output = await this.callOllama(prompt)
      
      const codeBlocks = this.extractCode(output)
      
      if (codeBlocks.length === 0) {
        this.history.push(`Attempt ${attempt}: No code generated, got: ${output.slice(0, 200)}`)
        continue
      }

      const scriptPath = path.join(PROJECT_ROOT, `temp_workflow_${attempt}.py`)
      
      const combinedCode = codeBlocks.join('\n\n')
      
      const codeWithShebang = `#!/usr/bin/env python3\nimport sys\nsys.path.insert(0, '/home/njonji/Desktop/IZBR')\n${combinedCode}`
      
      await Bun.write(scriptPath, codeWithShebang)

      const runResult = await this.runBash(`python3 "${scriptPath}" 2>&1`)
      
      let results = `Code executed:\n${combinedCode.slice(0, 1000)}\n\nOutput:\n${runResult.stdout || runResult.stderr}`

      const outputFile = filePaths.find(p => p.endsWith('.txt')) || 'output.txt'
      const fileCheck = await this.runBash(`test -f "${outputFile}" && wc -l "${outputFile}" || echo "NO_FILE"`)

      const verifyPrompt = `Task was: "${userPrompt}"

Code stdout: ${runResult.stdout.slice(0, 500)}
Code stderr: ${runResult.stderr.slice(0, 500)}
File check: ${fileCheck.stdout}

Is this task COMPLETED? Reply ONLY YES or NO.`
      
      const verification = await this.callOllama(verifyPrompt)
      
      if (verification.toUpperCase().includes("YES")) {
        await this.runBash(`rm -f "${scriptPath}"`)
        return { 
          success: true, 
          finalSummary: `Task completed: ${userPrompt}\n\n${results.slice(0, 3000)}` 
        }
      }

      this.history.push(`Attempt ${attempt} failed: ${(runResult.stderr || runResult.stdout).slice(0, 200)}`)
      await this.runBash(`rm -f "${scriptPath}"`)
    }

    return { 
      success: false, 
      finalSummary: `Failed after ${maxAttempts} attempts.\n\nHistory:\n${this.history.join('\n')}` 
    }
  }
}

export async function runWorkflow(userPrompt: string, sessionHistory: string[] = []): Promise<{ success: boolean; finalSummary: string }> {
  const engine = new WorkflowEngine()
  return await engine.run(userPrompt, sessionHistory)
}
