import { WorkflowEngine } from "./src/orchestrator/workflow"

async function test() {
  const tests = [
    { name: "TEST_001", prompt: 'Create hello.py that prints "Hello World"', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/hello.py' },
    { name: "TEST_002", prompt: 'Create /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/test2.txt with "hello test"', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/test2.txt' },
    { name: "TEST_003", prompt: 'Create /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/config.json with {"app": "test", "version": 1}', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/config.json' },
    { name: "TEST_006", prompt: 'Create /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/index.html with <html><body><h1>Hello</h1></body></html>', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/index.html' },
  ]
  
  for (const t of tests) {
    console.log(`\n=== ${t.name} ===`)
    console.log("Prompt:", t.prompt)
    const engine = new WorkflowEngine("llama3.1:8b-instruct-q4_K_M", true)
    const result = await engine.run(t.prompt)
    console.log("Success:", result.success)
    
    try {
      const content = await Bun.file(t.check).text()
      console.log("File exists:", t.check, "- Content:", content.slice(0, 50))
    } catch {
      console.log("File NOT found:", t.check)
    }
    await new Promise(r => setTimeout(r, 2000))
  }
}

test().catch(console.error)
