#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "fs"

const HARDENING_FILE = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/hardening.txt"
const OUTPUT_FILE = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/hardening_filtered.txt"

// Tests that should be removed (based on skip patterns)
const TESTS_TO_REMOVE = [
  "TEST_017", "TEST_018", // Fix syntax/runtime errors
  "TEST_047", // Web scraper
  "TEST_049", // JSON API client (external API)
  "TEST_050", // Image processor
  "TEST_051", // PDF text extractor
  "TEST_052", // Email sender
  "TEST_053", // FTP client
  "TEST_054", // SSH client
  "TEST_055", // WebSocket client
  "TEST_058", // Install pip package
  "TEST_059", // Git operations
  "TEST_060", // Find command
  "TEST_071", // Fallback logic (requires external calls)
  "TEST_072", // Complete workflow (external calls)
  "TEST_095", // Download file
  "TEST_097", // Handle timeout
  "TEST_100", // Rate limiting
]

// Patterns to match in prompts
const PROMPT_PATTERNS = [
  /https?:\/\//, // External URLs
  /PIL|pillow/i, // Image processing
  /pdf/i, // PDF processing
  /smtplib/i, // Email
  /ftp/i, // FTP
  /ssh/i, // SSH
  /websocket/i, // WebSocket
  /api\.github\.com/i, // GitHub API
  /pip install/i, // Package installation
  /git /i, // Git commands
  /find /i, // Find command
]

function shouldRemove(testId: string, prompt: string): boolean {
  const fullId = `TEST_${testId}`
  if (TESTS_TO_REMOVE.includes(fullId)) {
    console.log(`Removing ${fullId} (in list)`)
    return true
  }
  const matches = PROMPT_PATTERNS.some(p => p.test(prompt))
  if (matches) {
    console.log(`Removing ${fullId} (pattern match)`)
  }
  return matches
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

      // Start new test - handle format "TEST_001" or "TEST_001 Title"
      const match = line.match(/^TEST_(\d+)(?:\s+(.*))?$/)
      if (match) {
        currentId = match[1]
        // Check if title is on same line (rare) or will be on PROMPT line
        if (match[2] && !match[2].startsWith("PROMPT:")) {
          // Title on same line (shouldn't happen in current format)
          currentPrompt = match[2].trim()
        }
      }
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
      // Only push non-empty lines
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
