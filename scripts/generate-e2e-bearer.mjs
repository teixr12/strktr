#!/usr/bin/env node

import { appendFileSync } from 'node:fs'

const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'E2E_USER_EMAIL', 'E2E_USER_PASSWORD']
const missing = required.filter((key) => !process.env[key])

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`)
  process.exit(1)
}

const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '')
const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const email = String(process.env.E2E_USER_EMAIL)
const password = String(process.env.E2E_USER_PASSWORD)

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchTokenWithRetry(maxAttempts = 6) {
  let lastError = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const payload = await response.json().catch(() => ({}))
      return { response, payload }
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts) {
        await wait(500 * attempt)
      }
    }
  }

  throw lastError || new Error('unknown token generation error')
}

let response
let payload

try {
  const result = await fetchTokenWithRetry()
  response = result.response
  payload = result.payload
} catch (error) {
  console.error(
    JSON.stringify(
      {
        message: 'Failed to reach Supabase auth endpoint for E2E token generation',
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  )
  process.exit(1)
}

if (!response.ok) {
  console.error(
    JSON.stringify(
      {
        message: 'Failed to generate E2E bearer token',
        status: response.status,
        payload,
      },
      null,
      2
    )
  )
  process.exit(1)
}

const accessToken = payload?.access_token
if (!accessToken) {
  console.error('Supabase auth response did not include access_token')
  process.exit(1)
}

if (process.env.GITHUB_ENV) {
  appendFileSync(process.env.GITHUB_ENV, `E2E_BEARER_TOKEN=${accessToken}\n`, { encoding: 'utf8' })
}

console.log(`::add-mask::${accessToken}`)

if (process.argv.includes('--plain')) {
  process.stdout.write(accessToken)
} else {
  console.log('Generated E2E bearer token and exported to GITHUB_ENV')
}
