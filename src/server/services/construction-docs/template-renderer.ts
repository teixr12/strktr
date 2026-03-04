import type { ConstructionDocsTemplateDSL } from '@/shared/types/construction-docs'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderBlock(block: ConstructionDocsTemplateDSL['blocks'][number], payload: Record<string, unknown>): string {
  const props = block.props || {}
  if (block.type === 'header') {
    const title = String(props.title || payload.title || 'Documento')
    return `<header><h1>${escapeHtml(title)}</h1></header>`
  }
  if (block.type === 'section') {
    const title = String(props.title || 'Seção')
    return `<section><h2>${escapeHtml(title)}</h2></section>`
  }
  if (block.type === 'table') {
    const rows = Array.isArray(props.rows) ? props.rows : []
    const rendered = rows
      .map((row) => {
        const columns = Array.isArray(row) ? row : [row]
        return `<tr>${columns.map((col) => `<td>${escapeHtml(String(col))}</td>`).join('')}</tr>`
      })
      .join('')
    return `<table border="1" cellspacing="0" cellpadding="6">${rendered}</table>`
  }
  if (block.type === 'photo-grid') {
    const photos = Array.isArray(payload.photos) ? payload.photos : []
    const rendered = photos
      .slice(0, 12)
      .map((photo) => {
        const url = typeof photo === 'string' ? photo : typeof photo === 'object' && photo && 'url' in photo ? String((photo as { url: unknown }).url || '') : ''
        return url ? `<img src="${escapeHtml(url)}" alt="photo" style="max-width: 220px; border-radius: 8px;" />` : ''
      })
      .join('')
    return `<div style="display:flex;flex-wrap:wrap;gap:8px;">${rendered}</div>`
  }
  if (block.type === 'signature') {
    const label = String(props.label || 'Assinatura')
    return `<div style="margin-top:20px;"><p>${escapeHtml(label)}</p><div style="height:1px;background:#333;margin-top:24px;"></div></div>`
  }
  const text = String(props.text || payload.text || '')
  return `<p>${escapeHtml(text)}</p>`
}

export function renderTemplateHtml(
  dsl: ConstructionDocsTemplateDSL,
  payload: Record<string, unknown>
): string {
  const blocks = dsl.blocks || []
  const body = blocks.map((block) => renderBlock(block, payload)).join('\n')
  return [
    '<!doctype html>',
    '<html><head><meta charset="utf-8"/><title>Construction Docs</title></head>',
    '<body style="font-family:Arial,sans-serif;padding:24px;color:#111827;">',
    body,
    '</body></html>',
  ].join('\n')
}

export function toCsvRows(payload: Record<string, unknown>): string {
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : []
  const header = 'id,title,startsAt,endsAt,dependsOn'
  const rows = tasks.map((task) => {
    const safe = typeof task === 'object' && task ? (task as Record<string, unknown>) : {}
    const depends = Array.isArray(safe.dependsOn) ? safe.dependsOn.join('|') : ''
    return [
      String(safe.id || ''),
      String(safe.title || ''),
      String(safe.startsAt || ''),
      String(safe.endsAt || ''),
      depends,
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(',')
  })
  return [header, ...rows].join('\n')
}

