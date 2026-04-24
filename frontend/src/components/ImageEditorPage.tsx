import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import {
  createEditJob,
  createGenerateJob,
  createMask,
  deleteVersion,
  duplicateVersionToImageItem,
  exportVersion,
  finalizeVersion,
  getAppSettings,
  getImageItem,
  getVersionTree,
  importImage,
  publishPlaceholder,
  unfinalizeVersion,
} from '../lib/api'
import { useUiStore } from '../store/uiStore'
import type { Job, ProviderId, Quality, Version } from '../types/api'
import { AppTopbar } from './AppTopbar'
import { CanvasWorkbench } from './CanvasWorkbench'
import { useInputDialog } from './InputDialog'
import { VersionTree } from './VersionTree'

const QUALITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
] as const

const EMPTY_VERSIONS: Version[] = []
const GENERATE_SIZE_OPTIONS = ['auto', '1024x1024', '1536x1024', '1024x1536'] as const
type GenerateSizeOption = (typeof GENERATE_SIZE_OPTIONS)[number]

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
  const setUtilityTab = useUiStore((state) => state.setUtilityTab)
  const inputDialog = useInputDialog()
  const [quality, setQuality] = useState<Quality>('high')
  const [generateSize, setGenerateSize] = useState<GenerateSizeOption>('auto')
  const [userSelectedVersionId, setUserSelectedVersionId] = useState<string | null>(null)
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [selectionEnabled, setSelectionEnabled] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

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

  const settingsQuery = useQuery({
    queryKey: ['app-settings'],
    queryFn: getAppSettings,
    staleTime: Infinity,
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

  const versions = detailQuery.data?.versions ?? EMPTY_VERSIONS
  const currentFinalVersion = detailQuery.data?.current_final_version ?? null
  const selectedVersionId = useMemo(() => {
    if (!versions.length) {
      return null
    }
    if (userSelectedVersionId && versions.some((version) => version.id === userSelectedVersionId)) {
      return userSelectedVersionId
    }
    return currentFinalVersion?.id ?? versions[versions.length - 1]?.id ?? null
  }, [currentFinalVersion?.id, userSelectedVersionId, versions])

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) ?? null,
    [selectedVersionId, versions],
  )
  const hasVersions = Boolean(versions.length)
  const selectedInputSize = selectedVersion ? `${selectedVersion.width}x${selectedVersion.height}` : 'auto'
  const resultVersion = useMemo(
    () => pickResultVersion(selectedVersion, versions, detailQuery.data?.recent_jobs ?? []),
    [detailQuery.data?.recent_jobs, selectedVersion, versions],
  )
  const providerLabel = getProviderLabel(settingsQuery.data?.default_provider ?? 'openai_official')

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
        size_mode: 'auto',
      })
    },
    onSuccess: async () => {
      pushNotice({ title: '任务已入队', body: '你可以继续看画布，也可以去任务中心查看状态。' })
      await invalidate()
    },
    onError: (error: Error) => pushNotice({ title: '提交失败', body: error.message }),
  })

  const generateMutation = useMutation({
    mutationFn: () => {
      const sizePayload =
        generateSize === 'auto'
          ? { size_mode: 'auto' as const }
          : { size_mode: 'preset' as const, size: generateSize }
      return createGenerateJob(itemId, { prompt_text: promptText, quality, ...sizePayload })
    },
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

  function openTemplatesDrawer() {
    setUtilityTab('templates')
    openUtilityDrawer('templates')
  }

  async function handleFinalize() {
    if (!selectedVersion || pendingAction) return
    setPendingAction('finalize')
    try {
      await finalizeVersion(itemId, selectedVersion.id)
      pushNotice({ title: '已设为当前定稿' })
      await invalidate()
    } catch (error) {
      pushNotice({ title: '定稿失败', body: (error as Error).message })
    } finally {
      setPendingAction(null)
    }
  }

  async function handleExport(target: Version | null, label: string) {
    if (!target) {
      pushNotice({ title: '没有可导出的版本' })
      return
    }
    if (pendingAction) return
    setPendingAction(label)
    try {
      const result = await exportVersion(target.id)
      pushNotice({ title: '导出成功', body: result.file_url })
    } catch (error) {
      pushNotice({ title: '导出失败', body: (error as Error).message })
    } finally {
      setPendingAction(null)
    }
  }

  async function handlePublish(target: Version | null, label: string) {
    if (!target || !detailQuery.data) {
      pushNotice({ title: '没有可发布的版本' })
      return
    }
    if (pendingAction) return
    setPendingAction(label)
    try {
      await publishPlaceholder({
        publish_scope: 'image_item',
        owner_id: detailQuery.data.image_item.owner_id,
        image_item_id: itemId,
        version_id: target.id,
      })
      pushNotice({ title: '已记录发布占位' })
      await invalidate()
    } catch (error) {
      pushNotice({ title: '发布失败', body: (error as Error).message })
    } finally {
      setPendingAction(null)
    }
  }

  async function handleUnfinalize() {
    if (!currentFinalVersion || pendingAction) return
    setPendingAction('unfinalize')
    try {
      await unfinalizeVersion(itemId)
      pushNotice({ title: '已取消定稿' })
      await invalidate()
    } catch (error) {
      pushNotice({ title: '取消定稿失败', body: (error as Error).message })
    } finally {
      setPendingAction(null)
    }
  }

  async function handleDeleteVersion() {
    if (!selectedVersion || pendingAction) return
    setPendingAction('delete')
    try {
      await deleteVersion(selectedVersion.id)
      pushNotice({ title: '版本已移入回收站' })
      await invalidate()
    } catch (error) {
      pushNotice({ title: '删除失败', body: (error as Error).message })
    } finally {
      setPendingAction(null)
    }
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
            onSelect={setUserSelectedVersionId}
          />
        </div>

        <div className="sidebar-context-card editor-selection-card">
          <div className="sidebar-section-heading">当前选中</div>
          <h2>{selectedVersion ? selectedVersion.prompt_summary || selectedVersion.file_name : '暂无版本'}</h2>
          <p>{selectedVersion ? `${selectedVersion.width} × ${selectedVersion.height}` : '导入或生成后形成第一版'}</p>
          {selectedVersion?.is_current_final ? <span className="status-pill status-succeeded">当前定稿</span> : null}
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
          <button className="sidebar-tool-button" onClick={() => openUtilityDrawer('templates')}>
            模板
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

        <div className="editor-stage-grid editor-dual-stage">
          <section className="panel editor-canvas-panel dual-canvas-panel">
            {!hasVersions ? (
              <div className="canvas-empty-state">
                <div>
                  <div className="eyebrow">空图片项</div>
                  <h2>先导入底图，或者直接发起 AI 生图</h2>
                  <p>这张图片项还没有版本，导入后会形成根版本；也可以直接生成第一版。</p>
                </div>
              </div>
            ) : (
              <CanvasWorkbench
                baseImageUrl={selectedVersion?.file_url ?? null}
                resultImageUrl={resultVersion?.file_url ?? null}
                selection={selectionRect}
                onSelectionChange={setSelectionRect}
                enableSelection={selectionEnabled}
                onSelectionModeChange={setSelectionEnabled}
              />
            )}
          </section>

          <section className="panel editor-control-console">
            <div className="console-group prompt-console">
              <div className="console-heading">
                <span className="field-label">提示词</span>
                <button className="ghost-button small" onClick={openTemplatesDrawer}>
                  打开模板抽屉
                </button>
              </div>
              <textarea
                value={promptText}
                onChange={(event) => setPromptText(event.target.value)}
                placeholder={
                  hasVersions
                    ? '描述你希望怎么改图，老师会直接看到实际提交的提示词。'
                    : '例如：生成一张高中物理牛顿第二定律受力分析示意图，适合课件讲解'
                }
              />
            </div>

            <div className="console-group params-console">
              <div className="console-heading">
                <span className="field-label">生成参数</span>
                <span className="topbar-chip">{providerLabel}</span>
              </div>
              <div className="console-fields">
                <label>
                  <span className="field-label">质量</span>
                  <select value={quality} onChange={(event) => setQuality(event.target.value as Quality)}>
                    {QUALITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="field-label">{hasVersions ? '输入图规格' : '生图尺寸'}</span>
                  {hasVersions ? (
                    <span className="console-readout">{selectedInputSize}</span>
                  ) : (
                    <select
                      value={generateSize}
                      onChange={(event) => setGenerateSize(event.target.value as GenerateSizeOption)}
                    >
                      {GENERATE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                <div>
                  <span className="field-label">Mask</span>
                  <span className="console-readout">{selectionRect ? '已框选' : '未使用'}</span>
                </div>
              </div>
              <p className="settings-help">
                {hasVersions
                  ? '图改图最终规格由后端按 provider 规则归一化，提交对象永远是左栏当前选中版本。'
                  : '生图默认 auto，不向 provider 传 size；选择预设后会显式传 size。'}
              </p>
            </div>

            <div className="console-group actions-console">
              <div className="console-heading">
                <span className="field-label">动作</span>
              </div>
              <div className="console-actions">
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
                <button className="ghost-button" onClick={handleFinalize} disabled={!selectedVersion || pendingAction !== null}>
                  设为当前定稿
                </button>
                <button className="ghost-button" onClick={() => void handleExport(selectedVersion, 'export-selected')} disabled={pendingAction !== null}>
                  导出选中
                </button>
                <button className="ghost-button" onClick={() => void handlePublish(selectedVersion, 'publish-selected')} disabled={pendingAction !== null}>
                  发布选中
                </button>
                <button className="ghost-button" onClick={() => void handleExport(currentFinalVersion, 'export-final')} disabled={pendingAction !== null}>
                  导出定稿
                </button>
                <button className="ghost-button" onClick={() => void handlePublish(currentFinalVersion, 'publish-final')} disabled={pendingAction !== null}>
                  发布定稿
                </button>
                <button
                  className="ghost-button"
                  onClick={handleUnfinalize}
                  disabled={!currentFinalVersion || pendingAction !== null}
                >
                  取消定稿
                </button>
                <button
                  className="ghost-button"
                  disabled={!selectedVersion || duplicateMutation.isPending || pendingAction !== null}
                  onClick={handleDuplicateFromSelected}
                >
                  复制为新图片项起点
                </button>
                <button
                  className="ghost-button danger"
                  disabled={!selectedVersion || selectedVersion.child_count > 0 || selectedVersion.is_current_final || pendingAction !== null}
                  onClick={handleDeleteVersion}
                >
                  删除选中版本
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}

function pickResultVersion(selectedVersion: Version | null, versions: Version[], recentJobs: Job[]) {
  if (!selectedVersion) {
    return null
  }
  const latestJobOutput = recentJobs
    .filter((job) => job.base_version_id === selectedVersion.id && job.output_version)
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0]?.output_version
  if (latestJobOutput) {
    return latestJobOutput
  }
  return versions
    .filter((version) => version.parent_version_id === selectedVersion.id)
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0] ?? null
}

function getProviderLabel(providerId: ProviderId) {
  if (providerId === 'tal_gpt_image_2') {
    return 'TAL gpt-image-2'
  }
  return 'OpenAI 官方'
}
