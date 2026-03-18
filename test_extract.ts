#!/usr/bin/env bun

function extractTargetPath(prompt: string): string | null {
  const patterns = [
    /create\s+(\/[\w\-.\/]+\.\w+)/i,
    /create\s+(\/[\w\-.\/]+)/i,
    /save\s+to\s+(\/[\w\-.\/]+)/i,
    /at\s+(\/[\w\-.\/]+\.\w+)/i,
    /in\s+(\/[\w\-.\/]+)/i,
    /create\s+([\w\-.]+\.\w+)/i,
    /save\s+to\s+([\w\-.]+\.\w+)/i,
    /overwrite\s+([\w\-.]+\.\w+)/i,
    /to\s+([\w\-.]+\.\w+)/i,
    /read\s+([\w\-.]+\.\w+)/i,
    /modify\s+([\w\-.]+\.\w+)/i,
    /edit\s+([\w\-.]+\.\w+)/i,
    /append\s+to\s+([\w\-.]+\.\w+)/i,
    /prepend\s+to\s+([\w\-.]+\.\w+)/i,
      /replace\s+.*\s+in\s+([\w\-.]+\.\w+)/i,
    /update\s+([\w\-.]+\.\w+)/i,
  ]
  
  for (const regex of patterns) {
    const match = prompt.match(regex)
    if (match) {
      console.log(`Matched: ${regex} -> ${match[1]}`)
      return match[1]
    }
  }
  return null
}

const prompt = "Replace \"old\" with \"new\" in test.txt"
console.log(`Testing prompt: ${prompt}`)

const testRegex = /replace\s+.*\s+in\s+([\w\-.]+\.\w+)/i
const match = prompt.match(testRegex)
console.log(`Match result: ${match}`)

const result = extractTargetPath(prompt)
console.log(`Result: ${result}`)
