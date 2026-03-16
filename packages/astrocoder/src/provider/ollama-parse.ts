import { Filesystem } from "@/util/filesystem"
import { Log } from "@/util/log"
import path from "path"
import { readFile, writeFile } from "fs/promises"

const logger = Log.create({ service: "ollama.parse" })

export interface FileEdit {
  path: string
  content: string
  isDiff: boolean
}

export async function parseOllamaResponse(content: string, cwd: string): Promise<FileEdit[]> {
  const edits: FileEdit[] = []
  
  // Match diff blocks first
  // Format:
  // filename.py
  // ```diff
  // --- a/filename.py
  // +++ b/filename.py
  // @@ -1,5 +1,8 @@
  // ...
  // ```
  const diffBlockRegex = /([^\n]+\.(?:ts|tsx|js|jsx|py|json|md|txt|sh|yaml|yml|html|css|sql|go|rs|java|c|cpp|h|py))(?:\n|)```diff\n([\s\S]*?)```/g
  
  let match
  while ((match = diffBlockRegex.exec(content)) !== null) {
    const filePath = match[1].trim()
    const diffContent = match[2]
    
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath)
    
    edits.push({
      path: fullPath,
      content: diffContent,
      isDiff: true,
    })
    
    logger.info("Found diff edit", { path: fullPath, size: diffContent.length })
  }
  
  // Match full file blocks (for new files or replacements)
  // Format:
  // filename.txt
  // ```text
  // ... content ...
  // ```
  const fileBlockRegex = /([^\n]+\.(?:ts|tsx|js|jsx|py|json|md|txt|sh|yaml|yml|html|css|sql|go|rs|java|c|cpp|h|py))(?:\n|)```(?:\w+)?\n([\s\S]*?)```/g
  
  while ((match = fileBlockRegex.exec(content)) !== null) {
    const filePath = match[1].trim()
    const fileContent = match[2]
    
    // Skip if we already processed this as a diff
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath)
    if (edits.some(e => e.path === fullPath)) continue
    
    const fullPathResolved = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath)
    
    edits.push({
      path: fullPathResolved,
      content: fileContent,
      isDiff: false,
    })
    
    logger.info("Found file edit", { path: fullPathResolved, size: fileContent.length })
  }
  
  return edits
}

export async function applyOllamaEdits(edits: FileEdit[]): Promise<void> {
  for (const edit of edits) {
    try {
      if (edit.isDiff) {
        // Apply diff to existing file
        await applyDiff(edit.path, edit.content)
        logger.info("Applied diff", { path: edit.path })
      } else {
        // Write full file (new file or replacement)
        await Filesystem.write(edit.path, edit.content)
        logger.info("Applied full file", { path: edit.path })
      }
    } catch (err) {
      logger.error("Failed to apply edit", { path: edit.path, error: err })
      throw err
    }
  }
}

async function applyDiff(filePath: string, diffContent: string): Promise<void> {
  try {
    // Read existing file
    const existingContent = await readFile(filePath, "utf-8")
    
    // Apply unified diff
    const patchedContent = applyUnifiedDiff(existingContent, diffContent)
    
    // Write back
    await writeFile(filePath, patchedContent, "utf-8")
  } catch (err) {
    // If file doesn't exist, write full content from diff (fallback)
    // Extract the added lines from diff as new file content
    const lines = diffContent.split("\n")
    let content = ""
    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++") && !line.startsWith("+ ")) {
        content += line.slice(1) + "\n"
      }
    }
    await writeFile(filePath, content, "utf-8")
  }
}

function applyUnifiedDiff(original: string, diff: string): string {
  const originalLines = original.split("\n")
  const diffLines = diff.split("\n")
  
  let result: string[] = []
  let i = 0 // original index
  let j = 0 // diff index
  
  // Parse hunk header to find starting position
  let startLine = 0
  while (j < diffLines.length) {
    const line = diffLines[j]
    if (line.startsWith("@@")) {
      // Extract start line from @@ -X,Y +Z,W @@
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/)
      if (match) {
        startLine = parseInt(match[1]) - 1
        j++
        break
      }
    }
    j++
  }
  
  // Rebuild file with changes
  let outputLines = originalLines.slice(0, startLine)
  i = startLine
  
  while (j < diffLines.length) {
    const line = diffLines[j]
    
    if (line.startsWith("@@")) {
      j++
      continue
    }
    
    if (line.startsWith("-")) {
      // Skip this line from original
      i++
      j++
      continue
    }
    
    if (line.startsWith("+")) {
      // Add this line
      outputLines.push(line.slice(1))
      j++
      continue
    }
    
    // Context line - keep from original
    if (!line.startsWith("\\")) {
      outputLines.push(originalLines[i] ?? "")
      i++
    }
    j++
  }
  
  // Add remaining original lines
  while (i < originalLines.length) {
    outputLines.push(originalLines[i])
    i++
  }
  
  return outputLines.join("\n")
}

export function extractCodeBlocks(content: string): string[] {
  const blocks: string[] = []
  const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g
  
  let match
  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push(match[1])
  }
  
  return blocks
}