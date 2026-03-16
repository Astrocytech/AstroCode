import { Filesystem } from "@/util/filesystem"
import { Log } from "@/util/log"
import path from "path"

const logger = Log.create({ service: "ollama.parse" })

export interface FileEdit {
  path: string
  content: string
}

export async function parseOllamaResponse(content: string, cwd: string): Promise<FileEdit[]> {
  const edits: FileEdit[] = []
  
  // Match file path followed by code block
  // Format:
  // path/to/file.ts
  // ```typescript
  // ... content ...
  // ```
  const fileBlockRegex = /([^\n]+\.(?:ts|tsx|js|jsx|py|json|md|txt|sh|yaml|yml|html|css|sql|go|rs|java|c|cpp|h))(?:\n|)```(?:\w+)?\n([\s\S]*?)```/g
  
  let match
  while ((match = fileBlockRegex.exec(content)) !== null) {
    const filePath = match[1].trim()
    const fileContent = match[2]
    
    // Resolve relative paths against cwd
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath)
    
    edits.push({
      path: fullPath,
      content: fileContent,
    })
    
    logger.info("Found file edit", { path: fullPath, size: fileContent.length })
  }
  
  return edits
}

export async function applyOllamaEdits(edits: FileEdit[]): Promise<void> {
  for (const edit of edits) {
    try {
      await Filesystem.write(edit.path, edit.content)
      logger.info("Applied edit", { path: edit.path })
    } catch (err) {
      logger.error("Failed to apply edit", { path: edit.path, error: err })
      throw err
    }
  }
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