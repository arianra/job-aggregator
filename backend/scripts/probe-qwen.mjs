// Probe the Qwen API config the backend actually uses
// Run from repo root: node backend/scripts/probe-qwen.mjs
import fs from 'node:fs'
const envText = fs.readFileSync('.env', 'utf-8')
const get = (k) => {
  const m = envText.match(new RegExp(`^${k}=(.*)$`, 'm'))
  return m ? m[1].trim() : undefined
}
const key = get('QWEN_API_KEY')
const envEp = get('QWEN_API_ENDPOINT')
console.log('key prefix:', key ? key.slice(0, 8) + '…' : 'MISSING')
console.log('.env endpoint:', envEp)

const body = JSON.stringify({
  model: 'qwen-max',
  messages: [{ role: 'user', content: 'reply with the word ok' }],
  max_tokens: 5,
})

async function probe(name, url) {
  console.log(`\n=== ${name} ===\n${url}`)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body,
      signal: AbortSignal.timeout(25000),
    })
    const text = await res.text()
    console.log(`HTTP ${res.status}:`, text.slice(0, 400))
  } catch (e) {
    console.log('FETCH ERROR:', e.message)
  }
}

// A: what qwen-parser.ts actually calls (hardcoded default base URL)
await probe(
  'A: hardcoded dashscope default (what the code calls)',
  'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
)
// B: the .env endpoint treated as OpenAI-compatible
if (envEp)
  await probe(
    'B: .env QWEN_API_ENDPOINT + /chat/completions',
    envEp.replace(/\/$/, '') + '/chat/completions'
  )
// C: the .env endpoint as Anthropic Messages API (path says /apps/anthropic/v1)
if (envEp) {
  console.log(
    '\n=== C: .env QWEN_API_ENDPOINT as Anthropic /v1/messages ===\n' +
      envEp.replace(/\/$/, '') +
      '/messages'
  )
  try {
    const res = await fetch(envEp.replace(/\/$/, '') + '/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'qwen-max',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'reply with the word ok' }],
      }),
      signal: AbortSignal.timeout(25000),
    })
    console.log(`HTTP ${res.status}:`, (await res.text()).slice(0, 400))
  } catch (e) {
    console.log('FETCH ERROR:', e.message)
  }
}

console.log('\n=== D: is config.qwenApiEndpoint consumed anywhere? ===')
