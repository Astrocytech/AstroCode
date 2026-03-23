import { WorkflowEngine } from '/home/njonji/Desktop/ASTROCYTECH/AstroCode/packages/astrocoder/src/orchestrator/workflow.ts'
import { readFileSync } from 'fs'

const testId = process.argv[2] || '080'

const content = readFileSync('hardening/hardening.txt', 'utf-8')
const lines = content.split('\n')

let currentId = '', currentPrompt = '', currentExpected = ''
for (const line of lines) {
  const trimmed = line.trim()
  if (trimmed.startsWith('TEST_')) {
    currentId = trimmed.replace('TEST_', '').replace(':', '').trim().split(' ')[0]
  } else if (trimmed.startsWith('PROMPT:')) {
    currentPrompt = trimmed.substring(7)
  } else if (trimmed.startsWith('EXPECTED:') && currentId === testId) {
    currentExpected = trimmed.substring(9)
    break
  }
}

const test = { id: testId, prompt: currentPrompt }
const engine = new WorkflowEngine('llama3.1:8b-instruct-q4_K_M', true)

console.log(`RUN ${test.id} ${test.prompt}`)

const result = await engine.run(test.prompt)

if (result.success) {
  console.log(`PASS ${test.id}`)
} else {
  console.log(`FAIL ${test.id}: ${result.finalSummary.slice(0, 500)}`)
}