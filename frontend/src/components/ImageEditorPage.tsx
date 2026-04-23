import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import {
  createEditJob,
  createGenerateJob,
  createMask,
  createPromptPreset,
  deletePromptPreset,
  deleteVersion,
  duplicateVersionToImageItem,
  exportVersion,
  finalizeVersion,
  getImageItem,
  getVersionTree,
  importImage,
  listPromptPresets,
  publishPlaceholder,
  unfinalizeVersion,
  updatePromptPreset,
} from '../lib/api'
import { useUiStore } from '../store/uiStore'
import type { PromptPreset, Version } from '../types/api'
import { AppTopbar } from './AppTopbar'
import { CanvasWorkbench } from './CanvasWorkbench'
import { useInputDialog } from './InputDialog'
import { usePresetFormDialog } from './PresetFormDialog'
import { VersionTree } from './VersionTree'

const QUALITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
] as const

const SIZE_OPTIONS = ['1024x1024', '1536x1024', '1024x1536'] as const

export function ImageEditorPage() {
  const { itemId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pushNotice = useUiStore((state) => state.pushNotice)
  const setCurrentOwnerId = useUiStore((state) => state.setCurrentOwnerId)
  const setCurrentImageItemId = useUiStore((state) => state.setCurrentImageItemId)
  const openUtilityDrawer = useUiStore((state) => state.openUtilityDrawer)
  const jobIndicatorCount = useUiStore((state) => state.jobIndicatorCount)
  const promptText = useUiStore((state) => state.editorPromptText)
  const setPromptText = useUiStore((state) => state.setEditorPromptText)
  const clearEditorPromptText = useUiStore((state) => state.clearEditorPromptText)
  const inputDialog = useInputDialog()
  const presetFormDialog = usePresetFormDialog()
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium')
  const [size, setSize] = useState<'1024x1024' | '1536x1024' | '1024x1536'>('1024x1024')
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [selectionEnabled, setSelectionEnabled] = useState(false)
  const [templatesExpanded, setTemplatesExpanded] = useState(false)

  const detailQuery = useQuery({
    queryKey: ['image-item', itemId],
    queryFn: () => getImageItem(itemId),
    enabled: Boolean(itemId),
    refetchInterval: 3000,
  })

  const treeQuery = useQuery({
    queryKey: ['image-item-tree', itemId],
    queryFn: () => getVersionTree(itemId),
    enabled: Boolean(itemId),
    refetchInterval: 3000,
  })

  const presetsQuery = useQuery({
    queryKey: ['prompt-presets'],
    queryFn: () => listPromptPresets('all'),
  })

  useEffect(() => {
    if (detailQuery.data?.image_item.owner_id) {
      setCurrentOwnerId(detailQuery.data.image_item.owner_id)
    }
  }, [detailQuery.data?.image_item.owner_id, setCurrentOwnerId])

  useEffect(() => {
    setCurrentImageItemId(itemId || null)
    return () => {
      setCurrentImageItemId(null)
      clearEditorPromptText()
    }
  }, [itemId, setCurrentImageItemId, clearEditorPromptText])

  useEffect(() => {
    if (!detailQuery.data?.versions.length) {
      setSelectedVersionId(null)
      return
    }
    if (selectedVersionId && detailQuery.data.versions.some((version) => version.id === selectedVersionId)) {
      return
    }
    setSelectedVersionId(
      detailQuery.data.current_final_version?.id ??
        detailQuery.data.versions[detailQuery.data.versions.length - 1]?.id ??
        null,
    )
  }, [detailQuery.data, selectedVersionId])

  const selectedVersion = useMemo(
    () => detailQuery.data?.versions.find((version) => version.id === selectedVersionId) ?? null,
    [detailQuery.data?.versions, selectedVersionId],
  )
  const compareVersion = useMemo(() => {
    if (!selectedVersion) {
      return null
    }
    return detailQuery.data?.versions.find((version) => version.id === selectedVersion.parent_version_id) ?? null
  }, [detailQuery.data?.versions, selectedVersion])

  const currentFinalVersion = detailQuery.data?.current_final_version ?? null
  const hasVersions = Boolean(detailQuery.data?.versions.length)
  const systemPresets = (presetsQuery.data ?? []).filter((preset) => preset.scope === 'system')
  const personalPresets = (presetsQuery.data ?? []).filter((preset) => preset.scope === 'personal')

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['image-item', itemId] })
    await queryClient.invalidateQueries({ queryKey: ['image-item-tree', itemId] })
    await queryClient.invalidateQueries({ queryKey: ['owner'] })
    await queryClient.invalidateQueries({ queryKey: ['jobs'] })
    await queryClient.invalidateQueries({ queryKey: ['owner-events'] })
    await queryClient.invalidateQueries({ queryKey: ['owner-recycle'] })
  }

  const createEditMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVersion) {
        throw new Error('请先选中一个版本。')
      }
      let maskId: string | undefined
      if (selectionEnabled && selectionRect) {
        const mask = await createMask({
          image_item_id: itemId,
          base_version_id: selectedVersion.id,
          geometry: selectionRect,
        })
        maskId = mask.id
      }
      return createEditJob({
        image_item_id: itemId,
        base_version_id: selectedVersion.id,
        prompt_text: promptText,
        mask_id: maskId,
        quality,
        size,
      })
    },
    onSuccess: async () => {
      pushNotice({ title: '任务已入队', body: '你可以继续看画布，也可以去任务中心查看状态。' })
      await invalidate()
    },
    onError: (error: Error) => pushNotice({ title: '提交失败', body: error.message }),
  })

  const generateMutation = useMutation({
    mutationFn: () => createGenerateJob(itemId, { prompt_text: promptText, quality, size }),
    onSuccess: async () => {
      pushNotice({ title: '生图任务已入队' })
      await invalidate()
    },
    onError: (error: Error) => pushNotice({ title: '生图失败', body: error.message }),
  })

  const duplicateMutation = useMutation({
    mutationFn: ({ versionId, title }: { versionId: string; title?: string }) =>
      duplicateVersionToImageItem(versionId, title),
    onSuccess: async (detail) => {
      pushNotice({ title: '已复制为新图片项起点' })
      await invalidate()
      navigate(`/items/${detail.image_item.id}`)
    },
    onError: (error: Error) => pushNotice({ title: '复制失败', body: error.message }),
  })

  async function handleRootImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    try {
      await importImage(itemId, file)
      pushNotice({ title: '底图已导入' })
      await invalidate()
    } catch (error) {
      pushNotice({ title: '导入失败', body: (error as Error).message })
    } finally {
      event.target.value = ''
    }
  }

  async function saveCurrentPromptAsPreset(sourcePreset?: PromptPreset) {
    if (!promptText.trim()) {
      pushNotice({ title: '没有可保存的提示词' })
      return
    }
    const result = await presetFormDialog.edit({
      title: '保存为个人模板',
      description: '个人模板会出现在提示词区的"个人模板"分组里，方便复用。',
      mode: 'create',
      initial: {
        name: sourcePreset ? `${sourcePreset.name} - 我的版本` : '我的快捷模板',
        summary: sourcePreset?.summary ?? '个人常用模板',
      },
    })
    if (!result) return
    await createPromptPreset({
      name: result.name,
      summary: result.summary,
      prompt_text: promptText,
      source_preset_id: sourcePreset?.id,
      discipline: sourcePreset?.discipline ?? undefined,
    })
    pushNotice({ title: '已保存为个人模板' })
    await queryClient.invalidateQueries({ queryKey: ['prompt-presets'] })
  }

  async function cloneSystemPreset(preset: PromptPreset) {
    await createPromptPreset({
      name: `${preset.name} - 我的版本`,
      summary: preset.summary,
      prompt_text: preset.prompt_text,
      discipline: preset.discipline ?? undefined,
      source_preset_id: preset.id,
    })
    pushNotice({ title: '系统模板已复制到个人模板' })
    await queryClient.invalidateQueries({ queryKey: ['prompt-presets'] })
  }

  async function editPersonalPreset(preset: PromptPreset) {
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
    await updatePromptPreset(preset.id, {
      name: result.name,
      summary: result.summary,
      prompt_text: result.prompt_text,
      discipline: preset.discipline ?? undefined,
    })
    pushNotice({ title: '个人模板已更新' })
    await queryClient.invalidateQueries({ queryKey: ['prompt-presets'] })
  }

  async function removePersonalPreset(preset: PromptPreset) {
    await deletePromptPreset(preset.id)
    pushNotice({ title: '个人模板已删除' })
    await queryClient.invalidateQueries({ queryKey: ['prompt-presets'] })
  }

  async function handleFinalize() {
    if (!selectedVersion) {
      pushNotice({ title: '请先选中一个版本' })
      return
    }
    await finalizeVersion(itemId, selectedVersion.id)
    pushNotice({ title: '已设为当前定稿' })
    await invalidate()
  }

  async function handleExport(target: Version | null) {
    if (!target) {
      pushNotice({ title: '没有可导出的版本' })
      return
    }
    const result = await exportVersion(target.id)
    pushNotice({ title: '导出成功', body: result.file_url })
  }

  async function handlePublish(target: Version | null) {
    if (!target || !detailQuery.data) {
      pushNotice({ title: '没有可发布的版本' })
      return
    }
    await publishPlaceholder({
      publish_scope: 'image_item',
      owner_id: detailQuery.data.image_item.owner_id,
      image_item_id: itemId,
      version_id: target.id,
    })
    pushNotice({ title: '已记录发布占位' })
    await invalidate()
  }

  async function handleDuplicateFromSelected() {
    if (!selectedVersion || !detailQuery.data) {
      pushNotice({ title: '请先选中一个版本' })
      return
    }
    const title = await inputDialog.prompt({
      title: '复制为新图片项起点',
      message: '会在当前 Owner 下新建一个图片项，并以选中版本为新版本树的根。',
      defaultValue: `${detailQuery.data.image_item.title} - 副本`,
      placeholder: '新图片项标题',
      confirmLabel: '复制',
    })
    if (!title) return
    duplicateMutation.mutate({ versionId: selectedVersion.id, title })
  }

  return (
    <div className="workbench-shell editor-workbench">
      <aside className="workspace-sidebar version-rail">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">LS</span>
          <div>
            <strong>Lesson Image Studio</strong>
            <p>版本工作台</p>
          </div>
        </div>

        <button
          className="sidebar-nav-item"
          onClick={() => navigate(`/owners/${detailQuery.data?.image_item.owner_id ?? ''}`)}
        >
          返回多图总览
        </button>

        <div className="sidebar-section-heading">版本轨</div>
        <div className="version-rail-tree">
          <VersionTree
            nodes={treeQuery.data ?? []}
            selectedVersionId={selectedVersionId}
            onSelect={setSelectedVersionId}
          />
        </div>

        <div className="sidebar-bottom-actions">
          <button className="sidebar-tool-button" onClick={() => openUtilityDrawer('tasks')}>
            <span>任务中心</span>
            {jobIndicatorCount > 0 ? <span className="task-badge">{jobIndicatorCount}</span> : null}
          </button>
          <button className="sidebar-tool-button" onClick={() => openUtilityDrawer('events')}>
            事件流
          </button>
          <button className="sidebar-tool-button" onClick={() => openUtilityDrawer('recycle')}>
            回收站
          </button>
        </div>
      </aside>

      <section className="workspace-frame editor-frame">
        <header className="workspace-topbar">
          <div>
            <div className="eyebrow">单图编辑页</div>
            <h1>{detailQuery.data?.image_item.title ?? '图片编辑中'}</h1>
          </div>
          <div className="topbar-actions">
            <span className="topbar-chip">{selectedVersion ? '已选中版本' : '等待选中版本'}</span>
            {currentFinalVersion ? <span className="topbar-chip topbar-chip-success">当前已有定稿</span> : null}
            <AppTopbar />
          </div>
        </header>

        <div className="editor-stage-grid">
          <section className="editor-canvas-column">
            <div className="panel editor-canvas-panel">
              {!hasVersions ? (
                <div className="canvas-empty-state">
                  <div>
                    <div className="eyebrow">空图片项</div>
                    <h2>先导入底图，或者直接发起 AI 生图</h2>
                    <p>这张图片项还没有版本，导入后会形成根版本；也可以直接让 `gpt-image-2` 生成第一版。</p>
                  </div>
                  <label className="primary-button upload-button">
                    导入底图
                    <input hidden type="file" accept="image/*" onChange={handleRootImport} />
                  </label>
                </div>
              ) : (
                <CanvasWorkbench
                  imageUrl={selectedVersion?.file_url ?? null}
                  compareImageUrl={compareVersion?.file_url ?? null}
                  selection={selectionRect}
                  onSelectionChange={setSelectionRect}
                  enableSelection={selectionEnabled}
                  onSelectionModeChange={setSelectionEnabled}
                />
              )}
            </div>
          </section>

          <aside className="panel inspector-panel">
            <div className="inspector-scroll">
              <section className="inspector-section">
                <div className="eyebrow">当前上下文</div>
                <h2>{selectedVersion ? selectedVersion.prompt_summary || selectedVersion.file_name : '准备生成第一版'}</h2>
                <p className="muted">
                  {hasVersions
                    ? '发起改图前，必须显式选中当前图片项内的某个版本。'
                    : '空图片项可以直接发起 AI 生图，也可以先导入底图。'}
                </p>
              </section>

              <section className="inspector-section">
                <div className="field-label">提示词</div>
                <textarea
                  value={promptText}
                  onChange={(event) => setPromptText(event.target.value)}
                  placeholder={
                    hasVersions
                      ? '描述你希望怎么改图，老师会直接看到实际提交的提示词。'
                      : '例如：生成一张高中物理牛顿第二定律受力分析示意图，适合课件讲解'
                  }
                />
              </section>

              <section className="inspector-section">
                <div className="two-columns">
                  <label>
                    <span className="field-label">质量</span>
                    <select value={quality} onChange={(event) => setQuality(event.target.value as typeof quality)}>
                      {QUALITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">尺寸</span>
                    <select value={size} onChange={(event) => setSize(event.target.value as typeof size)}>
                      {SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="inspector-section">
                <div className="inspector-section-heading">执行动作</div>
                <div className="inspector-button-stack">
                  {hasVersions ? (
                    <button
                      className="primary-button"
                      disabled={!selectedVersion || !promptText.trim() || createEditMutation.isPending}
                      onClick={() => createEditMutation.mutate()}
                    >
                      发起 AI 改图
                    </button>
                  ) : (
                    <>
                      <label className="ghost-button upload-button">
                        导入底图
                        <input hidden type="file" accept="image/*" onChange={handleRootImport} />
                      </label>
                      <button
                        className="primary-button"
                        disabled={!promptText.trim() || generateMutation.isPending}
                        onClick={() => generateMutation.mutate()}
                      >
                        发起 AI 生图
                      </button>
                    </>
                  )}
                  <button className="ghost-button" onClick={() => void saveCurrentPromptAsPreset()}>
                    保存为个人模板
                  </button>
                </div>
              </section>

              <section className="inspector-section">
                <div className="inspector-section-heading">定稿 / 导出 / 发布</div>
                <div className="inspector-button-grid">
                  <button className="ghost-button" onClick={handleFinalize} disabled={!selectedVersion}>
                    设为当前定稿
                  </button>
                  <button
                    className="ghost-button"
                    onClick={async () => {
                      await unfinalizeVersion(itemId)
                      pushNotice({ title: '已取消定稿' })
                      await invalidate()
                    }}
                    disabled={!currentFinalVersion}
                  >
                    取消定稿
                  </button>
                  <button className="ghost-button" onClick={() => void handleExport(currentFinalVersion)}>
                    导出定稿
                  </button>
                  <button className="ghost-button" onClick={() => void handleExport(selectedVersion)}>
                    导出选中
                  </button>
                  <button className="ghost-button" onClick={() => void handlePublish(currentFinalVersion)}>
                    发布定稿
                  </button>
                  <button className="ghost-button" onClick={() => void handlePublish(selectedVersion)}>
                    发布选中
                  </button>
                </div>
              </section>

              <section className="inspector-section">
                <div className="inspector-section-heading">版本动作</div>
                <div className="inspector-button-stack">
                  <button
                    className="ghost-button"
                    disabled={!selectedVersion || duplicateMutation.isPending}
                    onClick={handleDuplicateFromSelected}
                  >
                    复制为新图片项起点
                  </button>
                  <button
                    className="ghost-button danger"
                    disabled={!selectedVersion || selectedVersion.child_count > 0 || selectedVersion.is_current_final}
                    onClick={async () => {
                      if (!selectedVersion) return
                      await deleteVersion(selectedVersion.id)
                      pushNotice({ title: '版本已移入回收站' })
                      await invalidate()
                    }}
                  >
                    删除选中版本
                  </button>
                </div>
              </section>

              <section className="inspector-section template-section">
                <button
                  className="template-toggle"
                  onClick={() => setTemplatesExpanded((value) => !value)}
                >
                  <span>模板库</span>
                  <span>{templatesExpanded ? '收起' : '展开'}</span>
                </button>

                {templatesExpanded ? (
                  <div className="template-stack">
                    <div className="preset-group">
                      <div className="preset-group-heading">系统模板</div>
                      {systemPresets.map((preset) => (
                        <PresetCard
                          key={preset.id}
                          preset={preset}
                          onApply={() => setPromptText(preset.prompt_text)}
                          onClone={() => void cloneSystemPreset(preset)}
                          onSaveCurrent={() => void saveCurrentPromptAsPreset(preset)}
                        />
                      ))}
                    </div>

                    <div className="preset-group">
                      <div className="preset-group-heading">个人模板</div>
                      {personalPresets.map((preset) => (
                        <PresetCard
                          key={preset.id}
                          preset={preset}
                          onApply={() => setPromptText(preset.prompt_text)}
                          onEdit={() => void editPersonalPreset(preset)}
                          onDelete={() => void removePersonalPreset(preset)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}

function PresetCard({
  preset,
  onApply,
  onClone,
  onEdit,
  onDelete,
  onSaveCurrent,
}: {
  preset: PromptPreset
  onApply: () => void
  onClone?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onSaveCurrent?: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <article className="preset-card">
      <div className="preset-card-top">
        <div>
          <strong>{preset.name}</strong>
          <p>{preset.summary}</p>
        </div>
        <button className="ghost-button small" onClick={() => setExpanded((value) => !value)}>
          {expanded ? '收起' : '展开'}
        </button>
      </div>

      {expanded ? <pre className="preset-prompt">{preset.prompt_text}</pre> : null}

      <div className="button-row">
        <button className="ghost-button small" onClick={onApply}>
          载入
        </button>
        {onClone ? (
          <button className="ghost-button small" onClick={onClone}>
            复制到个人模板
          </button>
        ) : null}
        {onSaveCurrent ? (
          <button className="ghost-button small" onClick={onSaveCurrent}>
            保存当前提示词
          </button>
        ) : null}
        {onEdit ? (
          <button className="ghost-button small" onClick={onEdit}>
            编辑
          </button>
        ) : null}
        {onDelete ? (
          <button className="ghost-button small danger" onClick={onDelete}>
            删除
          </button>
        ) : null}
      </div>
    </article>
  )
}
