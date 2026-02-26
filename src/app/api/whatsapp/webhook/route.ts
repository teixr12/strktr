import { NextResponse } from 'next/server'

// GET — Meta webhook verification
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp] Webhook verificado com sucesso')
    return new Response(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Verificação falhou' }, { status: 403 })
}

// POST — Receive messages
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Log received webhook
    console.log('[WhatsApp] Webhook recebido:', JSON.stringify(body).substring(0, 500))

    // Extract messages from webhook payload
    const entries = body?.entry || []
    for (const entry of entries) {
      const changes = entry?.changes || []
      for (const change of changes) {
        if (change.field !== 'messages') continue
        const messages = change.value?.messages || []

        for (const msg of messages) {
          console.log(`[WhatsApp] Mensagem de ${msg.from}: ${msg.text?.body || msg.type}`)
          // Future: save to whatsapp_messages table and process
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WhatsApp] Erro no webhook:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
