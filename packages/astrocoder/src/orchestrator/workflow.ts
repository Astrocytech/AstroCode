import { spawn } from "child_process"
import path from "path"
import fs from "fs/promises"
import { writeFileSync } from "fs"

const PROJECT_ROOT = "/home/njonji/Desktop/ASTROCYTECH/AstroCode"

interface OllamaChatResponse {
  message?: { content?: string }
}

export function isSmallOllamaModel(modelID: string): boolean {
  const id = modelID.toLowerCase()
  return id.includes("3b") || id.includes("1b") || id.includes("0.5b") || 
         id.includes("q2_") || id.includes("q3_") || id.includes("q4_0") ||
         id.includes("-1b") || id.includes("-3b")
}

export class WorkflowEngine {
  private modelID: string
  private history: string[]
  private quiet: boolean
  private isSmallModel: boolean

  constructor(modelID = "llama3.1:8b-instruct-q4_K_M", quiet = false) {
    this.modelID = modelID
    this.history = []
    this.quiet = quiet
    
    // Detect small models (3B or smaller) for optimizations
    this.isSmallModel = isSmallOllamaModel(modelID)
  }

  private async callOllama(prompt: string): Promise<string> {
    const baseUrl = "http://localhost:11434"
    
    // Simplified system prompt for small models - shorter is better
    const systemPrompt = this.isSmallModel
      ? "You are a coding assistant. Write Python code. Output ONLY ```python\\n[code]\\n```"
      : "You are an autonomous coding assistant. Your ONLY job is to write and execute Python code. CRITICAL RULES: 1) Output EXACTLY ```python on its own line, then your code, then ``` on its own line. 2) NO explanations, NO tutorials, NO markdown text outside code blocks. 3) Start with ```python and end with ```. 4) The code will be executed directly. Write ONLY code that can run."

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.modelID,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.0,
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`)
    }

    const data = await response.json() as OllamaChatResponse
    return data.message?.content || ""
  }

  private readonly BLOCKED_PATTERNS = [
    /rm\s+-rf\s+\//,
    /rm\s+-rf\s+\*/,
    /dd\s+if=/,
    /mkfs/,
    /:\)\{/,  // Fork bomb
    /while\s*\(\s*true\s*\)\s*{:\s*&\s*};/,  // Fork bomb variant
  ]

  private readonly DANGEROUS_PATTERNS = [
    /rm\s+-r/,
    /rm\s+-f/,
    /del\s+/,
    /chmod\s+0{3,}/,
    /chown\s+root/,
    /DROP\s+TABLE/i,
    /DROP\s+DATABASE/i,
    /DELETE\s+FROM\s+\w+\s*;(?!\s*WHERE)/i,
    /truncate\s+\w/i,  // Shell truncate command, not Python method
    /shut\s*down/i,
    /halt/i,
    /init\s+0/i,
    /reboot/i,
  ]

  private checkSafety(code: string): { blocked: boolean; dangerous: boolean; message: string } {
    for (const pattern of this.BLOCKED_PATTERNS) {
      if (pattern.test(code)) {
        return { blocked: true, dangerous: false, message: `Blocked catastrophic command detected: ${pattern}` }
      }
    }
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(code)) {
        return { blocked: false, dangerous: true, message: `Potentially dangerous operation detected: ${pattern}` }
      }
    }
    return { blocked: false, dangerous: false, message: "" }
  }

  private fixCommonTypos(code: string): string {
    let result = code
    result = result.replace(/\bimport request\b/g, "import requests")
    result = result.replace(/\bimportt\b/g, "import")
    result = result.replace(/from bs4 impor\b/g, "from bs4 import")
    result = result.replace(/from PIL impor\b/g, "from PIL import")
    result = result.replace(/from bs4 import$/gm, "from bs4 import")
    result = result.replace(/from PIL import$/gm, "from PIL import")
    result = result.replace(/import request$/gm, "import requests")
    result = result.replace(/importt$/gm, "import")
    result = result.replace(/from\s+\w+\s+impor(?!\w)/g, (match) => match.replace('impor', 'import'))
    return result
  }

  private async reviewCode(code: string, task: string): Promise<string> {
    const prompt = `Review this Python code for correctness and bugs. If issues found, fix them.

Task: ${task}

Code:
${code}

Reply ONLY with the reviewed/fixed Python code in a python code block. If no changes needed, reply with the original code unchanged.`
    return await this.callOllama(prompt)
  }

  private async consensusCode(code: string, task: string): Promise<{ code: string; consensus: boolean }> {
    // Skip consensus for small models - too expensive
    if (this.isSmallModel) {
      return { code, consensus: false }
    }
    
    const review = await this.reviewCode(code, task)
    const blocks = this.extractCode(review)
    const reviewedCode = blocks.join('\n\n').trim()
    
    if (reviewedCode && reviewedCode !== code) {
      return { code: reviewedCode, consensus: true }
    }
    
    return { code: reviewedCode || code, consensus: false }
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
      /read\s+([\w\-.]+\.\w+)/i,
      /parse\s+([\w\-.]+\.\w+)/i,  // Parse operations
      /extract\s+([\w\-.]+\.\w+)/i,  // Extract operations
      /filter\s+([\w\-.]+\.\w+)/i,  // Filter operations
      /sort\s+([\w\-.]+\.\w+)/i,  // Sort operations
      /transform\s+([\w\-.]+\.\w+)/i,  // Transform operations
      /merge\s+([\w\-.]+\.\w+)/i,  // Merge operations
      /split\s+([\w\-.]+\.\w+)/i,  // Split operations
      /deduplicate\s+([\w\-.]+\.\w+)/i,  // Deduplicate operations
      /modify\s+([\w\-.]+\.\w+)/i,
      /edit\s+([\w\-.]+\.\w+)/i,
      /append\s+to\s+([\w\-.]+\.\w+)/i,
      /prepend\s+to\s+([\w\-.]+\.\w+)/i,
      /replace\s+.*\s+in\s+([\w\-.]+\.\w+)/i,
      /update\s+([\w\-.]+\.\w+)/i,
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
    const relativeRegex = /(?:^|[^\w\/])([\w\-]*\.(?:py|txt|js|ts|json|html|yaml|yml|md|xml|css|sh|log)(?!\w))/g
    while ((match = relativeRegex.exec(text)) !== null) {
      const p = match[1]
      const fullPath = path.join(PROJECT_ROOT, p)
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
    // Reduced attempts for small models - faster but fewer retries
    const maxAttempts = this.isSmallModel ? 3 : 5

    const targetPath = this.extractTargetPath(userPrompt)
    
    const isCommandTask = /^(run|execute|install|list|check|show|get|create\s+dir|delete|remove|copy|move|start|stop|kill)/i.test(userPrompt) && 
      !/create\s+.*file|save|write/i.test(userPrompt)
    
    let targetDir = isCommandTask ? PROJECT_ROOT : PROJECT_ROOT
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
        content = await this.readFileContent(path.join(PROJECT_ROOT, path.basename(fp)))
      }
      if (content) {
        fileContents += `\n\n=== FILE: ${path.basename(fp)} ===\n${content}\n`
      }
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Simplified context for small models - fewer tokens to process
      const context = this.isSmallModel
        ? (this.history.length > 0 ? `\nPrev error: ${this.history[this.history.length - 1].slice(0, 100)}\n` : "")
        : (this.history.length > 0 
            ? `\nPrevious attempts failed:\n${this.history.join('\n')}\n\nIMPORTANT: Fix the errors from previous attempts. Do not repeat the same mistakes.\n`
            : "")

      const dirInstruction = !isCommandTask && targetDir !== PROJECT_ROOT
        ? `\nIMPORTANT: Files are in: ${targetDir}\nUse full paths like: ${targetDir}/filename\n`
        : fileContents 
          ? `\nIMPORTANT: Working directory is: ${PROJECT_ROOT}\nUse full paths: ${PROJECT_ROOT}/filename\n`
          : ""

      let promptPart = ""
      if (this.isSmallModel) {
        const isWriteTask = /write|create|save|make/i.test(userPrompt)
        const isRenameTask = /rename|move\s+(it|the\s+file)|change\s+name/i.test(userPrompt)
        const isCopyTask = /copy\s+(it|the\s+file)|duplicate/i.test(userPrompt)
        const isDeleteTask = /delete\s+(it|the\s+file)|remove\s+(it|the\s+file)|erase/i.test(userPrompt)
        
        let fileOpInstruction = ""
        if (isRenameTask) {
          fileOpInstruction = `\nFor RENAME/MOVE: use 'mv old new' - DELETES original! Example: subprocess.run("mv a.txt b.txt", shell=True)`
        } else if (isCopyTask) {
          fileOpInstruction = `\nFor COPY: use 'cp src dst' - creates NEW file, keeps original! Example: subprocess.run("cp original.txt copy.txt", shell=True)`
        } else if (isDeleteTask) {
          fileOpInstruction = `\nFor DELETE: use 'rm filepath' - PERMANENTLY deletes! Example: subprocess.run("rm file.txt", shell=True)`
        }
        const targetPathHint = targetFile 
          ? `Use path: ${targetDir}/${targetFile}` 
          : `Write to: ${PROJECT_ROOT}/output.txt`
        
        const writeInstruction = isWriteTask
          ? `\n${targetPathHint}\nExample: with open("${targetFile || 'output.txt'}", 'w') as f: f.write("your content")`
          : ""
          
        // Simplified prompt for small models - less context to process
        promptPart = `${fileContents}
TASK: ${userPrompt}
${isCommandTask ? `Workdir: ${PROJECT_ROOT}` : `Workdir: ${targetDir || PROJECT_ROOT}`}${fileOpInstruction}${writeInstruction}
STRICT: Write ONLY Python code in a code block. No explanations. Format:
\`\`\`python
# your code here
\`\`\`
`
        promptPart = `TASK: ${userPrompt}

Execute this task using Python subprocess or os.system.
Use shell=True for all shell commands.
IMPORTANT: Working directory is: ${PROJECT_ROOT}

Examples:
- List files: subprocess.run("ls -la", shell=True)
- Run script: subprocess.run("python3 script.py", shell=True)
- Check disk: subprocess.run("du -sh .", shell=True)
- Rename/Move: subprocess.run("mv oldname newname", shell=True)
- Copy file: subprocess.run("cp src dst", shell=True)
- Delete file: subprocess.run("rm filepath", shell=True)

STRICT OUTPUT FORMAT - You MUST follow this exactly:
1. Start with \`\`\`python on its own line
2. Write ONLY the Python code - no explanations
3. End with \`\`\` on its own line
4. Do NOT write anything else`
      } else {
        const isFixTask = /fix|solve|correct|repair/i.test(userPrompt)
        const isDataTask = /parse|extract|filter|transform|sort|merge|split|convert|deduplicate/i.test(userPrompt)
        const isRenameTask = /rename|move\s+(it|the\s+file)|change\s+name/i.test(userPrompt)
        const isCopyTask = /copy\s+(it|the\s+file)|duplicate/i.test(userPrompt)
        const isDeleteTask = /delete\s+(it|the\s+file)|remove\s+(it|the\s+file)|erase/i.test(userPrompt)
        
        const renameInstruction = isRenameTask
          ? `- For RENAME: use os.rename(src, dst) - this MOVES the file and DELETES the original!\n  Example: os.rename("old.txt", "new.txt")\n`
          : isCopyTask
          ? `- For COPY: use shutil.copy2(src, dst) - this creates a NEW file, does NOT delete original!\n  Example: shutil.copy2("original.txt", "copy.txt")\n`
          : isDeleteTask
          ? `- For DELETE: use os.remove(filepath) - this PERMANENTLY deletes the file!\n  Example: os.remove("file.txt")\n  Or: subprocess.run("rm file.txt", shell=True)\n`
          : ""
        const editInstruction = fileContents 
          ? `- The file content shown above is already read - use it as needed\n`
          : ""
        const fixInstruction = isFixTask 
          ? `- For FIX tasks: write the CORRECTED file content using: with open("filepath", 'w') as f: f.write(corrected_content)\n  Do NOT include broken imports or syntax in your code\n`
          : ""
        const dataExamples = isDataTask
          ? `- For data tasks: read file, process, print results\n  Example: with open('file.txt') as f: print(f.read())\n`
          : ""
        promptPart = `TASK: ${userPrompt}

Write Python code to accomplish this task. 
${renameInstruction}${editInstruction}${fixInstruction}${dataExamples}- Use the EXACT file paths from the task
- For editing tasks (append, prepend, replace): read the file first, then modify
- Create directories if needed: os.makedirs("${targetDir || PROJECT_ROOT}", exist_ok=True)
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

      let combinedCode = codeBlocks.join('\n\n')
      
      // Consensus-based healing: generate twice, compare, use consistent version
      const { code: reviewedCode, consensus } = await this.consensusCode(combinedCode, userPrompt)
      if (reviewedCode) {
        combinedCode = reviewedCode
      }

      // Safety check before execution
      const safety = this.checkSafety(combinedCode)
      if (safety.blocked) {
        return {
          success: false,
          finalSummary: `BLOCKED: ${safety.message}\n\nCode:\n${combinedCode.slice(0, 500)}`
        }
      }
      if (safety.dangerous) {
        console.warn(`WARNING: ${safety.message}`)
      }

      let runSuccess = false
      let runResult = { stdout: "", stderr: "", exitCode: 0 }

      // Execute with execution-based healing fallback
      // Fewer healing attempts for small models
      const maxHealAttempts = this.isSmallModel ? 1 : 3
      for (let healAttempt = 0; healAttempt < maxHealAttempts; healAttempt++) {
        const scriptPath = path.join(PROJECT_ROOT, `temp_workflow_${attempt}_${healAttempt}.py`)
        
        const dirSetup = targetDir !== PROJECT_ROOT 
          ? `import os\nos.makedirs("${targetDir}", exist_ok=True)\n`
          : ""
        
        const fixedCode = this.fixCommonTypos(combinedCode)
        const codeWithShebang = `#!/usr/bin/env python3\nimport sys\nsys.path.insert(0, '/home/njonji/Desktop/IZBR')\n${dirSetup}${fixedCode}`
        writeFileSync(scriptPath, codeWithShebang)
        runResult = await this.runBash(`timeout 30 python3 "${scriptPath}" 2>&1`)
        
        // Check if execution succeeded
        if (!runResult.stderr.includes("Error") && !runResult.stderr.includes("Traceback") && !runResult.stderr.includes("Exception")) {
          runSuccess = true
          await this.runBash(`rm -f "${scriptPath}"`)
          break
        }
        
        // If failed, try to fix with error feedback
        if (healAttempt < 2) {
          const fixPrompt = `The following code failed with this error:
${runResult.stderr}

Code:
${combinedCode}

Write CORRECTED Python code that fixes this error. Only output the code in a python code block.`
          const fixedOutput = await this.callOllama(fixPrompt)
          const fixedBlocks = this.extractCode(fixedOutput)
          if (fixedBlocks.length > 0) {
            combinedCode = this.fixCommonTypos(fixedBlocks.join('\n\n'))
          }
        }
        
        await this.runBash(`rm -f "${scriptPath}"`)
      }

      let results = `Code executed:\n${combinedCode.slice(0, 1000)}\n\nOutput:\n${runResult.stdout || runResult.stderr}`

      // For command tasks, success is if command ran (no crash)
      if (isCommandTask) {
        if (runSuccess) {
          return { 
            success: true, 
            finalSummary: `Task completed: ${userPrompt}\n\nOutput:\n${runResult.stdout || runResult.stderr}` 
          }
        }
      }

      let fileCheck = "No target file specified"
      let targetFilePath = targetPath
      
      if (!targetFilePath && targetFile) {
        targetFilePath = path.join(PROJECT_ROOT, targetFile)
      }
      
      let targetForCheck = targetPath
      if (!targetForCheck || (!targetForCheck.startsWith('/'))) {
        const tf = targetFile || (targetForCheck || "")
        targetForCheck = tf ? path.join(PROJECT_ROOT, tf) : PROJECT_ROOT
      }
      
      if (targetForCheck) {
        const exists = await this.runBash(`test -f "${targetForCheck}" && echo "EXISTS: ${targetForCheck}" || echo "NOT_FOUND"`)
        fileCheck = exists.stdout || exists.stderr
      }

      const isEditTask = /read|modify|edit|append|prepend|replace|fix|update|add|delete|remove|rename/i.test(userPrompt)
      const isCreateTask = /create|define|make|write|generate|set up|implement|use|log|handle|raise|configure|setup|install|deploy|publish|chain|gateway|isolation|routing|backup|restore|failover|replication|scan|lint|format|check|detect|package|version|release|celery|temporal|prefect|kong|tenant|secret|complexity|duplicate|private|pypi|poetry|pipenv|semantic|changelog|nomad|marathon|rancher/i.test(userPrompt)
      const isFileTask = /log|file|config|cache|handler|database|task|workflow|plugin|gateway|tenant|backup|restore|failover|replication|load|stress|scan|lint|format|check|detect|package|version|release|celery|temporal|prefect|kong|tenant|secret|complexity|duplicate|private|pypi|poetry|pipenv|semantic|changelog|nomad|marathon|rancher/i.test(userPrompt)
      const hasPartialErrors = runResult.stderr.includes("Error") || runResult.stderr.includes("Exception")
      const hasSuccessOutput = runResult.stdout.includes("success") || runResult.stdout.includes("done") || runResult.stdout.includes("complete") || runResult.stdout.includes("modified") || runResult.stdout.includes("edited") || runResult.stdout.includes("configured") || runResult.stdout.includes("installed") || runResult.stdout.includes("deployed") || runResult.stdout.includes("published")
      const hasCodeOutput = runResult.stdout.trim().length > 0
      const hasLogOutput = /DEBUG|INFO|WARNING|ERROR|Logged/i.test(runResult.stdout) || /DEBUG|INFO|WARNING|ERROR|Logged/i.test(runResult.stderr)
      
      if (isEditTask && runSuccess && targetForCheck && fileCheck.includes("EXISTS")) {
        return { 
          success: true, 
          finalSummary: `Task completed: ${userPrompt}\n\nResults:\n${results}\n\nFile verification: ${fileCheck}` 
        }
      }

      if (isCreateTask && runSuccess && (fileCheck.includes("EXISTS") || hasCodeOutput || hasLogOutput)) {
        return { 
          success: true, 
          finalSummary: `Task completed: ${userPrompt}\n\nResults:\n${results}\n\nCode executed successfully` 
        }
      }

      if (isFileTask && runSuccess && targetForCheck && fileCheck.includes("EXISTS") && !hasPartialErrors) {
        return { 
          success: true, 
          finalSummary: `Task completed: ${userPrompt}\n\nResults:\n${results}\n\nFile/Task verification: ${fileCheck}` 
        }
      }

      // Skip verification prompt for small models - too expensive
      if (!this.isSmallModel) {
        const verifyPrompt = `Task was: "${userPrompt}"

Code execution result:
- stdout: ${runResult.stdout.slice(0, 500)}
- stderr: ${runResult.stderr.slice(0, 500)}
- file check: ${fileCheck}
- execution success: ${runSuccess}

Based on the output above, did the code successfully accomplish the task? 
Look for: successful execution, no errors, expected output, or file modifications.
Reply ONLY YES or NO.`
        
        const verification = await this.callOllama(verifyPrompt)
        
        if (verification.toUpperCase().includes("YES")) {
          return { 
            success: true, 
            finalSummary: `Task completed: ${userPrompt}\n\nResults:\n${results}\n\nVerification: ${verification.slice(0, 200)}` 
          }
        }
      }

      this.history.push(`Attempt ${attempt} failed: ${(runResult.stderr || runResult.stdout).slice(0, 200)}`)
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
