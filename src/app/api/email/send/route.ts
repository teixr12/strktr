import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendNotificationEmail } from '@/lib/email/resend'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { to, subject, titulo, descricao, link } = body

    if (!to || !subject || !titulo) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: to, subject, titulo' },
        { status: 400 }
      )
    }

    const result = await sendNotificationEmail(to, subject, titulo, descricao || '', link)

    if (!result) {
      return NextResponse.json(
        { error: 'Resend API key não configurada ou erro no envio' },
        { status: 503 }
      )
    }

    return NextResponse.json({ success: true, id: result.id })
  } catch (error) {
    console.error('[API Email] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
