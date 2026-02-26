function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

export function buildSimplePdf(lines: string[]): Buffer {
  const safeLines = lines.slice(0, 120).map((line) => escapePdfText(line))
  let y = 790
  const commands: string[] = ['BT', '/F1 10 Tf']
  for (const line of safeLines) {
    commands.push(`72 ${y} Td (${line}) Tj`)
    commands.push('-72 0 Td')
    y -= 14
    if (y < 72) break
  }
  commands.push('ET')

  const contentStream = commands.join('\n')
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${contentStream.length} >> stream\n${contentStream}\nendstream endobj`,
  ]

  const header = '%PDF-1.4\n'
  let body = ''
  const offsets: number[] = [0]
  let cursor = header.length
  for (const obj of objects) {
    offsets.push(cursor)
    body += `${obj}\n`
    cursor = header.length + body.length
  }

  const xrefOffset = header.length + body.length
  let xref = `xref\n0 ${objects.length + 1}\n`
  xref += '0000000000 65535 f \n'
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`
  }

  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return Buffer.from(`${header}${body}${xref}${trailer}`, 'utf-8')
}
