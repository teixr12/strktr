export type ReferralStatus = 'draft' | 'sent' | 'activated' | 'rewarded' | 'expired'

export interface ReferralRecord {
  id: string
  org_id: string
  code: string
  invited_email: string | null
  referred_name: string | null
  status: ReferralStatus
  reward_cents: number
  notes: string | null
  expires_at: string | null
  sent_at: string | null
  activated_at: string | null
  created_at: string
  updated_at: string
}

export interface ReferralSummary {
  total: number
  draft: number
  sent: number
  activated: number
  rewarded: number
  expired: number
  totalRewardCents: number
}
