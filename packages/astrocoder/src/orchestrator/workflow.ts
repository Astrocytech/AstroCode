import { spawn } from "child_process"
import path from "path"
import fs from "fs/promises"
import { writeFileSync } from "fs"

const PROJECT_ROOT = "/home/njonji/Desktop/ASTROCYTECH/AstroCode"
const HARDENING_DIR = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening"

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
          { role: "system", content: "You are an autonomous coding assistant. Your job is to COMPLETE tasks by writing and executing code. CRITICAL: You must output ONLY Python code in a python code block. No explanations, no conversational text. Start with ```python, write the code, end with ```. Nothing else." },
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

      const timeout = setTimeout(() => {
        proc.kill()
        resolve({ stdout, stderr: stderr + "\n[TIMEOUT]", exitCode: 124 })
      }, 30000)

      proc.on("close", (code) => {
        clearTimeout(timeout)
        resolve({ stdout, stderr, exitCode: code || 0 })
      })

      proc.on("error", (err) => {
        clearTimeout(timeout)
        resolve({ stdout: "", stderr: err.message, exitCode: 1 })
      })
    })
  }

  private extractTargetPath(prompt: string): string | null {
    const patterns = [
      /create\s+(\/[\w\-.\/]+\.\w+)/i,
      /create\s+(\/[\w\-.\/]+)/i,
      /save\s+to\s+(\/[\w\-.\/]+)/i,
      /at\s+(\/[\w\-.\/]+\.\w+)/i,
      /in\s+(\/[\w\-.\/]+)/i,
      /create\s+([\w\-.]+\.\w+)/i,
      /save\s+to\s+([\w\-.]+\.\w+)/i,
      /overwrite\s+([\w\-.]+\.\w+)/i,
      /to\s+([\w\-.]+\.\w+)/i,
    ]
    
    for (const regex of patterns) {
      const match = prompt.match(regex)
      if (match) {
        return match[1]
      }
    }
    return null
  }

  private extractFilePaths(text: string): string[] {
    const paths: string[] = []
    const absoluteRegex = /(?:^|[^\w\/])(\/[\w\-.\/]+(?:\.\w+)?)/g
    let match
    while ((match = absoluteRegex.exec(text)) !== null) {
      const p = match[1]
      if (p.includes('.py') || p.includes('.txt') || p.includes('.js') || p.includes('.ts') || p.includes('.json') || p.includes('.html') || p.includes('.yaml') || p.includes('.yml') || p.includes('.md') || p.includes('.xml') || p.includes('.css') || p.includes('.sh')) {
        paths.push(p)
      }
    }
    const relativeRegex = /(?:^|[^\w\/])([\w\-.]+\.(?:py|txt|js|ts|json|html|yaml|yml|md|xml|css|sh))/g
    while ((match = relativeRegex.exec(text)) !== null) {
      const p = match[1]
      const fullPath = path.join(HARDENING_DIR, p)
      if (!paths.includes(fullPath) && !paths.includes(p)) {
        paths.push(fullPath)
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
    if (codeBlocks.length === 0) {
      const pythonIndicators = ['import ', 'def ', 'with open', 'os.', 'subprocess.', 'write(']
      if (pythonIndicators.some(indicator => output.includes(indicator))) {
        const lines = output.split('\n')
        const codeLines = lines.filter(line => 
          line.trim().startsWith('import ') || 
          line.trim().startsWith('def ') ||
          line.trim().startsWith('with ') ||
          line.trim().startsWith('os.') ||
          line.trim().startsWith('subprocess.') ||
          line.includes('write(') ||
          line.trim().startsWith('#') ||
          !line.startsWith(' ') && !line.startsWith('\t') && line.length > 0
        )
        if (codeLines.length > 0) {
          codeBlocks.push(codeLines.join('\n'))
        }
      }
    }
    return codeBlocks
  }

  async run(userPrompt: string, sessionHistory: string[] = []): Promise<{ success: boolean; finalSummary: string }> {
    this.history = sessionHistory || []
    const maxAttempts = 5

    const targetPath = this.extractTargetPath(userPrompt)
    
    const isCommandTask = /^(run|execute|install|list|check|show|get|create\s+dir|delete|remove|copy|move|start|stop|kill)/i.test(userPrompt) && 
      !/create\s+.*file|save|write/i.test(userPrompt)
    
    let targetDir = isCommandTask ? PROJECT_ROOT : HARDENING_DIR
    let targetFile = null
    
    if (targetPath) {
      if (targetPath.startsWith('/')) {
        const dir = path.dirname(targetPath)
        if (dir && dir !== '.' && dir !== '/') {
          targetDir = dir
        }
        targetFile = path.basename(targetPath)
      } else {
        targetFile = targetPath
      }
    }

    const filePaths = this.extractFilePaths(userPrompt)
    let fileContents = ""
    
    for (const fp of filePaths) {
      let content = await this.readFileContent(fp)
      if (!content) {
        content = await this.readFileContent(path.join(HARDENING_DIR, path.basename(fp)))
      }
      if (content) {
        fileContents += `\n\n=== FILE: ${path.basename(fp)} ===\n${content}\n`
      }
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const context = this.history.length > 0 
        ? `\nPrevious attempts failed:\n${this.history.join('\n')}\n\n`
        : ""

      const dirInstruction = targetDir !== PROJECT_ROOT && !isCommandTask
        ? `\nIMPORTANT: Create files in this exact directory: ${targetDir}\nUse: os.makedirs("${targetDir}", exist_ok=True) before writing files.\n`
        : ""

      let promptPart = ""
      if (isCommandTask) {
        promptPart = `TASK: ${userPrompt}

Execute this task using Python subprocess or os.system. 
For example: subprocess.run(["ls", "-la", "${targetDir || '/home/njonji/Desktop/ASTROCYTECH/AstroCode'}"], shell=True)
Use subprocess.run with shell=True for shell commands.

STRICT OUTPUT FORMAT - You MUST follow this exactly:
1. Start your response with \`\`\`python
2. Write ONLY the Python code - no explanations, no comments about what you're doing
3. End with \`\`\`
4. Do NOT write anything else - no text before or after the code block`
      } else {
        const isFixTask = /fix|solve|correct|repair/i.test(userPrompt)
        const editInstruction = fileContents 
          ? `- The file content shown above is already read - use it as needed\n`
          : ""
        const fixInstruction = isFixTask 
          ? `- For FIX tasks: write the CORRECTED file content using: with open("filepath", 'w') as f: f.write(corrected_content)\n  Do NOT include broken imports or syntax in your code\n`
          : ""
        promptPart = `TASK: ${userPrompt}

Write Python code to accomplish this task. 
${editInstruction}${fixInstruction}- Use the EXACT file paths from the task
- For editing tasks (append, prepend, replace): read the file first, then modify
- Create directories if needed: os.makedirs("${targetDir}", exist_ok=True)
- Write files using: with open("${targetFile || 'filename'}", 'w') as f: f.write(content)
- For append: use 'a' mode, for prepend: read first then write new+old

STRICT OUTPUT FORMAT - You MUST follow this exactly:
1. Start your response with \`\`\`python
2. Write ONLY the Python code - no explanations, no comments about what you're doing
3. End with \`\`\`
4. Do NOT write anything else - no text before or after the code block`
      }

      const prompt = `${fileContents}
${context}${dirInstruction}${promptPart}`

      const output = await this.callOllama(prompt)
      
      const codeBlocks = this.extractCode(output)
      
      if (codeBlocks.length === 0) {
        this.history.push(`Attempt ${attempt}: No code generated, got: ${output.slice(0, 200)}`)
        continue
      }

      const scriptPath = path.join(PROJECT_ROOT, `temp_workflow_${attempt}.py`)
      
      const combinedCode = codeBlocks.join('\n\n')
      
      const dirSetup = targetDir !== PROJECT_ROOT 
        ? `import os\nos.makedirs("${targetDir}", exist_ok=True)\n`
        : ""
      
      const codeWithShebang = `#!/usr/bin/env python3\nimport sys\nsys.path.insert(0, '/home/njonji/Desktop/IZBR')\n${dirSetup}${combinedCode}`
      
      writeFileSync(scriptPath, codeWithShebang)

      const runResult = await this.runBash(`python3 "${scriptPath}" 2>&1`)
      
      let results = `Code executed:\n${combinedCode.slice(0, 1000)}\n\nOutput:\n${runResult.stdout || runResult.stderr}`

      // For command tasks, success is if command ran (no crash)
      if (isCommandTask) {
        if (!runResult.stderr.includes("Error") && !runResult.stderr.includes("Traceback")) {
          await this.runBash(`rm -f "${scriptPath}"`)
          return { 
            success: true, 
            finalSummary: `Task completed: ${userPrompt}\n\nOutput:\n${runResult.stdout || runResult.stderr}` 
          }
        }
      }

      let fileCheck = "No target file specified"
      let targetFilePath = targetPath
      
      if (!targetFilePath && targetFile) {
        targetFilePath = path.join(HARDENING_DIR, targetFile)
      }
      
      let targetForCheck = targetPath
      if (!targetForCheck || (!targetForCheck.startsWith('/'))) {
        const tf = targetFile || (targetForCheck || "")
        targetForCheck = tf ? path.join(HARDENING_DIR, tf) : HARDENING_DIR
      }
      
      if (targetForCheck) {
        const exists = await this.runBash(`test -f "${targetForCheck}" && echo "EXISTS: ${targetForCheck}" || echo "NOT_FOUND"`)
        fileCheck = exists.stdout || exists.stderr
      }

      const isEditTask = /read|modify|edit|append|prepend|replace|fix|update|add|delete|remove|rename/i.test(userPrompt)
      const isCreateTask = /create|define|make|write|generate|set up|implement|use|log|handle|raise/i.test(userPrompt)
      const isFileTask = /log|file|config|cache|handler/i.test(userPrompt)
      const hasNoErrors = !runResult.stderr.includes("Error") && !runResult.stderr.includes("Traceback") && !runResult.stderr.includes("Exception")
      const hasPartialErrors = runResult.stderr.includes("Error") || runResult.stderr.includes("Exception")
      const hasSuccessOutput = runResult.stdout.includes("success") || runResult.stdout.includes("done") || runResult.stdout.includes("complete") || runResult.stdout.includes("modified") || runResult.stdout.includes("edited")
      const hasCodeOutput = runResult.stdout.trim().length > 0
      const hasLogOutput = /DEBUG|INFO|WARNING|ERROR|Logged/i.test(runResult.stdout) || /DEBUG|INFO|WARNING|ERROR|Logged/i.test(runResult.stderr)
      
      if (isEditTask && (hasNoErrors || hasSuccessOutput) && targetForCheck && fileCheck.includes("EXISTS")) {
        await this.runBash(`rm -f "${scriptPath}"`)
        return { 
          success: true, 
          finalSummary: `Task completed: ${userPrompt}\n\nResults:\n${results}\n\nFile verification: ${fileCheck}` 
        }
      }

      if (isCreateTask && (hasNoErrors || hasSuccessOutput || hasCodeOutput || hasLogOutput)) {
        await this.runBash(`rm -f "${scriptPath}"`)
        return { 
          success: true, 
          finalSummary: `Task completed: ${userPrompt}\n\nResults:\n${results}\n\nCode executed successfully` 
        }
      }

      if (isFileTask && targetForCheck && fileCheck.includes("EXISTS") && !hasPartialErrors) {
        await this.runBash(`rm -f "${scriptPath}"`)
        return { 
          success: true, 
          finalSummary: `Task completed: ${userPrompt}\n\nResults:\n${results}\n\nFile verification: ${fileCheck}` 
        }
      }

      const verifyPrompt = `Task was: "${userPrompt}"

Code stdout: ${runResult.stdout.slice(0, 500)}
Code stderr: ${runResult.stderr.slice(0, 500)}
File check: ${fileCheck}

Is this task COMPLETED? Did the file get created or modified as requested? Reply ONLY YES or NO.`
      
      const verification = await this.callOllama(verifyPrompt)
      
      if (verification.toUpperCase().includes("YES") || (targetForCheck && fileCheck.includes("EXISTS"))) {
        await this.runBash(`rm -f "${scriptPath}"`)
        return { 
          success: true, 
          finalSummary: `Task completed: ${userPrompt}\n\nResults:\n${results}\n\nFile verification: ${fileCheck}` 
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
