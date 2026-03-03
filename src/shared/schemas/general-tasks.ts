import { z } from 'zod'

const taskStatusSchema = z.enum(['todo', 'in_progress', 'blocked', 'done'])
const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent'])

const nullableTrimmedText = (max: number) =>
  z
    .union([z.string(), z.null()])
    .transform((value) => {
      if (value === null) return null
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : null
    })
    .refine((value) => !value || value.length <= max, `Máximo de ${max} caracteres`)
    .optional()

const nullableDateSchema = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  })
  .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Data inválida (YYYY-MM-DD)')
  .optional()

export const createGeneralTaskSchema = z.object({
  title: z.string().trim().min(3, 'Título muito curto').max(160, 'Título muito longo'),
  description: nullableTrimmedText(2000),
  status: taskStatusSchema.optional().default('todo'),
  priority: taskPrioritySchema.optional().default('medium'),
  due_date: nullableDateSchema,
  assignee_user_id: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).max(1000000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
})

export type CreateGeneralTaskDTO = z.infer<typeof createGeneralTaskSchema>

export const updateGeneralTaskSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: nullableTrimmedText(2000),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    due_date: nullableDateSchema,
    assignee_user_id: z.string().uuid().nullable().optional(),
    position: z.number().int().min(0).max(1000000).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: 'Payload vazio',
  })

export type UpdateGeneralTaskDTO = z.infer<typeof updateGeneralTaskSchema>

export const assignGeneralTaskSchema = z.object({
  assignee_user_id: z.string().uuid(),
})

export type AssignGeneralTaskDTO = z.infer<typeof assignGeneralTaskSchema>
