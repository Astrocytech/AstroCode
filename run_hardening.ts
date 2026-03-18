#!/usr/bin/env bun
import { WorkflowEngine } from "./packages/astrocoder/src/orchestrator/workflow.ts"
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs"

const HARDENING_FILE = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/hardening.txt"
const FAILED_FILE = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/failed_tests.txt"
const RESULTS_FILE = "/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/test_results.txt"

function parseHardeningTests(content: string): Array<{id: string, prompt: string, expected: string}> {
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
  
  return tests
}

async function runTests() {
  writeFileSync(FAILED_FILE, "")
  writeFileSync(RESULTS_FILE, "")
  
  console.log("Loading hardening tests...")
  const content = readFileSync(HARDENING_FILE, "utf-8")
  const tests = parseHardeningTests(content)
  console.log(`Found ${tests.length} tests, running all`)
  
  const engine = new WorkflowEngine("llama3.1:8b-instruct-q4_K_M", true)
  
  let passed = 0
  let failed = 0
  
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i]
    process.stdout.write(`[${i + 1}/${tests.length}] Running ${test.id}... `)
    
    try {
      const result = await engine.run(test.prompt)
      
      if (result.success) {
        console.log("PASS")
        passed++
      } else {
        console.log("FAIL")
        failed++
        
        writeFileSync(FAILED_FILE, `TEST: ${test.id}\nPROMPT: ${test.prompt}\nEXPECTED: ${test.expected}\nERROR: ${result.finalSummary.slice(0, 300)}\n\n---\n\n`)
      }
    } catch (e: any) {
      console.log(`ERROR: ${e.message?.slice(0, 100) || e}`)
      failed++
      
      writeFileSync(FAILED_FILE, `TEST: ${test.id}\nPROMPT: ${test.prompt}\nEXPECTED: ${test.expected}\nERROR: ${e.message}\n\n---\n\n`)
    }
    
    if ((i + 1) % 10 === 0) {
      console.log(`\n=== Progress: ${i + 1}/${tests.length} | Passed: ${passed}, Failed: ${failed} ===\n`)
    }
  }
  
  const total = passed + failed
  const passRate = ((passed / total) * 100).toFixed(1)
  
  console.log(`\n=== RESULTS ===`)
  console.log(`Total: ${total}`)
  console.log(`Passed: ${passed} (${passRate}%)`)
  console.log(`Failed: ${failed}`)
  
  let output = `=== HARDENING TEST RESULTS ===\nDate: ${new Date().toISOString()}\n\n`
  output += `Total: ${total}\nPassed: ${passed} (${passRate}%)\nFailed: ${failed}\n`
  
  writeFileSync(RESULTS_FILE, output)
  console.log(`\nResults written to ${RESULTS_FILE}`)
  console.log(`Failed tests saved to ${FAILED_FILE}`)
}

runTests().catch(console.error)
