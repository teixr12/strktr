import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM_EMAIL = 'STRKTR <onboarding@resend.dev>'

export async function sendWelcomeEmail(to: string, nome: string) {
  if (!resend) {
    console.log('[Resend] API key não configurada — email de boas-vindas ignorado')
    return null
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Bem-vindo ao STRKTR!',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
          <h1 style="font-size: 24px; color: #1a1a1a;">Olá, ${nome}! 👋</h1>
          <p style="color: #555; line-height: 1.6;">
            Sua conta no <strong>STRKTR</strong> foi criada com sucesso.
            Agora você tem acesso completo ao sistema de gestão premium de obras.
          </p>
          <a href="https://strktr.vercel.app/dashboard"
             style="display: inline-block; padding: 12px 24px; background: #d4a373; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; margin-top: 16px;">
            Acessar Dashboard
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 32px;">
            STRKTR — Gestão Premium de Obras
          </p>
        </div>
      `,
    })
    if (error) console.error('[Resend] Erro:', error)
    return data
  } catch (err) {
    console.error('[Resend] Falha ao enviar email:', err)
    return null
  }
}

export async function sendNotificationEmail(
  to: string,
  subject: string,
  titulo: string,
  descricao: string,
  link?: string
) {
  if (!resend) {
    console.log('[Resend] API key não configurada — notificação por email ignorada')
    return null
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
          <h2 style="font-size: 20px; color: #1a1a1a;">${titulo}</h2>
          <p style="color: #555; line-height: 1.6;">${descricao}</p>
          ${link ? `
            <a href="${link}"
               style="display: inline-block; padding: 10px 20px; background: #d4a373; color: white; text-decoration: none; border-radius: 10px; font-weight: 600; margin-top: 12px;">
              Ver Detalhes
            </a>
          ` : ''}
          <p style="color: #999; font-size: 12px; margin-top: 32px;">
            STRKTR — Gestão Premium de Obras
          </p>
        </div>
      `,
    })
    if (error) console.error('[Resend] Erro:', error)
    return data
  } catch (err) {
    console.error('[Resend] Falha ao enviar:', err)
    return null
  }
}
