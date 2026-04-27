export type OwnerType = 'question' | 'asset' | 'other' | string

export interface Owner {
  id: string
  owner_type: string
  owner_id: string
  local_title: string | null
  created_at: string
  updated_at: string
  last_opened_at: string | null
}

export interface TaskSummary {
  queued: number
  running: number
  succeeded: number
  failed: number
}

export interface Version {
  id: string
  image_item_id: string
  parent_version_id: string | null
  origin_type: string
  file_name: string
  file_url: string
  mime_type: string
  width: number
  height: number
  file_size: number
  prompt_text: string | null
  prompt_summary: string | null
  provider: string
  model: string | null
  quality: string | null
  size: string | null
  is_deleted: boolean
  is_current_final: boolean
  child_count: number
  created_at: string
}

export interface VersionTreeNode extends Version {
  children: VersionTreeNode[]
}

export interface Job {
  id: string
  owner_id: string
  image_item_id: string
  base_version_id: string | null
  output_version_id: string | null
  job_type: string
  status: string
  prompt_text: string
  normalized_prompt: string
  mask_id: string | null
  request_params: Record<string, unknown>
  provider: string
  model: string
  quality: string
  size: string
  error_code: string | null
  error_message: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  output_version: Version | null
}

export interface ImageItemSummary {
  id: string
  owner_id: string
  sort_order: number
  title: string
  status: string
  current_final_version_id: string | null
  latest_version: Version | null
  current_final_version: Version | null
  running_job: Job | null
  created_at: string
  updated_at: string
}

export interface OwnerOverview {
  owner: Owner
  image_items: ImageItemSummary[]
  task_summary: TaskSummary
}

export interface OpenOwnerResponse extends OwnerOverview {
  recent_owners: Owner[]
}

export interface EventLog {
  id: string
  owner_id: string
  image_item_id: string | null
  version_id: string | null
  event_type: string
  payload: Record<string, unknown>
  created_at: string
}

export interface ImageItemDetail {
  image_item: ImageItemSummary
  current_final_version: Version | null
  versions: Version[]
  recent_jobs: Job[]
  recent_events: EventLog[]
}

export interface RecycleBin {
  deleted_items: ImageItemSummary[]
  deleted_versions: Version[]
}

export interface MaskCreateResponse {
  id: string
  file_url: string
  geometry: {
    x: number
    y: number
    width: number
    height: number
  }
  width: number
  height: number
}

export interface CreateJobResponse {
  job_id: string
  status: string
}

export interface ExportResponse {
  version_id: string
  file_url: string
  storage_key: string
  file_name: string
}

export interface PublishRecord {
  id: string
  publish_scope: string
  owner_id: string
  image_item_id: string | null
  version_id: string | null
  payload_snapshot: Record<string, unknown>
  publish_status: string
  created_at: string
}

export interface EventQueryResponse {
  events: EventLog[]
}

export interface PromptPreset {
  id: string
  scope: string
  name: string
  summary: string
  prompt_text: string
  discipline: string | null
  is_builtin: boolean
  source_preset_id: string | null
  created_at: string
  updated_at: string
}

export interface MessageResponse {
  success: boolean
  message: string
}

export type ThemeMode = 'light' | 'dark'
export type ThemeVariant = 'graphite' | 'glass'
export type ExportFormat = 'png' | 'jpeg' | 'webp'
export type ProviderId = 'openai_official' | 'tal_gpt_image_2'
export type Quality = 'low' | 'medium' | 'high'
export type SizeMode = 'auto' | 'preset' | 'custom'

export type OpenAIKeySource = 'app_settings' | 'env' | 'none'

export interface AppSettings {
  has_openai_api_key: boolean
  openai_api_key_source: OpenAIKeySource
  has_tal_service_api_key: boolean
  openai_base_url: string
  openai_model: string
  default_provider: ProviderId
  default_export_format: ExportFormat
  theme_mode: ThemeMode
  theme_variant: ThemeVariant
  max_concurrent_jobs: number
  updated_at: string
}

export interface AppSettingsUpdate {
  openai_base_url?: string
  openai_model?: string
  default_provider?: ProviderId
  default_export_format?: ExportFormat
  theme_mode?: ThemeMode
  theme_variant?: ThemeVariant
  max_concurrent_jobs?: number
}

export interface ProviderConnectivityResult {
  ok: boolean
  provider: ProviderId
  method: string
  url: string
  status_code: number | null
  elapsed_ms: number
  error_type: string | null
  error_message: string | null
  response_excerpt: string | null
}
