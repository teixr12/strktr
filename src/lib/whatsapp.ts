const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0'

interface WhatsAppConfig {
  token: string
  phoneId: string
}

function getConfig(): WhatsAppConfig | null {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  if (!token || !phoneId) return null
  return { token, phoneId }
}

export async function sendTextMessage(to: string, text: string) {
  const config = getConfig()
  if (!config) {
    console.log('[WhatsApp] Não configurado — mensagem ignorada')
    return null
  }

  try {
    const res = await fetch(
      `${WHATSAPP_API_URL}/${config.phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      }
    )

    const data = await res.json()
    if (!res.ok) {
      console.error('[WhatsApp] Erro:', data)
      return null
    }

    return data
  } catch (error) {
    console.error('[WhatsApp] Falha ao enviar:', error)
    return null
  }
}

export function isWhatsAppConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID)
}
