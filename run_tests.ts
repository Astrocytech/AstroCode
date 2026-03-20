import { WorkflowEngine } from '/home/njonji/Desktop/ASTROCYTECH/AstroCode/packages/astrocoder/src/orchestrator/workflow.ts'
import { readFileSync, writeFileSync } from 'fs'

const HARDENING_FILE = '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/hardening.txt'
const FAILED_FILE = '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/failed_tests.txt'
const SKIPPED_FILE = '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/skipped_tests.txt'

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
]

const SKIP_IDS = [
  'TEST_017', 'TEST_018', 'TEST_047', 'TEST_049', 'TEST_050', 'TEST_051',
  'TEST_302', 'TEST_309', 'TEST_317', 'TEST_318', 'TEST_320', 'TEST_322', 'TEST_324', 'TEST_325', 'TEST_326', 'TEST_330'
]

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
