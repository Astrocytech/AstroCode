#!/usr/bin/env bun
import { WorkflowEngine } from "./packages/astrocoder/src/orchestrator/workflow.ts"

async function test() {
  const engine = new WorkflowEngine("llama3.1:8b-instruct-q4_K_M", true)

  const tests = [
    {
      id: "TEST_016",
      prompt: "Read hello.py and add a comment at the top",
      expected: "Comment added"
    },
    {
      id: "TEST_021",
      prompt: "Replace \"old\" with \"new\" in test.txt",
      expected: "All replacements made"
    },
    {
      id: "TEST_023",
      prompt: "Update config.json to add \"debug\": true",
      expected: "JSON updated"
    },
    {
      id: "TEST_034",
      prompt: "def greet(name: str) -> str:",
      expected: "Type hints present"
    },
    {
      id: "TEST_048",
      prompt: "Read data.csv and calculate average of column \"score\"",
      expected: "Average calculated"
    }
  ]

  for (const t of tests) {
    console.log(`\n=== Running ${t.id}: ${t.prompt} ===`)
    const result = await engine.run(t.prompt)
    console.log(`Success: ${result.success}`)
    console.log(`Summary: ${result.finalSummary.slice(0, 200)}...`)
  }
}

test().catch(console.error)
