import { z } from 'zod'

export const referralStatusSchema = z.enum(['draft', 'sent', 'activated', 'rewarded', 'expired'])

export const createReferralSchema = z.object({
  invited_email: z.string().email('Email inválido').optional().nullable(),
  referred_name: z.string().trim().min(2, 'Nome mínimo de 2 caracteres').optional().nullable(),
  status: referralStatusSchema.default('draft'),
  reward_cents: z.number().int().min(0, 'Valor mínimo 0').default(0),
  notes: z.string().trim().optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
})

export type CreateReferralDTO = z.infer<typeof createReferralSchema>

export const updateReferralSchema = createReferralSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: 'Payload vazio',
  }
)

export type UpdateReferralDTO = z.infer<typeof updateReferralSchema>
