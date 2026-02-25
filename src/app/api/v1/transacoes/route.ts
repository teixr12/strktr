import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api/auth'

export async function GET(request: Request) {
  const { user, supabase, error } = await getApiUser(request)
  if (!user || !supabase) return NextResponse.json({ error }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const tipo = searchParams.get('tipo')
  const obra_id = searchParams.get('obra_id')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

  let query = supabase.from('transacoes').select('*, obras(nome)').order('data', { ascending: false }).limit(limit)
  if (tipo) query = query.eq('tipo', tipo)
  if (obra_id) query = query.eq('obra_id', obra_id)

  const { data, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ data, count: data?.length || 0 })
}

export async function POST(request: Request) {
  const { user, supabase, error } = await getApiUser(request)
  if (!user || !supabase) return NextResponse.json({ error }, { status: 401 })

  const body = await request.json()
  const { data, error: dbError } = await supabase
    .from('transacoes')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
}
