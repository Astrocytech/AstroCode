#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "fs"

const INPUT_FILE = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/hardening.txt"
const OUTPUT_FILE = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/hardening.txt"

// Tests to remove based on Ollama limitations
const TESTS_TO_REMOVE = new Set([
  "TEST_017", // Fix syntax error (requires broken.py)
  "TEST_018", // Fix runtime error (requires broken.py)
  "TEST_047", // Web scraper (external URL)
  "TEST_049", // JSON API client (external URL)
  "TEST_050", // Image processor (PIL)
  "TEST_051", // PDF text extractor
  "TEST_052", // Email sender (smtplib)
  "TEST_053", // FTP client
  "TEST_054", // SSH client
  "TEST_055", // WebSocket client
  "TEST_058", // Install pip package
  "TEST_059", // Git operations
  "TEST_060", // Find command
])

function filterTests(content: string): string {
  const lines = content.split('\n')
  const outputLines: string[] = []
  let currentTestId: string | null = null
  let skipCurrent = false

  for (const line of lines) {
    if (line.startsWith("TEST_")) {
      // Extract test ID (e.g., "TEST_017" -> "TEST_017")
      const match = line.match(/^TEST_\d+/)
      if (match) {
        currentTestId = match[0]
        skipCurrent = TESTS_TO_REMOVE.has(currentTestId)
      } else {
        currentTestId = null
        skipCurrent = false
      }
    }

    if (!skipCurrent) {
      outputLines.push(line)
    }
  }

  return outputLines.join('\n')
}

async function main() {
  const content = readFileSync(INPUT_FILE, "utf-8")
  const filtered = filterTests(content)
  writeFileSync(OUTPUT_FILE, filtered)
  console.log(`Filtered tests written to ${OUTPUT_FILE}`)
}

main()
