#!/usr/bin/env node

import { appendFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'E2E_USER_EMAIL',
  'E2E_USER_PASSWORD',
  'E2E_MANAGER_EMAIL',
  'E2E_MANAGER_PASSWORD',
  'E2E_ROLE_USER_EMAIL',
  'E2E_ROLE_USER_PASSWORD',
  'E2E_FOREIGN_EMAIL',
  'E2E_FOREIGN_PASSWORD',
]

const missing = required.filter((key) => !process.env[key])
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`)
  process.exit(1)
}

const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '')
const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY)

const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const qa = {
  orgPrimary: 'Codex QA Matrix Org A',
  orgForeign: 'Codex QA Matrix Org B',
  obraPrimary: 'Codex QA Obra Principal',
  obraForeign: 'Codex QA Obra Foreign',
}

const credentials = {
  admin: {
    email: String(process.env.E2E_USER_EMAIL),
    password: String(process.env.E2E_USER_PASSWORD),
    name: 'Codex QA Admin',
    role: 'admin',
    cargo: 'Diretor QA',
  },
  manager: {
    email: String(process.env.E2E_MANAGER_EMAIL),
    password: String(process.env.E2E_MANAGER_PASSWORD),
    name: 'Codex QA Manager',
    role: 'manager',
    cargo: 'Gerente QA',
  },
  member: {
    email: String(process.env.E2E_ROLE_USER_EMAIL),
    password: String(process.env.E2E_ROLE_USER_PASSWORD),
    name: 'Codex QA User',
    role: 'user',
    cargo: 'Operador QA',
  },
  foreign: {
    email: String(process.env.E2E_FOREIGN_EMAIL),
    password: String(process.env.E2E_FOREIGN_PASSWORD),
    name: 'Codex QA Foreign',
    role: 'admin',
    cargo: 'Diretor QA',
  },
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchToken(email, password, maxAttempts = 6) {
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
      if (!response.ok) {
        throw new Error(`Auth failed for ${email}: ${response.status} ${JSON.stringify(payload)}`)
      }

      const accessToken = payload?.access_token
      if (!accessToken) {
        throw new Error(`No access_token for ${email}`)
      }

      return accessToken
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts) {
        await wait(500 * attempt)
      }
    }
  }

  throw lastError || new Error(`Unable to fetch token for ${email}`)
}

async function findAuthUserByEmail(email) {
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const users = data?.users || []
    const user = users.find((item) => item.email?.toLowerCase() === email.toLowerCase())
    if (user) return user

    if (users.length < perPage) return null
    page += 1
  }
}

async function ensureAuthUser({ email, password, name }) {
  const existing = await findAuthUserByEmail(email)
  if (existing) {
    const { data, error } = await service.auth.admin.updateUserById(existing.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
      },
    })
    if (error) throw error
    return data.user
  }

  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
    },
  })
  if (error) throw error
  return data.user
}

async function ensureOrganization(name) {
  const { data: existing, error: fetchError } = await service
    .from('organizacoes')
    .select('id')
    .eq('nome', name)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (existing?.id) return existing.id

  const { data, error } = await service
    .from('organizacoes')
    .insert({
      nome: name,
      plano: 'pro',
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

async function ensureMembership({ orgId, userId, role }) {
  const { data: existing, error: fetchError } = await service
    .from('org_membros')
    .select('id, role, status')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (!existing?.id) {
    const { error } = await service.from('org_membros').insert({
      org_id: orgId,
      user_id: userId,
      role,
      status: 'ativo',
    })
    if (error) throw error
    return
  }

  if (existing.role !== role || existing.status !== 'ativo') {
    const { error } = await service
      .from('org_membros')
      .update({
        role,
        status: 'ativo',
      })
      .eq('id', existing.id)
    if (error) throw error
  }
}

async function ensureProfile({ id, email, nome, cargo, orgId }) {
  const { data: existing, error: fetchError } = await service
    .from('profiles')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) throw fetchError

  if (!existing?.id) {
    const { error } = await service.from('profiles').insert({
      id,
      nome,
      email,
      empresa: 'STRKTR QA',
      cargo,
      org_id: orgId,
    })
    if (error) throw error
    return
  }

  const { error } = await service
    .from('profiles')
    .update({
      nome,
      email,
      empresa: 'STRKTR QA',
      cargo,
      org_id: orgId,
    })
    .eq('id', id)
  if (error) throw error
}

async function ensureObra({ orgId, userId, nome }) {
  const { data: existing, error: fetchError } = await service
    .from('obras')
    .select('id')
    .eq('org_id', orgId)
    .eq('nome', nome)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (existing?.id) return existing.id

  const now = new Date()
  const start = now.toISOString().slice(0, 10)
  const due = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data, error } = await service
    .from('obras')
    .insert({
      org_id: orgId,
      user_id: userId,
      nome,
      cliente: 'Cliente QA',
      local: 'Ambiente QA',
      tipo: 'residencial',
      valor_contrato: 120000,
      valor_gasto: 15000,
      progresso: 10,
      status: 'Em Andamento',
      etapa_atual: 'Fundação',
      area_m2: 120,
      data_inicio: start,
      data_previsao: due,
      descricao: 'Obra provisionada automaticamente para E2E matrix.',
      cor: '#9F7A56',
      icone: 'home',
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

function setOutput(name, value) {
  if (!value) return
  console.log(`::add-mask::${value}`)

  if (process.env.GITHUB_ENV) {
    appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`, { encoding: 'utf8' })
    return
  }

  process.stdout.write(`${name}=${value}\n`)
}

async function main() {
  const admin = await ensureAuthUser(credentials.admin)
  const manager = await ensureAuthUser(credentials.manager)
  const member = await ensureAuthUser(credentials.member)
  const foreign = await ensureAuthUser(credentials.foreign)

  const orgPrimaryId = await ensureOrganization(qa.orgPrimary)
  const orgForeignId = await ensureOrganization(qa.orgForeign)

  await ensureMembership({ orgId: orgPrimaryId, userId: admin.id, role: credentials.admin.role })
  await ensureMembership({ orgId: orgPrimaryId, userId: manager.id, role: credentials.manager.role })
  await ensureMembership({ orgId: orgPrimaryId, userId: member.id, role: credentials.member.role })
  await ensureMembership({ orgId: orgForeignId, userId: foreign.id, role: credentials.foreign.role })

  await ensureProfile({
    id: admin.id,
    email: credentials.admin.email,
    nome: credentials.admin.name,
    cargo: credentials.admin.cargo,
    orgId: orgPrimaryId,
  })
  await ensureProfile({
    id: manager.id,
    email: credentials.manager.email,
    nome: credentials.manager.name,
    cargo: credentials.manager.cargo,
    orgId: orgPrimaryId,
  })
  await ensureProfile({
    id: member.id,
    email: credentials.member.email,
    nome: credentials.member.name,
    cargo: credentials.member.cargo,
    orgId: orgPrimaryId,
  })
  await ensureProfile({
    id: foreign.id,
    email: credentials.foreign.email,
    nome: credentials.foreign.name,
    cargo: credentials.foreign.cargo,
    orgId: orgForeignId,
  })

  const primaryObraId = await ensureObra({
    orgId: orgPrimaryId,
    userId: admin.id,
    nome: qa.obraPrimary,
  })
  const foreignObraId = await ensureObra({
    orgId: orgForeignId,
    userId: foreign.id,
    nome: qa.obraForeign,
  })

  const adminToken = await fetchToken(credentials.admin.email, credentials.admin.password)
  const managerToken = await fetchToken(credentials.manager.email, credentials.manager.password)
  const memberToken = await fetchToken(credentials.member.email, credentials.member.password)

  setOutput('E2E_BEARER_TOKEN', adminToken)
  setOutput('E2E_MANAGER_BEARER_TOKEN', managerToken)
  setOutput('E2E_USER_BEARER_TOKEN', memberToken)
  setOutput('E2E_OBRA_ID', primaryObraId)
  setOutput('E2E_FOREIGN_OBRA_ID', foreignObraId)

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        orgPrimaryId,
        orgForeignId,
        primaryObraId,
        foreignObraId,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  const formattedMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'object'
        ? JSON.stringify(error)
        : String(error)

  const details =
    error && typeof error === 'object'
      ? JSON.stringify(error, Object.getOwnPropertyNames(error))
      : null

  console.error(
    JSON.stringify(
      {
        status: 'error',
        message: formattedMessage,
        details,
      },
      null,
      2
    )
  )
  process.exit(1)
})
