import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createPromptPreset,
  deletePromptPreset,
  getRecycleBin,
  listEvents,
  listJobs,
  listPromptPresets,
  restoreImageItem,
  restoreVersion,
  updatePromptPreset,
} from '../lib/api'
import { useUiStore } from '../store/uiStore'
import type { EventLog, Job, PromptPreset } from '../types/api'
import { useInputDialog } from './InputDialog'
import { usePresetFormDialog } from './PresetFormDialog'
import { PresetCard } from './PresetCard'

function getTaskLabel(job: Job) {
  return job.job_type === 'generate' ? 'AI 生图' : 'AI 改图'
}

function getJobStatusLabel(status: string) {
  switch (status) {
    case 'queued':
      return '排队中'
    case 'running':
      return '执行中'
    case 'succeeded':
      return '已完成'
    case 'failed':
      return '失败'
    default:
      return status
  }
}

function getEventLabel(event: EventLog) {
  const mapping: Record<string, string> = {
    owner_opened: '打开了项目',
    image_item_created: '创建了图片项',
    image_imported: '导入了底图',
    edit_job_created: '发起了改图任务',
    generate_job_created: '发起了生图任务',
    job_succeeded: '任务执行成功',
    job_failed: '任务执行失败',
    version_finalized: '设为当前定稿',
    version_unfinalized: '取消了当前定稿',
    version_deleted: '删除了版本',
    version_restored: '恢复了版本',
    image_item_deleted: '删除了图片项',
    image_item_restored: '恢复了图片项',
    image_item_duplicated_from_version: '复制为新图片项起点',
    version_exported: '导出了版本',
  }
  return mapping[event.event_type] ?? event.event_type
}

export function UtilityDrawer() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const open = useUiStore((state) => state.utilityDrawerOpen)
  const activeTab = useUiStore((state) => state.utilityTab)
  const setUtilityTab = useUiStore((state) => state.setUtilityTab)
  const closeUtilityDrawer = useUiStore((state) => state.closeUtilityDrawer)
  const currentOwnerId = useUiStore((state) => state.currentOwnerId)
  const currentImageItemId = useUiStore((state) => state.currentImageItemId)
  const editorPromptText = useUiStore((state) => state.editorPromptText)
  const setEditorPromptText = useUiStore((state) => state.setEditorPromptText)
  const taskScope = useUiStore((state) => state.taskScope)
  const setTaskScope = useUiStore((state) => state.setTaskScope)
  const pushNotice = useUiStore((state) => state.pushNotice)
  const setJobIndicatorCount = useUiStore((state) => state.setJobIndicatorCount)
  const inputDialog = useInputDialog()
  const presetFormDialog = usePresetFormDialog()
  const previousStatuses = useRef(new Map<string, string>())
  const [pendingPresetOp, setPendingPresetOp] = useState(false)

  const jobsQuery = useQuery({
    queryKey: ['jobs', taskScope, currentOwnerId],
    queryFn: () =>
      listJobs({
        owner_id: taskScope === 'owner' ? currentOwnerId ?? undefined : undefined,
      }),
    refetchInterval: 3000,
  })

  const eventsQuery = useQuery({
    queryKey: ['owner-events', currentOwnerId],
    queryFn: () => listEvents({ owner_id: currentOwnerId ?? '', limit: 40 }),
    enabled: open && activeTab === 'events' && Boolean(currentOwnerId),
  })

  const recycleQuery = useQuery({
    queryKey: ['owner-recycle', currentOwnerId],
    queryFn: () => getRecycleBin(currentOwnerId ?? ''),
    enabled: open && activeTab === 'recycle' && Boolean(currentOwnerId),
  })

  const presetsQuery = useQuery({
    queryKey: ['prompt-presets'],
    queryFn: () => listPromptPresets('all'),
    enabled: open && activeTab === 'templates',
  })

  useEffect(() => {
    const activeCount = (jobsQuery.data ?? []).filter((job) =>
      ['queued', 'running', 'failed'].includes(job.status),
    ).length
    setJobIndicatorCount(activeCount)
  }, [jobsQuery.data, setJobIndicatorCount])

  useEffect(() => {
    const jobs = jobsQuery.data ?? []
    for (const job of jobs) {
      const previous = previousStatuses.current.get(job.id)
      if (previous && previous !== job.status && ['succeeded', 'failed'].includes(job.status)) {
        pushNotice({
          title: job.status === 'succeeded' ? '任务已完成' : '任务失败',
          body: job.error_message ?? `${getTaskLabel(job)}：${job.prompt_text.slice(0, 28)}`,
        })
      }
      previousStatuses.current.set(job.id, job.status)
    }
    const activeIds = new Set(jobs.map((j) => j.id))
    for (const id of previousStatuses.current.keys()) {
      if (!activeIds.has(id)) {
        previousStatuses.current.delete(id)
      }
    }
  }, [jobsQuery.data, pushNotice])

  const restoreItemMutation = useMutation({
    mutationFn: restoreImageItem,
    onSuccess: async () => {
      pushNotice({ title: '图片项已恢复' })
      await queryClient.invalidateQueries({ queryKey: ['owner'] })
      await queryClient.invalidateQueries({ queryKey: ['image-item'] })
      await queryClient.invalidateQueries({ queryKey: ['image-item-tree'] })
      await queryClient.invalidateQueries({ queryKey: ['owner-recycle', currentOwnerId] })
    },
    onError: (error: Error) => pushNotice({ title: '恢复失败', body: error.message }),
  })

  const restoreVersionMutation = useMutation({
    mutationFn: restoreVersion,
    onSuccess: async () => {
      pushNotice({ title: '版本已恢复' })
      await queryClient.invalidateQueries({ queryKey: ['owner'] })
      await queryClient.invalidateQueries({ queryKey: ['image-item'] })
      await queryClient.invalidateQueries({ queryKey: ['image-item-tree'] })
      await queryClient.invalidateQueries({ queryKey: ['owner-recycle', currentOwnerId] })
    },
    onError: (error: Error) => pushNotice({ title: '恢复失败', body: error.message }),
  })

  const drawerTitle = useMemo(() => {
    if (activeTab === 'events') return '事件流'
    if (activeTab === 'recycle') return '回收站'
    if (activeTab === 'templates') return '提示词模板'
    return '任务中心'
  }, [activeTab])

  const systemPresets = (presetsQuery.data ?? []).filter((preset) => preset.scope === 'system')
  const personalPresets = (presetsQuery.data ?? []).filter((preset) => preset.scope === 'personal')
  const inEditor = Boolean(currentImageItemId)

  function applyPreset(preset: PromptPreset) {
    if (!inEditor) {
      pushNotice({ title: '请先打开一张图片项再载入模板' })
      return
    }
    setEditorPromptText(preset.prompt_text)
    pushNotice({ title: '已载入到编辑页提示词' })
  }

  async function saveCurrentPromptAsPreset(sourcePreset?: PromptPreset) {
    if (!editorPromptText.trim()) {
      pushNotice({ title: '编辑页还没有可保存的提示词' })
      return
    }
    if (pendingPresetOp) return
    const result = await presetFormDialog.edit({
      title: '保存为个人模板',
      description: '个人模板会出现在「个人模板」分组里，方便复用。',
      mode: 'create',
      initial: {
        name: sourcePreset ? `${sourcePreset.name} - 我的版本` : '我的快捷模板',
        summary: sourcePreset?.summary ?? '个人常用模板',
      },
    })
    if (!result) return
    setPendingPresetOp(true)
    try {
      await createPromptPreset({
        name: result.name,
        summary: result.summary,
        prompt_text: editorPromptText,
        source_preset_id: sourcePreset?.id,
        discipline: sourcePreset?.discipline ?? undefined,
      })
      pushNotice({ title: '已保存为个人模板' })
      await queryClient.invalidateQueries({ queryKey: ['prompt-presets'] })
    } catch (error) {
      pushNotice({ title: '保存失败', body: (error as Error).message })
    } finally {
      setPendingPresetOp(false)
    }
  }

  async function cloneSystemPreset(preset: PromptPreset) {
    if (pendingPresetOp) return
    setPendingPresetOp(true)
    try {
      await createPromptPreset({
        name: `${preset.name} - 我的版本`,
        summary: preset.summary,
        prompt_text: preset.prompt_text,
        discipline: preset.discipline ?? undefined,
        source_preset_id: preset.id,
      })
      pushNotice({ title: '系统模板已复制到个人模板' })
      await queryClient.invalidateQueries({ queryKey: ['prompt-presets'] })
    } catch (error) {
      pushNotice({ title: '复制失败', body: (error as Error).message })
    } finally {
      setPendingPresetOp(false)
    }
  }

  async function editPersonalPreset(preset: PromptPreset) {
    if (pendingPresetOp) return
    const result = await presetFormDialog.edit({
      title: '编辑个人模板',
      mode: 'edit',
      initial: {
        name: preset.name,
        summary: preset.summary,
        prompt_text: preset.prompt_text,
      },
    })
    if (!result) return
    setPendingPresetOp(true)
    try {
      await updatePromptPreset(preset.id, {
        name: result.name,
        summary: result.summary,
        prompt_text: result.prompt_text,
        discipline: preset.discipline ?? undefined,
      })
      pushNotice({ title: '个人模板已更新' })
      await queryClient.invalidateQueries({ queryKey: ['prompt-presets'] })
    } catch (error) {
      pushNotice({ title: '更新失败', body: (error as Error).message })
    } finally {
      setPendingPresetOp(false)
    }
  }

  async function removePersonalPreset(preset: PromptPreset) {
    if (pendingPresetOp) return
    const confirmValue = await inputDialog.prompt({
      title: `删除模板「${preset.name}」`,
      message: '删除后无法恢复。输入 删除 以确认。',
      placeholder: '输入「删除」二字确认',
      confirmLabel: '确认删除',
    })
    if (confirmValue !== '删除') {
      pushNotice({ title: '已取消' })
      return
    }
    setPendingPresetOp(true)
    try {
      await deletePromptPreset(preset.id)
      pushNotice({ title: '个人模板已删除' })
      await queryClient.invalidateQueries({ queryKey: ['prompt-presets'] })
    } catch (error) {
      pushNotice({ title: '删除失败', body: (error as Error).message })
    } finally {
      setPendingPresetOp(false)
    }
  }

  return (
    <aside className={`utility-drawer ${open ? 'open' : ''}`}>
      <div className="utility-drawer-header">
        <div>
          <div className="eyebrow">Utility Drawer</div>
          <h3>{drawerTitle}</h3>
        </div>
        <button className="ghost-button small" onClick={closeUtilityDrawer}>
          关闭
        </button>
      </div>

      <div className="utility-tab-strip">
        <button className={activeTab === 'tasks' ? 'active' : ''} onClick={() => setUtilityTab('tasks')}>
          任务
        </button>
        <button
          className={activeTab === 'events' ? 'active' : ''}
          disabled={!currentOwnerId}
          onClick={() => setUtilityTab('events')}
        >
          事件
        </button>
        <button
          className={activeTab === 'recycle' ? 'active' : ''}
          disabled={!currentOwnerId}
          onClick={() => setUtilityTab('recycle')}
        >
          回收站
        </button>
        <button
          className={activeTab === 'templates' ? 'active' : ''}
          onClick={() => setUtilityTab('templates')}
        >
          模板
        </button>
      </div>

      {activeTab === 'tasks' ? (
        <>
          <div className="utility-segmented">
            <button
              className={taskScope === 'owner' ? 'active' : ''}
              disabled={!currentOwnerId}
              onClick={() => setTaskScope('owner')}
            >
              当前项目
            </button>
            <button className={taskScope === 'all' ? 'active' : ''} onClick={() => setTaskScope('all')}>
              全部项目
            </button>
          </div>

          <div className="utility-scroll">
            {jobsQuery.isLoading ? <p className="muted">正在加载任务…</p> : null}
            {(jobsQuery.data ?? []).map((job) => (
              <button
                key={job.id}
                className="utility-card utility-card-button"
                onClick={() => {
                  navigate(`/items/${job.image_item_id}`)
                  closeUtilityDrawer()
                }}
              >
                <div>
                  <strong>{getTaskLabel(job)}</strong>
                  <p>{job.prompt_text}</p>
                </div>
                <span className={`status-pill status-${job.status}`}>{getJobStatusLabel(job.status)}</span>
              </button>
            ))}
            {!jobsQuery.data?.length && !jobsQuery.isLoading ? (
              <div className="empty-mini-card">当前没有任务记录。</div>
            ) : null}
          </div>
        </>
      ) : null}

      {activeTab === 'events' ? (
        <div className="utility-scroll">
          {!currentOwnerId ? <div className="empty-mini-card">当前没有可查看的项目。</div> : null}
          {(eventsQuery.data?.events ?? []).map((event) => (
            <div key={event.id} className="utility-card">
              <strong>{getEventLabel(event)}</strong>
              <p>{new Date(event.created_at).toLocaleString('zh-CN')}</p>
            </div>
          ))}
          {currentOwnerId && !eventsQuery.data?.events.length && !eventsQuery.isLoading ? (
            <div className="empty-mini-card">当前还没有事件记录。</div>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'recycle' ? (
        <div className="utility-scroll">
          {!currentOwnerId ? <div className="empty-mini-card">当前没有可查看的项目。</div> : null}

          {currentOwnerId ? (
            <>
              <div className="utility-section">
                <div className="utility-section-heading">已删除图片项</div>
                {(recycleQuery.data?.deleted_items ?? []).map((item) => (
                  <div key={item.id} className="utility-card utility-row">
                    <div>
                      <strong>{item.title}</strong>
                      <p>排序 #{item.sort_order}</p>
                    </div>
                    <button
                      className="ghost-button small"
                      disabled={restoreItemMutation.isPending}
                      onClick={() => restoreItemMutation.mutate(item.id)}
                    >
                      恢复
                    </button>
                  </div>
                ))}
                {!recycleQuery.data?.deleted_items.length && !recycleQuery.isLoading ? (
                  <div className="empty-mini-card">还没有已删除图片项。</div>
                ) : null}
              </div>

              <div className="utility-section">
                <div className="utility-section-heading">已删除版本</div>
                {(recycleQuery.data?.deleted_versions ?? []).map((version) => (
                  <div key={version.id} className="utility-card utility-row">
                    <div>
                      <strong>{version.prompt_summary || version.file_name}</strong>
                      <p>{new Date(version.created_at).toLocaleString('zh-CN')}</p>
                    </div>
                    <button
                      className="ghost-button small"
                      disabled={restoreVersionMutation.isPending}
                      onClick={() => restoreVersionMutation.mutate(version.id)}
                    >
                      恢复
                    </button>
                  </div>
                ))}
                {!recycleQuery.data?.deleted_versions.length && !recycleQuery.isLoading ? (
                  <div className="empty-mini-card">还没有已删除版本。</div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'templates' ? (
        <div className="utility-scroll">
          {!inEditor ? (
            <div className="empty-mini-card">
              当前不在编辑页，载入按钮暂时不可用；你仍然可以浏览、编辑个人模板。
            </div>
          ) : null}

          <div className="utility-section">
            <div className="utility-section-heading">系统模板</div>
            {presetsQuery.isLoading ? <p className="muted">正在加载模板…</p> : null}
            {systemPresets.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                onApply={() => applyPreset(preset)}
                applyDisabled={!inEditor}
                applyDisabledHint="请先打开一张图片项"
                onClone={() => void cloneSystemPreset(preset)}
                onSaveCurrent={inEditor ? () => void saveCurrentPromptAsPreset(preset) : undefined}
              />
            ))}
            {!systemPresets.length && !presetsQuery.isLoading ? (
              <div className="empty-mini-card">系统模板为空。</div>
            ) : null}
          </div>

          <div className="utility-section">
            <div className="utility-section-heading">个人模板</div>
            {inEditor ? (
              <button
                className="ghost-button small"
                onClick={() => void saveCurrentPromptAsPreset()}
                disabled={!editorPromptText.trim()}
                title={!editorPromptText.trim() ? '编辑页还没有可保存的提示词' : undefined}
              >
                保存当前编辑页提示词为新模板
              </button>
            ) : null}
            {personalPresets.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                onApply={() => applyPreset(preset)}
                applyDisabled={!inEditor}
                applyDisabledHint="请先打开一张图片项"
                onEdit={() => void editPersonalPreset(preset)}
                onDelete={() => void removePersonalPreset(preset)}
              />
            ))}
            {!personalPresets.length && !presetsQuery.isLoading ? (
              <div className="empty-mini-card">还没有个人模板。</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </aside>
  )
}
