export type Workspace = {
  id: string
  name: string
  use_case: string
  theme: string
  default_screen_id: string | null
}

export type WorkApp = {
  id: string
  name: string
  url: string
  source_type: string
  display_mode: 'embed' | 'external'
  category: string
  icon: string
  description: string
  is_staff_visible: boolean
  sort_order: number
}

export type Note = {
  id: string
  title: string
  body: string
  is_pinned: boolean
  is_staff_visible: boolean
  updated_at: string
}

export type Announcement = {
  id: string
  title: string
  body: string
  priority: 'normal' | 'important'
  is_visible: boolean
  updated_at: string
}

export type ChecklistItem = {
  id: string
  checklist_id: string
  label: string
  sort_order: number
  is_done: boolean
}

export type Checklist = {
  id: string
  title: string
  description: string
  reset_policy: string
  is_staff_visible: boolean
  items: ChecklistItem[]
}

export type FileItem = {
  id: string
  name: string
  mime_type: string
  size: number
  category: string
  is_staff_visible: boolean
  updated_at: string
}

export type AIProvider = {
  id: string
  provider: 'openai_compatible' | 'ollama'
  provider_type: string
  display_name: string
  model: string
  endpoint_url: string
  auth_type: string
  is_enabled: boolean
  is_default: boolean
  has_api_key: boolean
}

export type AIActionProposal = {
  action_key: string
  title: string
  summary: string
  input: Record<string, unknown>
  risk_level: string
  requires_confirmation: boolean
}

export type AppData = {
  workspace: Workspace | null
  workApps: WorkApp[]
  notes: Note[]
  announcements: Announcement[]
  checklists: Checklist[]
  files: FileItem[]
  providers: AIProvider[]
}

