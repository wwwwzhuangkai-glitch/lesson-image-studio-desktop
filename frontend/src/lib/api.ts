import type {
  AppSettings,
  AppSettingsUpdate,
  CreateJobResponse,
  EventQueryResponse,
  ExportResponse,
  ImageItemDetail,
  Job,
  MaskCreateResponse,
  MessageResponse,
  OpenOwnerResponse,
  Owner,
  OwnerOverview,
  Quality,
  PromptPreset,
  PublishRecord,
  RecycleBin,
  SizeMode,
  Version,
  VersionTreeNode,
} from '../types/api'

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | Record<string, unknown> | null
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  let body: BodyInit | null | undefined = options.body as BodyInit | null | undefined

  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(body)
  }

  const response = await fetch(path, { ...options, headers, body })
  if (!response.ok) {
    const text = await response.text()
    let detail = text || '请求失败'
    try {
      const payload = JSON.parse(text)
      detail =
        (typeof payload?.detail === 'string' && payload.detail) ||
        (typeof payload?.message === 'string' && payload.message) ||
        detail
    } catch {
      // Keep the plain-text fallback when the payload is not JSON.
    }
    throw new Error(detail)
  }
  if (response.status === 204) {
    return null as T
  }
  return response.json() as Promise<T>
}

export function openOwner(payload: {
  owner_type: string
  owner_id?: string
  local_title?: string
}) {
  return request<OpenOwnerResponse>('/api/owners/open', { method: 'POST', body: payload })
}

export function listRecentOwners() {
  return request<Owner[]>('/api/owners/recent')
}

export function getOwnerOverview(ownerId: string) {
  return request<OwnerOverview>(`/api/owners/${ownerId}`)
}

export function createImageItem(ownerId: string, title: string) {
  return request<ImageItemDetail>(`/api/owners/${ownerId}/image-items`, {
    method: 'POST',
    body: { title },
  })
}

export function reorderImageItems(
  ownerId: string,
  items: Array<{ image_item_id: string; sort_order: number }>,
) {
  return request<MessageResponse>(`/api/owners/${ownerId}/image-items/reorder`, {
    method: 'PATCH',
    body: { items },
  })
}

export function getRecycleBin(ownerId: string) {
  return request<RecycleBin>(`/api/owners/${ownerId}/recycle-bin`)
}

export function deleteImageItem(imageItemId: string) {
  return request<MessageResponse>(`/api/image-items/${imageItemId}`, { method: 'DELETE' })
}

export function restoreImageItem(imageItemId: string) {
  return request<MessageResponse>(`/api/image-items/${imageItemId}/restore`, { method: 'POST' })
}

export function getImageItem(imageItemId: string) {
  return request<ImageItemDetail>(`/api/image-items/${imageItemId}`)
}

export function getVersionTree(imageItemId: string) {
  return request<VersionTreeNode[]>(`/api/image-items/${imageItemId}/versions/tree`)
}

export function importImage(imageItemId: string, file: File) {
  const body = new FormData()
  body.append('file', file)
  return request<Version>(`/api/image-items/${imageItemId}/import`, {
    method: 'POST',
    body,
  })
}

export function createMask(payload: {
  image_item_id: string
  base_version_id: string
  geometry: { x: number; y: number; width: number; height: number }
}) {
  return request<MaskCreateResponse>('/api/masks', { method: 'POST', body: payload })
}

export function createEditJob(payload: {
  image_item_id: string
  base_version_id: string
  prompt_text: string
  mask_id?: string
  quality?: Quality
  size_mode?: SizeMode
  size?: string | null
}) {
  return request<CreateJobResponse>('/api/edits', { method: 'POST', body: payload })
}

export function createGenerateJob(
  imageItemId: string,
  payload: {
    prompt_text: string
    quality?: Quality
    size_mode?: SizeMode
    size?: string | null
  },
) {
  return request<CreateJobResponse>(`/api/image-items/${imageItemId}/generate`, {
    method: 'POST',
    body: payload,
  })
}

export function listJobs(params?: { owner_id?: string; status?: string }) {
  const search = new URLSearchParams()
  if (params?.owner_id) {
    search.set('owner_id', params.owner_id)
  }
  if (params?.status) {
    search.set('status', params.status)
  }
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return request<Job[]>(`/api/jobs${suffix}`)
}

export function finalizeVersion(imageItemId: string, versionId: string) {
  return request<MessageResponse>(`/api/image-items/${imageItemId}/finalize`, {
    method: 'POST',
    body: { version_id: versionId },
  })
}

export function unfinalizeVersion(imageItemId: string) {
  return request<MessageResponse>(`/api/image-items/${imageItemId}/unfinalize`, {
    method: 'POST',
  })
}

export function deleteVersion(versionId: string) {
  return request<MessageResponse>(`/api/versions/${versionId}`, { method: 'DELETE' })
}

export function restoreVersion(versionId: string) {
  return request<MessageResponse>(`/api/versions/${versionId}/restore`, { method: 'POST' })
}

export function duplicateVersionToImageItem(versionId: string, title?: string) {
  return request<ImageItemDetail>(`/api/versions/${versionId}/duplicate-to-image-item`, {
    method: 'POST',
    body: { title },
  })
}

export function exportVersion(versionId: string) {
  return request<ExportResponse>(`/api/versions/${versionId}/export`, { method: 'POST' })
}

export function publishPlaceholder(payload: {
  publish_scope: 'image_item' | 'owner_bundle'
  owner_id: string
  image_item_id?: string
  version_id?: string
}) {
  return request<PublishRecord>('/api/publish', { method: 'POST', body: payload })
}

export function listEvents(params: { owner_id: string; image_item_id?: string; limit?: number }) {
  const search = new URLSearchParams()
  search.set('owner_id', params.owner_id)
  if (params.image_item_id) {
    search.set('image_item_id', params.image_item_id)
  }
  if (params.limit) {
    search.set('limit', String(params.limit))
  }
  return request<EventQueryResponse>(`/api/events?${search.toString()}`)
}

export function listPromptPresets(scope: 'system' | 'personal' | 'all' = 'all') {
  return request<PromptPreset[]>(`/api/prompt-presets?scope=${scope}`)
}

export function createPromptPreset(payload: {
  name: string
  summary: string
  prompt_text: string
  discipline?: string
  source_preset_id?: string
}) {
  return request<PromptPreset>('/api/prompt-presets', { method: 'POST', body: payload })
}

export function updatePromptPreset(
  presetId: string,
  payload: {
    name?: string
    summary?: string
    prompt_text?: string
    discipline?: string
  },
) {
  return request<PromptPreset>(`/api/prompt-presets/${presetId}`, { method: 'PATCH', body: payload })
}

export function deletePromptPreset(presetId: string) {
  return request<MessageResponse>(`/api/prompt-presets/${presetId}`, { method: 'DELETE' })
}

export function getAppSettings() {
  return request<AppSettings>('/api/settings')
}

export function updateAppSettings(patch: AppSettingsUpdate) {
  return request<AppSettings>('/api/settings', {
    method: 'PUT',
    body: { ...patch } as Record<string, unknown>,
  })
}

export function setOpenAIKey(key: string) {
  return request<AppSettings>('/api/settings/openai-key', {
    method: 'PUT',
    body: { openai_api_key: key },
  })
}

export function clearOpenAIKey() {
  return request<AppSettings>('/api/settings/openai-key', { method: 'DELETE' })
}

export function setTalKey(key: string) {
  return request<AppSettings>('/api/settings/tal-key', {
    method: 'PUT',
    body: { tal_service_api_key: key },
  })
}

export function clearTalKey() {
  return request<AppSettings>('/api/settings/tal-key', { method: 'DELETE' })
}
