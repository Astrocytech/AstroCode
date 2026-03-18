import { WorkflowEngine } from './packages/astrocoder/src/orchestrator/workflow.ts';

async function test() {
  const engine = new WorkflowEngine('llama3.1:8b-instruct-q4_K_M', true);
  const tests = [
    'Create config.json with {"app": "test", "version": 1}',
    'Create script.py with multiple functions: add, subtract, multiply',
    'Overwrite hello.py with print("New content")',
    'Create style.css with body { background: #000; color: #fff; }',
    'Create app.js with function init() { console.log("ready"); }',
    'Create types.ts with interface Config { url: string; port: number; }',
    'Create setup.sh with #!/bin/bash and echo "Running"',
    'Create README.md with # Title and ## Installation',
    'Create app.yaml with server: host: localhost port: 8080',
    'Create data.xml with <config><setting>value</setting></config>',
  ];
  
  let passed = 0;
  for (const prompt of tests) {
    const result = await engine.run(prompt);
    console.log(prompt.slice(0, 50) + '...', result.success ? 'PASS' : 'FAIL');
    if (result.success) passed++;
  }
  console.log(`\nPassed: ${passed}/${tests.length} (${(passed/tests.length*100).toFixed(0)}%)`);
}

test();
