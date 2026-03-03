export type GeneralTaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done'
export type GeneralTaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface GeneralTask {
  id: string
  org_id: string
  created_by: string
  assignee_user_id: string | null
  title: string
  description: string | null
  status: GeneralTaskStatus
  priority: GeneralTaskPriority
  position: number
  due_date: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface GeneralTaskListPayload {
  items: GeneralTask[]
}
