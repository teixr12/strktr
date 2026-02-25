import { NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api/auth'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await getApiUser(request)
  if (!user || !supabase) return NextResponse.json({ error }, { status: 401 })

  const { id } = await params
  const { data, error: dbError } = await supabase.from('leads').select('*').eq('id', id).single()
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 404 })

  return NextResponse.json({ data })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await getApiUser(request)
  if (!user || !supabase) return NextResponse.json({ error }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { data, error: dbError } = await supabase.from('leads').update(body).eq('id', id).select().single()
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })

  return NextResponse.json({ data })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error } = await getApiUser(request)
  if (!user || !supabase) return NextResponse.json({ error }, { status: 401 })

  const { id } = await params
  const { error: dbError } = await supabase.from('leads').delete().eq('id', id)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
