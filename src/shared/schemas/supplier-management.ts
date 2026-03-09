import { z } from 'zod'

export const supplierStatusSchema = z.enum(['active', 'watchlist', 'blocked'])

export const createSupplierSchema = z.object({
  nome: z.string().trim().min(2, 'Nome do fornecedor é obrigatório'),
  documento: z.string().trim().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable(),
  telefone: z.string().trim().optional().nullable(),
  cidade: z.string().trim().optional().nullable(),
  estado: z.string().trim().optional().nullable(),
  status: supplierStatusSchema.default('active'),
  score_manual: z.number().int().min(0, 'Score mínimo 0').max(100, 'Score máximo 100').default(60),
  notas: z.string().trim().optional().nullable(),
})

export type CreateSupplierDTO = z.infer<typeof createSupplierSchema>

export const updateSupplierSchema = createSupplierSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: 'Payload vazio',
  }
)

export type UpdateSupplierDTO = z.infer<typeof updateSupplierSchema>
