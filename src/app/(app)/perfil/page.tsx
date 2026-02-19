import { createClient } from '@/lib/supabase/server'
import { PerfilContent } from '@/components/perfil/perfil-content'
import { redirect } from 'next/navigation'

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return <PerfilContent profile={profile} />
}
