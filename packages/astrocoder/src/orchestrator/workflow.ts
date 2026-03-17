import { spawn } from "child_process"

const PROJECT_ROOT = "/home/njonji/Desktop/ASTROCYTECH/AstroCode"
const SCAFFOLDING = `
SYSTEM_ENVIRONMENT: Linux (Ubuntu)
WORKING_DIRECTORY: ${PROJECT_ROOT}
ROLE: Linux System Expert
STRICT_MODE: Output only standard Bash syntax.
`

interface OllamaChatResponse {
  message?: { content?: string }
}

export class WorkflowEngine {
  private modelID: string
  private quiet: boolean

  constructor(modelID = "llama3.1:8b-instruct-q4_K_M", quiet = true) {
    this.modelID = modelID
    this.quiet = quiet
  }

  private log(...args: any[]) {
    if (!this.quiet) this.log(...args)
  }

  private async callOllama(prompt: string): Promise<string> {
    this.log("Workflow: calling Ollama...")
    const baseUrl = "http://localhost:11434"

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.modelID,
        messages: [
          { role: "system", content: "You are AstroCoder. Be concise and practical." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
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

  private isDestructive(command: string): boolean {
    const destructivePatterns = [
      /rm\s+-?[rf]/,
      /rmdir/,
      /mv\s+.*\s+.*\s+\//,
      /cp\s+.*\s+\/\s+/,
      /dd\s+/,
      /mkfs/,
      />\s*\/dev\//,
      /chmod\s+[0-7]{3,4}\s+\//,
    ]
    const cmd = command.toLowerCase()
    return destructivePatterns.some(p => p.test(cmd))
  }

  async gatekeeper(userPrompt: string): Promise<boolean> {
    this.log("STEP 1: Gatekeeper")

    const prompt = `
${SCAFFOLDING}
User Input: '${userPrompt}'
Does this request require Linux shell execution?
Reply ONLY 'CONTINUE' or 'DONE'.`

    const response = await this.callOllama(prompt)
    const shouldContinue = !response.trim().toUpperCase().includes("DONE")

    this.log("  ->", shouldContinue ? "CONTINUE" : "DONE")
    return shouldContinue
  }

  async architect(userPrompt: string): Promise<string> {
    this.log("STEP 2: Architect")

    // Simple prompt - just get commands
    const prompt = `Task: ${userPrompt}

Output simple shell commands to complete this. One per line, start with *.`

    const plan = await this.callOllama(prompt)
    
    this.log("  -> Plan generated")
    return plan
  }

  async critic(plan: string): Promise<string> {
    this.log("STEP 3: Critic")
    
    const lines = plan.split('\n')
      .filter(line => line.trim().startsWith('*'))
      .map(line => line.replace(/^\*\s*/, '').trim())
      .filter(line => line.length > 0)
    
    this.log("  -> Plan cleaned")
    return lines.map(l => `* ${l}`).join('\n')
  }

  async cleaner(plan: string): Promise<string[]> {
    this.log("STEP 4: Cleaner")

    // Extract lines that look like commands - more lenient
    const steps = plan.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 3)  // At least some content
      .map(line => line.replace(/^\*\s*/, ''))  // Remove leading *
      .map(line => line.replace(/^```\w*/, ''))   // Remove markdown
      .map(line => line.replace(/```$/, ''))     // Remove closing ```
      .map(line => line.replace(/`/g, ''))       // Remove backticks
      .filter(line => {
        // Accept lines that look like shell commands
        const cmd = line.split(' ')[0].toLowerCase()
        return /^[a-z][a-z0-9_]*$/.test(cmd) && cmd.length > 1
      })

    this.log("  -> " + steps.length + " steps extracted")
    return steps
  }

  async commander(userPrompt: string, steps: string[]): Promise<string> {
    this.log("STEP 5: Commander")

    let history = ""

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      this.log("  Step " + (i + 1) + "/" + steps.length + ": " + step)

      // Use the step directly as the command instead of asking LLM to generate
      let rawCommand = step

      rawCommand = rawCommand
        .replace(/```bash|```/g, "")
        .replace(/`/g, "")
        .replace(/\n/g, " ")
        .trim()

      const cmdLower = rawCommand.toLowerCase()
      const isIncomplete = 
        (cmdLower.startsWith("grep") && !cmdLower.match(/grep\s+["\']/)) ||
        (cmdLower.startsWith("find") && !cmdLower.includes("-name") && !cmdLower.includes("-type"))
      
      if (isIncomplete) {
        this.log("    -> Command incomplete, skipping")
        continue
      }

      // Security check for destructive commands
      if (this.isDestructive(rawCommand)) {
        this.log("    WARNING: Destructive command detected: " + rawCommand)
        const confirmPrompt = `
The following command is potentially destructive:
${rawCommand}

Is this safe to execute? Reply ONLY 'YES' or 'NO'.
`
        const confirm = await this.callOllama(confirmPrompt)
        if (!confirm.toUpperCase().includes("YES")) {
          this.log("    -> Command rejected by security check, skipping")
          history += "\n" + step + ": REJECTED - destructive command"
          continue
        }
        this.log("    -> Command approved by security check")
      }

      const finalCommand = "cd " + PROJECT_ROOT + " && " + rawCommand
      let attempt = 0
      let currentCommand = finalCommand
      let currentStepSuccess = false
      let lastStdout = ""

      while (attempt < 3 && !currentStepSuccess) {
        const result = await this.runBash(currentCommand)
        const { stdout, stderr, exitCode } = result
        lastStdout = stdout

        if (exitCode === 0) {
          if (stdout.trim() === "") {
            const isDone = await this.callOllama(`Task: "${step}". The command returned empty output. Is this task complete? YES or NO.`)
            if (isDone.toUpperCase().includes("YES")) {
              currentStepSuccess = true
            } else {
              attempt++
              if (attempt < 3) {
                const broader = await this.callOllama(`Task: "${step}" needs more detail. Provide a broader command.`)
                const broadCmd = broader.replace(/```bash|```/g, "").replace(/`/g, "").trim()
                currentCommand = "cd " + PROJECT_ROOT + " && " + broadCmd
              }
            }
          } else {
            currentStepSuccess = true
          }
        } else {
          attempt++
          if (attempt >= 3) {
            this.log("    -> Failed: " + (stderr || "exit code " + exitCode))
            history += "\n" + step + ": FAILED - " + (stderr || "exit code " + exitCode)
            break
          }
          const fix = await this.callOllama(`Command failed: ${stderr}. Fix it. Output ONLY the new command.`)
          const fixedCmd = fix.replace(/```bash|```/g, "").replace(/`/g, "").trim()
          currentCommand = "cd " + PROJECT_ROOT + " && " + fixedCmd
        }
      }

      if (currentStepSuccess) {
        history += "\n" + step + ": " + lastStdout.slice(0, 500)
        this.log("    -> OK")
      }
    }

    return history
  }

  async reporter(userPrompt: string, history: string): Promise<string> {
    this.log("STEP 6: Reporter")

    const prompt = `
User asked: "${userPrompt}"

Results from commands:
${history}

Provide a SHORT summary (2-3 sentences) of what was found and list key file paths.`

    return await this.callOllama(prompt)
  }

  async run(userPrompt: string): Promise<{
    success: boolean
    finalSummary: string
  }> {
    try {
      // Skip gatekeeper - just process the task
      this.log("Generating commands for task...")
      
      // Directly generate a single command to execute
      const cmdPrompt = `Task: ${userPrompt}

Give me ONE simple bash command to accomplish this. Output ONLY the command, no explanation.`

      const command = await this.callOllama(cmdPrompt)
      const cleanCmd = command
        .replace(/^```.*$/gm, '')   // Remove markdown code blocks
        .replace(/`/g, '')         // Remove backticks
        .replace(/^#!/, '#!')      // Keep shebang
        .trim()
      
      this.log("Executing:", cleanCmd)
      
      const result = await this.runBash(cleanCmd)
      
      const output = result.stdout || result.stderr || "Command executed"
      this.log("Output:", output.slice(0, 200))
      
      return { success: result.exitCode === 0, finalSummary: output.slice(0, 1000) }
    } catch (error) {
      return { success: false, finalSummary: String(error) }
    }
  }
}

export async function runWorkflow(userPrompt: string, quiet = true): Promise<{ success: boolean; finalSummary: string }> {
  const engine = new WorkflowEngine("llama3.1:8b-instruct-q4_K_M", quiet)
  return await engine.run(userPrompt)
}
