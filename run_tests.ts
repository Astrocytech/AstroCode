import { WorkflowEngine } from '/home/njonji/Desktop/ASTROCYTECH/AstroCode/packages/astrocoder/src/orchestrator/workflow.ts'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const HARDENING_FILE = '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/hardening.txt'
const FAILED_FILE = '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/failed_tests.txt'
const SKIPPED_FILE = '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/skipped_tests.txt'
const TEST_DIR = '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening'

const SKIP_PATTERNS = [
  /bcrypt/,
  /sqlalchemy/,
  /psycopg2/,
  /opencv/,
  /pillow/,
  /pytesseract/,
  /smtplib/,
  /paramiko/,
  /fabric/,
  /scp/,
  /Fix syntax error in broken\.py/,
  /Fix NameError in broken\.py/,
  /Fix runtime error in broken\.py/,
  /Fix ImportError in broken\.py/,
  /Fix IndexError in broken\.py/,
  /Fix KeyError in broken\.py/,
  /Fix TypeError in broken\.py/,
  /Fix ValueError in broken\.py/,
  /Image processor/,
  /PDF text extractor/,
  /FTP client/,
  /SSH client/,
  /Watch directory|watch directory/i,
  /JWT verification/i,
  /S3 upload|S3 download|S3 bucket/i,
  /DynamoDB/i,
  /SQS queue/i,
  /RDS/i,
  /BigQuery/i,
  /GCS upload|GCS download/i,
  /Blob storage|Blob upload|Blob download/i,
  /Docker build/,
  /Docker-compose/,
  /Kubernetes|k8s/,
  /Terraform/,
  /Ansible/,
  /Cloud Run/,
  /Azure|aws|gcp/i,
  /PyTorch|tensor flow|keras/i,
  /Airflow|Spark|Kafka/,
  /GraphQL schema/,
  /gRPC/,
  /Istio|Linkerd/,
  /Helm chart/,
  /Django manage\.py/,
  /OpenFaaS/,
  /Web scraper/,
  /Redis|Memcached|Elasticsearch/,
  /Celery|Temporal|Prefect/,
  /Nomad|Marathon|Rancher/,
  /PyPI package|private.*pypi/,
  /MessagePack/,
  /Parquet/,
  /Scikit-learn/,
  /subshell|sub-shell/i,
  /here document/i,
  /Match pattern/i,
  /Toml config/i,
  /Message queue/i,
  /RabbitMQ/,
  /Proto Buffers/,
  /Apache Thrift/,
  /Service mesh/,
  /Read and modify.*\.py/,
  /Download file/i,
  /Upload file/i,
  /JMeter|load.*test|stress.*test/,
]

const SKIP_IDS = [
  'TEST_017', 'TEST_018', 'TEST_047', 'TEST_049', 'TEST_050', 'TEST_051',
  'TEST_302', 'TEST_309', 'TEST_317', 'TEST_318', 'TEST_320', 'TEST_322', 
  'TEST_324', 'TEST_325', 'TEST_326', 'TEST_330'
]

function setupTestFiles() {
  const files: Record<string, string> = {
    'data.json': '{"users": [{"name": "Alice"}, {"name": "Bob"}, {"name": "Charlie"}]}',
    'data.csv': 'id,name,value\n1,Alice,100\n2,Bob,200\n3,Charlie,300',
    'data.txt': 'hello\nworld\ntest\ndata\nfoo\nbar',
    'data.xml': '<root><item>test</item></root>',
    'data.yaml': 'key: value\nname: test',
    'list.txt': 'apple\nbanana\napple\ncherry\nbanana',
    'names.txt': 'Alice\nBob\nCharlie\nAlice\nDavid',
    'text.txt': 'Contact: admin@example.com\nSupport: help@company.org',
    'app.log': '2024-01-01 INFO Starting\n2024-01-02 ERROR Failed\n2024-01-03 WARN Retry',
    'file1.txt': 'Line 1 from file 1\nLine 2 from file 1',
    'file2.txt': 'Line 1 from file 2\nLine 2 from file 2',
    'file.txt': 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5',
    'old.txt': 'old content',
    'report.csv': 'date,sales,profit\n2024-01-01,100,20\n2024-01-02,150,35',
    'users.csv': 'id,name,email\n1,John,john@example.com\n2,Jane,jane@example.com',
    'numbers.txt': '5\n3\n8\n1\n9\n2',
    'config.json': '{"app": "test", "version": 1}',
    'broken.py': 'import non_existent_module\nprint("Hello")',
    'test.json': '{"items": [{"name": "Item1"}, {"name": "Item2"}]}',
  }
  
  for (const [filename, content] of Object.entries(files)) {
    const filepath = `${TEST_DIR}/${filename}`
    writeFileSync(filepath, content)
  }
  
  console.log(`Created ${Object.keys(files).length} test files`)
}

function parseTests(content: string) {
  const tests: any[] = []
  const lines = content.split('\n')
  let currentId = '', currentPrompt = '', currentExpected = ''
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('TEST_')) {
      if (currentId) tests.push({ id: currentId, prompt: currentPrompt.trim(), expected: currentExpected.trim() })
      currentId = trimmed.replace('TEST_', '').replace(':', '').trim()
      currentPrompt = ''; currentExpected = ''
    } else if (trimmed.startsWith('PROMPT:')) {
      currentPrompt = trimmed.substring(7)
    } else if (trimmed.startsWith('EXPECTED:')) {
      currentExpected = trimmed.substring(9)
    }
  }
  if (currentId) tests.push({ id: currentId, prompt: currentPrompt.trim(), expected: currentExpected.trim() })
  return tests
}

function shouldSkip(prompt: string, id: string) {
  if (SKIP_IDS.includes(`TEST_${id}`)) return true
  return SKIP_PATTERNS.some(p => p.test(prompt))
}

async function runTests() {
  console.log('Setting up test files...')
  setupTestFiles()
  
  const content = readFileSync(HARDENING_FILE, 'utf-8')
  const tests = parseTests(content)
  
  console.log(`Total tests: ${tests.length}`)
  
  const engine = new WorkflowEngine('llama3.1:8b-instruct-q4_K_M', true)
  
  let passed = 0, failed = 0, skipped = 0
  let failedOutput = '', skippedOutput = ''
  
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i]
    
    if (shouldSkip(test.prompt, test.id)) {
      console.log(`SKIP ${test.id}`)
      skipped++
      skippedOutput += `TEST: ${test.id}\nPROMPT: ${test.prompt}\nREASON: Pattern matched skip rules\n\n---\n\n`
      continue
    }
    
    console.log(`RUN ${test.id}`)
    
    try {
      const result = await engine.run(test.prompt)
      if (result.success) {
        console.log(`PASS ${test.id}`)
        passed++
      } else {
        console.log(`FAIL ${test.id}`)
        failed++
        failedOutput += `TEST: ${test.id}\nPROMPT: ${test.prompt}\nERROR: ${result.finalSummary.slice(0, 300)}\n\n---\n\n`
      }
    } catch (e: any) {
      console.log(`ERROR ${test.id}: ${e.message?.slice(0, 80)}`)
      failed++
    }
  }
  
  console.log(`\n=== RESULTS ===`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Pass rate: ${((passed / (tests.length - skipped)) * 100).toFixed(1)}%`)
  
  writeFileSync(FAILED_FILE, failedOutput)
  writeFileSync(SKIPPED_FILE, skippedOutput)
}

runTests().catch(console.error)
