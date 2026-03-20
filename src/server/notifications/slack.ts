import { log } from '@/lib/api/logger'

export interface SlackMessagePayload {
  text: string
}

type SlackLogContext = {
  requestId?: string
  orgId?: string | null
  route?: string
  userId?: string
  [key: string]: unknown
}

function withRequestId(context?: SlackLogContext) {
  return {
    requestId: context?.requestId || 'system',
    orgId: context?.orgId,
    route: context?.route,
    userId: context?.userId,
    ...context,
  }
}

export async function sendSlackMessage(
  payload: SlackMessagePayload,
  context?: SlackLogContext
): Promise<boolean> {
  const webhookUrl = (process.env.SLACK_WEBHOOK_URL || '').trim()

  if (!webhookUrl) {
    log('warn', 'slack.webhook.missing', withRequestId(context))
    return false
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      log('error', 'slack.webhook.failed', withRequestId({ ...context, status: response.status, body }))
      return false
    }

    return true
  } catch (error) {
    log(
      'error',
      'slack.webhook.failed',
      withRequestId({
        ...context,
        error: error instanceof Error ? error.message : 'Falha ao enviar mensagem ao Slack',
      })
    )
    return false
  }
}
