import { WorkflowEngine } from '/home/njonji/Desktop/ASTROCYTECH/AstroCode/packages/astrocoder/src/orchestrator/workflow.ts'

const engine = new WorkflowEngine('llama3.1:8b-instruct-q4_K_M', true)

const test = {
  id: '047',
  prompt: 'Extract all <a> tags from https://example.com'
}

console.log(`RUN ${test.id} ${test.prompt}`)

const result = await engine.run(test.prompt)

if (result.success) {
  console.log(`PASS ${test.id}`)
} else {
  console.log(`FAIL ${test.id}: ${result.finalSummary.slice(0, 200)}`)
}