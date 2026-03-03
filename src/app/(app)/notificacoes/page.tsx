import { createClient } from '@/lib/supabase/server'
import { NotificacoesContent } from '@/components/notificacoes/notificacoes-content'

export const dynamic = 'force-dynamic'

export default async function NotificacoesPage() {
  const supabase = await createClient()
  const { data: session } = await supabase.auth.getSession()

  let notificacoes: Array<{
    id: string
    tipo: string
    titulo: string
    descricao: string | null
    link: string | null
    lida: boolean
    created_at: string
  }> = []

  if (session?.session?.user) {
    const { data } = await supabase
      .from('notificacoes')
      .select('id, tipo, titulo, descricao, link, lida, created_at')
      .eq('user_id', session.session.user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    notificacoes = data ?? []
  }

  return <NotificacoesContent initialNotificacoes={notificacoes} />
}
