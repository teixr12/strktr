import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerActiveOrgId } from '@/lib/auth/server-org'
import { isSupplierManagementV1EnabledForOrg } from '@/server/feature-flags/wave2-canary'
import { FornecedoresContent } from '@/components/fornecedores/fornecedores-content'
import type { SupplierRecord, SupplierSummary } from '@/shared/types/supplier-management'

export const dynamic = 'force-dynamic'

const SUPPLIER_COLUMNS =
  'id, org_id, nome, documento, email, telefone, cidade, estado, status, score_manual, notas, created_at, updated_at'

function buildSummary(items: SupplierRecord[]): SupplierSummary {
  if (items.length === 0) {
    return {
      total: 0,
      active: 0,
      watchlist: 0,
      blocked: 0,
      averageScore: 0,
    }
  }

  const active = items.filter((item) => item.status === 'active').length
  const watchlist = items.filter((item) => item.status === 'watchlist').length
  const blocked = items.filter((item) => item.status === 'blocked').length
  const averageScore = items.reduce((sum, item) => sum + item.score_manual, 0) / items.length

  return {
    total: items.length,
    active,
    watchlist,
    blocked,
    averageScore: Number(averageScore.toFixed(1)),
  }
}

export default async function FornecedoresPage() {
  const supabase = await createClient()
  const orgId = await getServerActiveOrgId(supabase)

  if (!isSupplierManagementV1EnabledForOrg(orgId)) {
    notFound()
  }

  const { data } = await supabase
    .from('fornecedores')
    .select(SUPPLIER_COLUMNS)
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .range(0, 49)

  const normalized = ((data || []) as SupplierRecord[])

  return <FornecedoresContent initialSuppliers={normalized} initialSummary={buildSummary(normalized)} />
}
