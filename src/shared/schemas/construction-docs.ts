import { z } from 'zod'

const uuidSchema = z.string().uuid()
const nullableUuidSchema = z.union([uuidSchema, z.null()]).optional()

export const constructionVisitTypeSchema = z.enum(['PRE', 'POST'])
export const constructionDocTypeSchema = z.enum(['INSPECTION', 'SOP', 'SCHEDULE'])
export const constructionDocStatusSchema = z.enum(['DRAFT', 'FINAL'])
export const constructionAnnotationTypeSchema = z.enum(['arrow', 'rect', 'text'])

export const createProjectLinkSchema = z.object({
  project_id: uuidSchema,
  obra_id: nullableUuidSchema,
})

export const createVisitSchema = z.object({
  project_link_id: uuidSchema,
  type: constructionVisitTypeSchema.default('PRE'),
  visit_date: z.string().trim().min(10),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
})

export const updateVisitSchema = z
  .object({
    type: constructionVisitTypeSchema.optional(),
    visit_date: z.string().trim().min(10).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: 'Payload vazio',
  })

export const createRoomSchema = z.object({
  name: z.string().trim().min(1).max(160),
  sort_order: z.number().int().min(0).max(5000).default(0),
})

export const uploadPhotoInputSchema = z.object({
  room_id: nullableUuidSchema,
  filename: z.string().trim().min(1).max(180),
  mime_type: z.string().trim().min(3).max(80),
  base64: z.string().trim().min(8),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
})

export const uploadPhotosSchema = z.object({
  files: z.array(uploadPhotoInputSchema).min(1).max(20),
})

export const createAnnotationSchema = z.object({
  type: constructionAnnotationTypeSchema,
  geometry: z.record(z.string(), z.unknown()),
  text: z.union([z.string().trim().max(1000), z.null()]).optional(),
})

export const updateAnnotationSchema = z
  .object({
    type: constructionAnnotationTypeSchema.optional(),
    geometry: z.record(z.string(), z.unknown()).optional(),
    text: z.union([z.string().trim().max(1000), z.null()]).optional(),
  })
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: 'Payload vazio',
  })

const templateBlockTypeSchema = z.enum(['header', 'section', 'text', 'table', 'photo-grid', 'signature'])
const templateBlockSchema = z.object({
  id: z.string().trim().min(1),
  type: templateBlockTypeSchema,
  props: z.record(z.string(), z.unknown()).default({}),
})

export const templateDslSchema = z.object({
  version: z.number().int().min(1).default(1),
  blocks: z.array(templateBlockSchema).min(1).max(200),
})

export const createTemplateSchema = z.object({
  doc_type: constructionDocTypeSchema,
  name: z.string().trim().min(3).max(160),
  dsl: templateDslSchema,
  is_active: z.boolean().optional().default(true),
})

export const updateTemplateSchema = z
  .object({
    name: z.string().trim().min(3).max(160).optional(),
    dsl: templateDslSchema.optional(),
    is_active: z.boolean().optional(),
  })
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: 'Payload vazio',
  })

export const createDocumentSchema = z.object({
  project_id: uuidSchema,
  obra_id: nullableUuidSchema,
  type: constructionDocTypeSchema,
  status: constructionDocStatusSchema.default('DRAFT'),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  rendered_html: z.union([z.string().max(500000), z.null()]).optional(),
})

export const updateDocumentSchema = z
  .object({
    status: constructionDocStatusSchema.optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
    rendered_html: z.union([z.string().max(500000), z.null()]).optional(),
  })
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: 'Payload vazio',
  })

export const generateDocumentSchema = z.object({
  visit_id: uuidSchema.optional(),
  project_id: uuidSchema,
  obra_id: nullableUuidSchema,
  prompt: z.string().trim().max(4000).optional(),
  template_id: uuidSchema.optional(),
  input: z.record(z.string(), z.unknown()).optional().default({}),
})

export const createShareLinkSchema = z.object({
  expires_in_days: z.number().int().min(1).max(90).optional().default(7),
  password: z.union([z.string().trim().min(4).max(120), z.null()]).optional(),
})

export const deleteShareLinkSchema = z.object({
  share_link_id: uuidSchema,
})

export const shareAccessSchema = z.object({
  password: z.union([z.string().trim().min(1).max(120), z.null()]).optional(),
})

export const shareDocumentWhatsAppSchema = z.object({
  to: z.string().trim().min(8).max(32),
  message: z.string().trim().max(1000).optional(),
  share_url: z.string().trim().url().optional(),
})

export const sendDocumentEmailSchema = z.object({
  to: z.string().trim().email(),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().max(5000).optional(),
  share_url: z.string().trim().url().optional(),
})

export type CreateProjectLinkDTO = z.infer<typeof createProjectLinkSchema>
export type CreateVisitDTO = z.infer<typeof createVisitSchema>
export type UpdateVisitDTO = z.infer<typeof updateVisitSchema>
export type CreateRoomDTO = z.infer<typeof createRoomSchema>
export type UploadPhotosDTO = z.infer<typeof uploadPhotosSchema>
export type CreateAnnotationDTO = z.infer<typeof createAnnotationSchema>
export type UpdateAnnotationDTO = z.infer<typeof updateAnnotationSchema>
export type CreateTemplateDTO = z.infer<typeof createTemplateSchema>
export type UpdateTemplateDTO = z.infer<typeof updateTemplateSchema>
export type CreateDocumentDTO = z.infer<typeof createDocumentSchema>
export type UpdateDocumentDTO = z.infer<typeof updateDocumentSchema>
export type GenerateDocumentDTO = z.infer<typeof generateDocumentSchema>
export type CreateShareLinkDTO = z.infer<typeof createShareLinkSchema>
export type DeleteShareLinkDTO = z.infer<typeof deleteShareLinkSchema>
export type ShareAccessDTO = z.infer<typeof shareAccessSchema>
export type ShareDocumentWhatsAppDTO = z.infer<typeof shareDocumentWhatsAppSchema>
export type SendDocumentEmailDTO = z.infer<typeof sendDocumentEmailSchema>
