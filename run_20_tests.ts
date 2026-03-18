#!/usr/bin/env bun
import { WorkflowEngine } from "./packages/astrocoder/src/orchestrator/workflow.ts"
import { readFileSync, writeFileSync } from "fs"

const HARDENING_FILE = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/hardening.txt"
const FAILED_FILE = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/failed_tests.txt"

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
      currentId = line.replace(":", "").trim()
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
  
  return tests.slice(0, 20)
}

async function runTests() {
  const content = readFileSync(HARDENING_FILE, "utf-8")
  const tests = parseHardeningTests(content)
  
  const engine = new WorkflowEngine("llama3.1:8b-instruct-q4_K_M", true)
  
  let passed = 0
  let failed = 0
  let failedOutput = ""
  
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i]
    process.stdout.write(`[${i + 161}/180] Running ${test.id}... `)
    
    try {
      const result = await engine.run(test.prompt)
      
      if (result.success) {
        console.log("PASS")
        passed++
      } else {
        console.log("FAIL")
        failed++
        failedOutput += `TEST: ${test.id}\nPROMPT: ${test.prompt}\nEXPECTED: ${test.expected}\nERROR: ${result.finalSummary.slice(0, 300)}\n\n---\n\n`
      }
    } catch (e: any) {
      console.log(`ERROR: ${e.message?.slice(0, 100) || e}`)
      failed++
      failedOutput += `TEST: ${test.id}\nPROMPT: ${test.prompt}\nEXPECTED: ${test.expected}\nERROR: ${e.message}\n\n---\n\n`
    }
  }
  
  console.log(`\n=== Results: ${passed}/20 passed ===`)
  
  if (failed > 0) {
    writeFileSync(FAILED_FILE, failedOutput)
    console.log(`Failed tests written to ${FAILED_FILE}`)
  }
}

runTests().catch(console.error)
