import { Filesystem } from "@/util/filesystem"
import { Log } from "@/util/log"
import path from "path"
import { readFile, writeFile } from "fs/promises"
import { applyPatch, createTwoFilesPatch, parsePatch } from "diff"

const logger = Log.create({ service: "ollama.parse" })

export interface FileEdit {
  path: string
  content: string
  isDiff: boolean
}

export async function resolveFilePath(filePath: string, cwd: string, attachedFiles: string[] = []): Promise<string> {
  logger.info("resolveFilePath", { filePath, cwd, attachedFiles })
  // If absolute path, use it
  if (path.isAbsolute(filePath)) {
    logger.info("Using absolute path", { filePath })
    return filePath
  }

  // If it's a relative path that exists relative to CWD, use it
  const relativePath = path.resolve(cwd, filePath)
  try {
    await readFile(relativePath, "utf-8")
    logger.info("Found file relative to cwd", { relativePath })
    return relativePath
  } catch {
    // File doesn't exist relative to CWD, try to find it among attached files
    const fileName = path.basename(filePath)
    logger.info("Searching attached files", { fileName, attachedFiles })
    for (const attached of attachedFiles) {
      if (path.basename(attached) === fileName) {
        logger.info("Found matching attached file", { attached })
        return attached
      }
    }
  }

  // Fallback to relative path (will likely fail but we return it for display)
  logger.info("Fallback to relative path", { relativePath })
  return relativePath
}

export async function parseOllamaResponse(
  content: string,
  cwd: string,
  attachedFiles: string[] = [],
): Promise<{ edits: FileEdit[]; cleanedContent: string }> {
  const edits: FileEdit[] = []
  
  // Regex for both diff and code blocks with filenames
  const diffBlockRegex = /([^\n]+\.(?:ts|tsx|js|jsx|py|json|md|txt|sh|yaml|yml|html|css|sql|go|rs|java|c|cpp|h))(?:\n|)```diff\n([\s\S]*?)```/g
  const fileBlockRegex = /([^\n]+\.(?:ts|tsx|js|jsx|py|json|md|txt|sh|yaml|yml|html|css|sql|go|rs|java|c|cpp|h))(?:\n|)```(?:\w+)?\n([\s\S]*?)```/g

  const matches: { type: "diff" | "file"; path: string; content: string; start: number; end: number }[] = []
  
  let match
  while ((match = diffBlockRegex.exec(content)) !== null) {
    const filePath = match[1].trim()
    // Filter out obvious non-paths like "Edit filename.py"
    if (/^[A-Z][a-z]+ /.test(filePath)) {
      logger.info("Skipping non-path match", { filePath })
      continue
    }
    const fullPath = await resolveFilePath(filePath, cwd, attachedFiles)
    matches.push({
      type: "diff",
      path: fullPath,
      content: match[2],
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  while ((match = fileBlockRegex.exec(content)) !== null) {
    const filePath = match[1].trim()
    // Filter out obvious non-paths like "Edit filename.py"
    if (/^[A-Z][a-z]+ /.test(filePath)) {
      logger.info("Skipping non-path match", { filePath })
      continue
    }
    const fullPath = await resolveFilePath(filePath, cwd, attachedFiles)
    
    // Skip if this range was already matched by diffBlockRegex
    if (matches.some(m => m.start === match!.index)) continue

    matches.push({
      type: "file",
      path: fullPath,
      content: match[2],
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  // Sort matches by start index for cleaning
  const sortedMatches = [...matches].sort((a, b) => a.start - b.start)
  
  logger.info("parseOllamaResponse found matches", { count: sortedMatches.length })
  
  // Populate edits array
  for (const m of sortedMatches) {
    logger.info("Adding edit", { path: m.path, type: m.type, contentLength: m.content.length })
    edits.push({
      path: m.path,
      content: m.content,
      isDiff: m.type === "diff",
    })
  }

  // Build cleaned content by replacing blocks from end to start to keep indices valid
  let cleanedContent = content
  const cleaningMatches = [...matches].sort((a, b) => b.start - a.start)
  for (const m of cleaningMatches) {
    const fileName = path.basename(m.path)
    const summary = `\n\n*[Applied ${m.type === "diff" ? "edit to" : "file"} ${fileName}]*\n`
    cleanedContent = cleanedContent.slice(0, m.start) + summary + cleanedContent.slice(m.end)
  }

  return { edits, cleanedContent }
}

export async function applyOllamaEdits(edits: FileEdit[]): Promise<void> {
  logger.info("applyOllamaEdits start", { count: edits.length })
  for (const edit of edits) {
    try {
      logger.info("Processing edit", { path: edit.path, isDiff: edit.isDiff, contentLength: edit.content.length })
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
      // Don't throw - let other edits continue
    }
  }
  logger.info("applyOllamaEdits end")
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
      // Skip diff headers and only take added lines (+)
      if (line.startsWith("+") && !line.startsWith("+++")) {
        content += line.slice(1) + "\n"
      }
    }
    // Only write if we actually extracted content
    if (content.trim().length > 0) {
      await writeFile(filePath, content, "utf-8")
    } else {
      throw err
    }
  }
}

function applyUnifiedDiff(original: string, diff: string): string {
  try {
    const patches = parsePatch(diff)
    if (patches.length === 0) {
      logger.warn("No patches found in diff", { diff: diff.slice(0, 200) })
      return applyUnifiedDiffFallback(original, diff)
    }

    let result = original
    for (const patch of patches) {
      const patched = applyPatch(result, patch)
      if (patched === false) {
        logger.warn("Patch failed, trying fallback", { index: patches.indexOf(patch) })
        return applyUnifiedDiffFallback(original, diff)
      }
      result = patched
    }

    return result
  } catch (err) {
    logger.error("Error applying patch with diff library", { error: String(err), diff: diff.slice(0, 300) })
    return applyUnifiedDiffFallback(original, diff)
  }
}

function applyUnifiedDiffFallback(original: string, diff: string): string {
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

  // Ensure startLine is valid
  startLine = Math.max(0, Math.min(startLine, originalLines.length))

  // Rebuild file with changes
  let outputLines = originalLines.slice(0, startLine)
  i = startLine

  while (j < diffLines.length) {
    const line = diffLines[j]

    if (line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++")) {
      j++
      continue
    }

    if (line.startsWith("-")) {
      // Skip this line from original
      if (i < originalLines.length) {
        i++
      }
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
      if (i < originalLines.length) {
        outputLines.push(originalLines[i])
        i++
      }
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