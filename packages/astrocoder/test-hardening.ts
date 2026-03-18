import { WorkflowEngine } from "./src/orchestrator/workflow"

async function test() {
  console.log("=" .repeat(60))
  console.log("MORE CATEGORIES TESTING")
  console.log("=" .repeat(60))
  
  let passed = 0
  let failed = 0
  
  const tests = [
    // More file types
    { name: "FILE_JSON", prompt: 'Create /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/data.json with {"users": [{"id": 1, "name": "John"}]}', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/data.json' },
    { name: "FILE_YAML", prompt: 'Create /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/app.yml with app: name: test version: 1.0', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/app.yml' },
    { name: "FILE_TOML", prompt: 'Create /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/pyproject.toml with [project] name = "test"', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/pyproject.toml' },
    
    // More code generation
    { name: "FUNC_RECURSE", prompt: 'Create /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/factorial.py with recursive factorial', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/factorial.py' },
    { name: "FUNC_DECORATOR", prompt: 'Create /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/memoize.py with @lru_cache', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/memoize.py' },
    
    // More classes
    { name: "CLASS_ABSTRACT", prompt: 'Create /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/animal.py with abstract class Animal', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/animal.py' },
    { name: "CLASS_PROP", prompt: 'Create /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/rectangle.py with property for area', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/rectangle.py' },
    
    // More commands
    { name: "CMD_GIT", prompt: 'Run git log --oneline -3', check: null },
    { name: "CMD_FIND", prompt: 'Find files larger than 1MB in /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening', check: null },
    { name: "CMD_DU", prompt: 'Check disk usage of /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening', check: null },
    
    // More algorithms
    { name: "ALG_SORT", prompt: 'Create /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/quick_sort.py with quicksort', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/quick_sort.py' },
    { name: "ALG_SEARCH", prompt: 'Create /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/linear_search.py with linear search', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/linear_search.py' },
    
    // More data
    { name: "DATA_JSON_PARSE", prompt: 'Parse /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/data.json and save names to /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/names.txt', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/names.txt' },
    
    // More network
    { name: "NET_HEADERS", prompt: 'Get headers from https://httpbin.org/headers and save to /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/headers.txt', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/headers.txt' },
    
    // More security
    { name: "SEC_VALIDATE", prompt: 'Create /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/validate.py with email validation', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/validate.py' },
    
    // More async
    { name: "ASYNC_AWAIT", prompt: 'Create /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/async_await.py with asyncio.gather', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/async_await.py' },
    
    // More testing
    { name: "TEST_MOCK", prompt: 'Create /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/test_mock.py with unittest.mock', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/test_mock.py' },
    
    // More misc
    { name: "MISC_ENV", prompt: 'Set environment variable TEST_VAR=hello and print it', check: null },
    { name: "MISC_BASE64", prompt: 'Encode "hello" to base64 and save to /home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/encoded.txt', check: '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/encoded.txt' },
  ]
  
  for (const t of tests) {
    const engine = new WorkflowEngine("llama3.1:8b-instruct-q4_K_M", true)
    const result = await engine.run(t.prompt)
    
    let fileOk = true
    if (t.check) {
      try {
        await Bun.file(t.check).text()
      } catch { fileOk = false }
    }
    
    const isPass = result.success && (!t.check || fileOk)
    if (isPass) passed++
    else failed++
    
    console.log(`${isPass ? "✅" : "❌"} ${t.name}`)
    
    await new Promise(r => setTimeout(r, 2500))
  }
  
  console.log("\n" + "=" .repeat(60))
  console.log(`TOTAL: ${passed}/${tests.length} PASSED (${Math.round(passed/tests.length*100)}%)`)
  console.log("=" .repeat(60))
}

test().catch(console.error)
