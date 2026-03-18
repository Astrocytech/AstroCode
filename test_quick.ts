import { WorkflowEngine } from './packages/astrocoder/src/orchestrator/workflow.ts';

async function test() {
  const engine = new WorkflowEngine('llama3.1:8b-instruct-q4_K_M', true);
  const result = await engine.run('Create config.json with {"app": "test", "version": 1}');
  console.log('Result:', result.success ? 'PASS' : 'FAIL');
  console.log('Summary:', result.finalSummary.slice(0, 800));
}

test();
