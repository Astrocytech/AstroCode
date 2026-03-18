#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "fs"

const HARDENING_FILE = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/hardening.txt"
const OUTPUT_FILE = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/hardening_filtered.txt"

// Tests that should be removed (based on skip patterns in run_all_tests.ts)
const TESTS_TO_REMOVE = [
  "TEST_017", "TEST_018", // Fix syntax/runtime errors
  "TEST_050", // Image processor (PIL)
  "TEST_051", // PDF text extractor
  "TEST_053", // FTP client
  "TEST_054", // SSH client
  "TEST_055", // WebSocket client
  "TEST_060", // Find command
]

// Patterns to match in prompts (from SKIP_PATTERNS)
const PROMPT_PATTERNS = [
  /bcrypt/,
  /sqlalchemy/,
  /psycopg2/,
  /opencv/,
  /pillow/,
  /pytesseract/,
  /smtplib/,
  /paramiko/,
  /fabric/,
  /scp/,
  /Fix syntax error in broken\.py/,
  /Fix NameError in broken\.py/,
  /Fix runtime error in broken\.py/,
  /Image processor/,
  /PDF text extractor/,
  /FTP client/,
  /SSH client/,
  /WebSocket/,
  /Find command/,
  /https?:\/\//, // External URLs (web scraping, API calls)
]

function shouldRemove(testId: string, prompt: string): boolean {
  const fullId = `TEST_${testId}`
  if (TESTS_TO_REMOVE.includes(fullId)) {
    return true
  }
  return PROMPT_PATTERNS.some(p => p.test(prompt))
}

function filterTests(content: string): string {
  const lines = content.split('\n')
  const outputLines: string[] = []
  let currentId = ""
  let currentPrompt = ""
  let currentExpected = ""
  let inTest = false
  let skipCurrent = false

  for (const line of lines) {
    if (line.startsWith("TEST_")) {
      // Save previous test if not skipped
      if (currentId && !skipCurrent) {
        outputLines.push(`TEST_${currentId}`)
        outputLines.push(`PROMPT: ${currentPrompt}`)
        outputLines.push(`EXPECTED: ${currentExpected}`)
        outputLines.push("")
      }

      // Start new test
      const match = line.match(/^TEST_(\d+)(?:\s+(.*))?$/)
      if (match) {
        currentId = match[1]
      }
      currentPrompt = ""
      currentExpected = ""
      inTest = true
      skipCurrent = false
    } else if (line.startsWith("PROMPT:") && inTest) {
      currentPrompt = line.substring(7).trim()
    } else if (line.startsWith("EXPECTED:") && inTest) {
      currentExpected = line.substring(9).trim()
    } else if (inTest && line.trim() === "" && currentId && currentPrompt) {
      // Check if we should skip this test
      skipCurrent = shouldRemove(currentId, currentPrompt)
      if (!skipCurrent) {
        outputLines.push(`TEST_${currentId}`)
        outputLines.push(`PROMPT: ${currentPrompt}`)
        outputLines.push(`EXPECTED: ${currentExpected}`)
        outputLines.push("")
      }
      inTest = false
      currentId = ""
      currentPrompt = ""
      currentExpected = ""
    } else if (inTest && !skipCurrent) {
      if (line.trim()) {
        outputLines.push(line)
      }
    }
  }

  // Handle last test
  if (currentId && !skipCurrent && currentPrompt) {
    outputLines.push(`TEST_${currentId}`)
    outputLines.push(`PROMPT: ${currentPrompt}`)
    outputLines.push(`EXPECTED: ${currentExpected}`)
    outputLines.push("")
  }

  return outputLines.join('\n')
}

async function main() {
  const content = readFileSync(HARDENING_FILE, "utf-8")
  const filtered = filterTests(content)
  writeFileSync(OUTPUT_FILE, filtered)
  console.log(`Filtered tests written to ${OUTPUT_FILE}`)
}

main()
