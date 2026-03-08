import { z } from 'zod'

const scopeCodesSchema = z.array(z.string().trim().min(3).max(64)).min(1).max(16)
const actionCodesSchema = z.array(z.string().trim().min(3).max(64)).min(1).max(16)

const optionalNullableText = (max: number) =>
  z
    .union([z.string(), z.null()])
    .transform((value) => {
      if (value === null) return null
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : null
    })
    .refine((value) => !value || value.length <= max, `Máximo de ${max} caracteres`)
    .optional()

export const agentReadyProfileCreateSchema = z.object({
  name: z.string().trim().min(2, 'Nome é obrigatório').max(120, 'Máximo de 120 caracteres'),
  agent_type: z.enum(['internal_assistant', 'external_llm', 'workflow_agent', 'human_proxy']),
  scope_codes: scopeCodesSchema,
  action_codes: actionCodesSchema,
  notes: optionalNullableText(1000),
})

export const agentReadyProfilePatchSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    agent_type: z.enum(['internal_assistant', 'external_llm', 'workflow_agent', 'human_proxy']).optional(),
    status: z.enum(['draft', 'active', 'paused', 'revoked']).optional(),
    scope_codes: scopeCodesSchema.optional(),
    action_codes: actionCodesSchema.optional(),
    notes: optionalNullableText(1000),
  })
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: 'Payload vazio',
  })

export type AgentReadyProfileCreateDTO = z.infer<typeof agentReadyProfileCreateSchema>
export type AgentReadyProfilePatchDTO = z.infer<typeof agentReadyProfilePatchSchema>
