import { z } from 'zod'

export const userProfileTypeSchema = z.enum([
  'owner',
  'manager',
  'architect',
  'finance',
  'field',
])

export const roadmapActionStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'dismissed',
])

export const completeRoadmapActionSchema = z.object({
  status: roadmapActionStatusSchema
    .extract(['completed', 'dismissed'])
    .default('completed'),
})

export type CompleteRoadmapActionDTO = z.infer<typeof completeRoadmapActionSchema>

export const automationTriggerSchema = z.enum([
  'LeadCreated',
  'ObraCreated',
  'ApprovalRejected',
])

export const createAutomationRuleSchema = z.object({
  trigger: automationTriggerSchema,
  templateCode: z.string().trim().min(2, 'Template é obrigatório'),
  enabled: z.boolean().optional().default(true),
  requiresReview: z.boolean().optional().default(true),
  cooldownHours: z.number().int().min(1).max(168).default(12),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type CreateAutomationRuleDTO = z.infer<typeof createAutomationRuleSchema>

export const updateAutomationRuleSchema = createAutomationRuleSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Payload vazio',
  })

export type UpdateAutomationRuleDTO = z.infer<typeof updateAutomationRuleSchema>

export const runAutomationPreviewSchema = z.object({
  trigger: automationTriggerSchema,
  triggerEntityType: z.string().trim().min(2, 'triggerEntityType é obrigatório'),
  triggerEntityId: z.string().trim().min(2, 'triggerEntityId é obrigatório'),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export type RunAutomationPreviewDTO = z.infer<typeof runAutomationPreviewSchema>

export const runAutomationJobSchema = runAutomationPreviewSchema.extend({
  confirm: z.boolean().optional().default(false),
})

export type RunAutomationJobDTO = z.infer<typeof runAutomationJobSchema>
