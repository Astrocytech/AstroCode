import { WorkflowEngine } from './packages/astrocoder/src/orchestrator/workflow.ts';

async function test() {
  const engine = new WorkflowEngine('llama3.1:8b-instruct-q4_K_M', true);
  
  // Reset first
  await engine.run('Overwrite hello.py with print("Hello World")');
  
  const result = await engine.run('Read hello.py and add a comment at the top');
  console.log('TEST_016:', result.success ? 'PASS' : 'FAIL');
  console.log(result.finalSummary.slice(0, 600));
}

test();
