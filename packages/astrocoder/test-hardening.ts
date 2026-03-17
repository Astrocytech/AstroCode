import { WorkflowEngine } from "./src/orchestrator/workflow"

async function test() {
  const tests = [
    { name: "TEST_056", prompt: 'Run ls -la in /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening', check: null },
    { name: "TEST_059", prompt: 'Run git status in /home/njonji/Desktop/ASTROCYTECH/AstroCode', check: null },
    { name: "TEST_060", prompt: 'Find all .py files in /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening', check: null },
  ]
  
  for (const t of tests) {
    console.log(`\n=== ${t.name} ===`)
    const engine = new WorkflowEngine("llama3.1:8b-instruct-q4_K_M", true)
    const result = await engine.run(t.prompt)
    console.log("Success:", result.success)
    console.log("Output:", result.finalSummary.slice(0, 400))
    await new Promise(r => setTimeout(r, 3000))
  }
}

test().catch(console.error)
