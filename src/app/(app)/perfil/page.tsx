import { createClient } from '@/lib/supabase/server'
import { PerfilContent } from '@/components/perfil/perfil-content'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profileSelect = 'id, nome, email, avatar_url, empresa, cargo, telefone, created_at, updated_at'
  const { data: profile } = await supabase
    .from('profiles')
    .select(profileSelect)
    .eq('id', user.id)
    .single()

  return <PerfilContent profile={profile} />
}
