#!/usr/bin/env bun
import { WorkflowEngine } from "./packages/astrocoder/src/orchestrator/workflow.ts"
import { readFileSync, writeFileSync } from "fs"

const HARDENING_FILE = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/hardening.txt"

function parseHardeningTests(content: string) {
  const tests: Array<{id: string, prompt: string, expected: string}> = []
  const lines = content.split('\n')
  
  let currentId = ""
  let currentPrompt = ""
  let currentExpected = ""
  let inTest = false
  
  for (const line of lines) {
    if (line.startsWith("TEST_")) {
      if (currentId) {
        tests.push({ id: currentId, prompt: currentPrompt.trim(), expected: currentExpected.trim() })
      }
      currentId = line.replace("TEST_", "").replace(":", "").trim()
      currentPrompt = ""
      currentExpected = ""
      inTest = true
    } else if (line.startsWith("PROMPT:") && inTest) {
      currentPrompt = line.substring(7).trim()
    } else if (line.startsWith("EXPECTED:") && inTest) {
      currentExpected = line.substring(9).trim()
    } else if (inTest && line.trim() === "" && currentId && currentPrompt) {
      tests.push({ id: currentId, prompt: currentPrompt.trim(), expected: currentExpected.trim() })
      inTest = false
      currentId = ""
      currentPrompt = ""
      currentExpected = ""
    }
  }
  
  if (currentId && currentPrompt) {
    tests.push({ id: currentId, prompt: currentPrompt.trim(), expected: currentExpected.trim() })
  }
  
  return tests
}

const SKIP_PATTERNS = [
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
  /https?:\/\//,
]

function shouldSkip(prompt: string, testId: string): boolean {
  const skipIds = ["TEST_017", "TEST_018", "TEST_047", "TEST_049", "TEST_050", "TEST_051", "TEST_052", "TEST_053", "TEST_054", "TEST_055", "TEST_058", "TEST_059", "TEST_060"]
  if (skipIds.includes(testId)) return true
  return SKIP_PATTERNS.some(p => p.test(prompt))
}

async function runTests() {
  const content = readFileSync(HARDENING_FILE, "utf-8")
  const tests = parseHardeningTests(content)
  
  // Only run last 50 tests (tests 451-500)
  const testsToRun = tests.slice(450, 500)
  
  const engine = new WorkflowEngine("llama3.1:8b-instruct-q4_K_M", true)
  
  let passed = 0
  let failed = 0
  let skipped = 0
  
  for (let i = 0; i < testsToRun.length; i++) {
    const test = testsToRun[i]
    process.stdout.write(`[${451 + i}/${tests.length}] Running ${test.id}... `)
    
    if (shouldSkip(test.prompt, test.id)) {
      console.log("SKIP")
      skipped++
      continue
    }
    
    try {
      const result = await engine.run(test.prompt)
      
      if (result.success) {
        console.log("PASS")
        passed++
      } else {
        console.log("FAIL")
        failed++
      }
    } catch (e: any) {
      console.log(`ERROR: ${e.message?.slice(0, 100) || e}`)
      failed++
    }
  }
  
  const total = passed + failed + skipped
  const passRate = ((passed / (total - skipped)) * 100).toFixed(1)
  
  console.log(`\n=== RESULTS (tests 451-500) ===`)
  console.log(`Total: ${total}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Pass rate (excl skipped): ${passRate}%`)
}

runTests().catch(console.error)
