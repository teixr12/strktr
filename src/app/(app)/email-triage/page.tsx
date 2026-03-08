import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerActiveOrgId } from '@/lib/auth/server-org'
import { isEmailTriageV1EnabledForOrg } from '@/server/feature-flags/wave2-canary'
import { EmailTriageContent } from '@/components/email-triage/email-triage-content'
import type { EmailTriageLeadOption, EmailTriageRecord, EmailTriageSummary } from '@/shared/types/email-triage'

export const dynamic = 'force-dynamic'

const EMAIL_TRIAGE_COLUMNS = [
  'id',
  'org_id',
  'source',
  'sender_name',
  'sender_email',
  'subject',
  'snippet',
  'classification',
  'status',
  'lead_id',
  'received_at',
  'reviewed_at',
  'notes',
  'created_at',
  'updated_at',
].join(', ')

type RawEmailTriageRow = Omit<EmailTriageRecord, 'lead_nome'>

function buildSummary(rows: Array<Pick<EmailTriageRecord, 'classification' | 'status' | 'lead_id'>>): EmailTriageSummary {
  return {
    total: rows.length,
    unreviewed: rows.filter((row) => row.status === 'new' || row.status === 'reviewing').length,
    leadCandidates: rows.filter((row) => row.classification === 'lead').length,
    supplierCandidates: rows.filter((row) => row.classification === 'supplier').length,
    spam: rows.filter((row) => row.classification === 'spam').length,
    linkedLeads: rows.filter((row) => Boolean(row.lead_id)).length,
  }
}

export default async function EmailTriagePage() {
  const supabase = await createClient()
  const orgId = await getServerActiveOrgId(supabase)

  if (!isEmailTriageV1EnabledForOrg(orgId)) {
    notFound()
  }

  const [itemsRes, summaryRes, leadsRes] = await Promise.all([
    supabase
      .from('email_triage_items')
      .select(EMAIL_TRIAGE_COLUMNS)
      .eq('org_id', orgId)
      .order('received_at', { ascending: false })
      .range(0, 49),
    supabase
      .from('email_triage_items')
      .select('classification, status, lead_id')
      .eq('org_id', orgId),
    supabase
      .from('leads')
      .select('id, nome')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(100),
  ])

  const leadNames = new Map((((leadsRes.data || []) as unknown) as EmailTriageLeadOption[]).map((lead) => [lead.id, lead.nome]))
  const initialItems = ((((itemsRes.data || []) as unknown) as RawEmailTriageRow[])).map((item) => ({
    ...item,
    lead_nome: item.lead_id ? leadNames.get(item.lead_id) || null : null,
  }))

  return (
    <EmailTriageContent
      initialItems={initialItems}
      initialSummary={buildSummary((((summaryRes.data || []) as unknown) as Array<Pick<EmailTriageRecord, 'classification' | 'status' | 'lead_id'>>))}
      initialLeads={((((leadsRes.data || []) as unknown) as EmailTriageLeadOption[]).map((lead) => ({ ...lead, nome: lead.nome || 'Lead' })))}
    />
  )
}
