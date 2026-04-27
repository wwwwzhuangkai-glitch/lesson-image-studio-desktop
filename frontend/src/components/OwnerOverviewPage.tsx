import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { useNavigate, useParams } from 'react-router-dom'

import {
  createImageItem,
  deleteImageItem,
  duplicateVersionToImageItem,
  getOwnerOverview,
  importImage,
  publishPlaceholder,
  reorderImageItems,
} from '../lib/api'
import type { ImageItemSummary, Owner } from '../types/api'
import { useUiStore } from '../store/uiStore'
import { AppTopbar } from './AppTopbar'
import { useInputDialog } from './InputDialog'

function getPreview(item: ImageItemSummary) {
  return item.current_final_version ?? item.latest_version
}

function getProjectTitle(owner: Owner | undefined) {
  if (!owner) return '载入中…'
  return owner.local_title?.trim() || '未命名'
}

function getProjectTypeLabel(ownerType: string) {
  if (ownerType === 'question') return '题目ID'
  if (ownerType === 'asset') return '知识素材ID'
  if (ownerType === 'other') return '本地项目'
  return '项目ID'
}

export function OwnerOverviewPage() {
  const { ownerId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setCurrentOwnerId = useUiStore((state) => state.setCurrentOwnerId)
  const pushNotice = useUiStore((state) => state.pushNotice)
  const openUtilityDrawer = useUiStore((state) => state.openUtilityDrawer)
  const jobIndicatorCount = useUiStore((state) => state.jobIndicatorCount)
  const inputDialog = useInputDialog()
  const [newTitle, setNewTitle] = useState('')
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const ownerQuery = useQuery({
    queryKey: ['owner', ownerId],
    queryFn: () => getOwnerOverview(ownerId),
    enabled: Boolean(ownerId),
    refetchInterval: 5000,
  })

  useEffect(() => {
    if (ownerQuery.data?.owner.id) {
      setCurrentOwnerId(ownerQuery.data.owner.id)
    }
  }, [ownerQuery.data?.owner.id, setCurrentOwnerId])

  const invalidateOwner = async () => {
    await queryClient.invalidateQueries({ queryKey: ['owner', ownerId] })
    await queryClient.invalidateQueries({ queryKey: ['jobs'] })
    await queryClient.invalidateQueries({ queryKey: ['owner-events', ownerId] })
    await queryClient.invalidateQueries({ queryKey: ['owner-recycle', ownerId] })
  }

  const createMutation = useMutation({
    mutationFn: (title: string) => createImageItem(ownerId, title),
    onSuccess: async () => {
      setNewTitle('')
      pushNotice({ title: '已创建空图片项' })
      await invalidateOwner()
    },
    onError: (error: Error) => pushNotice({ title: '创建失败', body: error.message }),
  })

  const publishBundleMutation = useMutation({
    mutationFn: () => publishPlaceholder({ publish_scope: 'owner_bundle', owner_id: ownerId }),
    onSuccess: async () => {
      pushNotice({ title: '已记录整包发布占位' })
      await invalidateOwner()
    },
    onError: (error: Error) => pushNotice({ title: '发布失败', body: error.message }),
  })

  const duplicateMutation = useMutation({
    mutationFn: ({ versionId, title }: { versionId: string; title?: string }) =>
      duplicateVersionToImageItem(versionId, title),
    onSuccess: async (detail) => {
      pushNotice({ title: '已复制为新图片项起点' })
      await invalidateOwner()
      navigate(`/items/${detail.image_item.id}`)
    },
    onError: (error: Error) => pushNotice({ title: '复制失败', body: error.message }),
  })

  const items = ownerQuery.data?.image_items ?? []
  const projectTitle = getProjectTitle(ownerQuery.data?.owner)
  const projectMeta = ownerQuery.data?.owner
    ? `${getProjectTypeLabel(ownerQuery.data.owner.owner_type)} · ${ownerQuery.data.owner.owner_id}`
    : ''

  async function handleUpload(imageItemId: string, file: File) {
    try {
      await importImage(imageItemId, file)
      pushNotice({ title: '底图已导入' })
      await invalidateOwner()
    } catch (error) {
      pushNotice({ title: '导入失败', body: (error as Error).message })
    }
  }

  async function handleDelete(imageItemId: string) {
    try {
      await deleteImageItem(imageItemId)
      pushNotice({ title: '已移入回收站' })
      await invalidateOwner()
    } catch (error) {
      pushNotice({ title: '删除失败', body: (error as Error).message })
    }
  }

  async function moveItem(imageItemId: string, direction: -1 | 1) {
    const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order)
    const index = ordered.findIndex((item) => item.id === imageItemId)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) {
      return
    }
    ;[ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]]
    await reorderImageItems(
      ownerId,
      ordered.map((item, position) => ({
        image_item_id: item.id,
        sort_order: position + 1,
      })),
    )
    pushNotice({ title: '排序已更新' })
    await invalidateOwner()
  }

  async function handleDuplicate(item: ImageItemSummary) {
    const preview = getPreview(item)
    if (!preview) {
      pushNotice({ title: '这张图还没有可复制的起点版本' })
      return
    }
    const title = await inputDialog.prompt({
      title: '复制为新图片项起点',
      message: '会新建一个图片项，并以这张图的预览版本为新版本树的根。',
      defaultValue: `${item.title} - 副本`,
      placeholder: '新图片项标题',
      confirmLabel: '复制',
    })
    if (!title) return
    duplicateMutation.mutate({ versionId: preview.id, title })
  }

  return (
    <div className="workbench-shell">
      <aside className="workspace-sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">LS</span>
          <div>
            <strong>Lesson Image Studio</strong>
            <p>教研画图工作台</p>
          </div>
        </div>

        <div className="sidebar-context-card">
          <div className="eyebrow">当前项目</div>
          <h2>{projectTitle}</h2>
          <p>{projectMeta}</p>
        </div>

        <nav className="sidebar-nav">
          <button className="sidebar-nav-item active">图片总览</button>
          <button className="sidebar-nav-item" onClick={() => navigate('/')}>
            切换项目
          </button>
        </nav>

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

      <section className="workspace-frame">
        <header className="workspace-topbar">
          <div>
            <div className="eyebrow">项目多图总览</div>
            <h1>{projectTitle}</h1>
          </div>

          <div className="topbar-actions">
            <span className="topbar-chip">最近打开固定 5 个项目</span>
            <button
              className="primary-button"
              disabled={publishBundleMutation.isPending}
              onClick={() => publishBundleMutation.mutate()}
            >
              发布整包占位
            </button>
            <AppTopbar />
          </div>
        </header>

        <div className="workspace-scroll">
          <section className="summary-ribbon panel">
            <div className="summary-ribbon-item">
              <span>图片项</span>
              <strong>{items.length}</strong>
            </div>
            <div className="summary-ribbon-item">
              <span>运行中</span>
              <strong>{ownerQuery.data?.task_summary.running ?? 0}</strong>
            </div>
            <div className="summary-ribbon-item">
              <span>失败</span>
              <strong>{ownerQuery.data?.task_summary.failed ?? 0}</strong>
            </div>
            <div className="summary-ribbon-item">
              <span>已完成</span>
              <strong>{ownerQuery.data?.task_summary.succeeded ?? 0}</strong>
            </div>
          </section>

          <section className="panel quick-create-strip">
            <div>
              <div className="eyebrow">快速新建</div>
              <h3>先建空图片项，再导入底图或直接 AI 生图</h3>
            </div>
            <div className="inline-create-form">
              <input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="例如：牛顿第二定律受力图"
              />
              <button
                className="primary-button"
                disabled={!newTitle.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate(newTitle)}
              >
                新建图片项
              </button>
            </div>
          </section>

          <section className="overview-card-grid">
            {items.map((item, index) => {
              const preview = getPreview(item)
              const hasVersion = Boolean(preview)
              return (
                <article key={item.id} className={clsx('overview-item-card panel', { empty: !preview })}>
                  <button className="overview-card-visual" onClick={() => navigate(`/items/${item.id}`)}>
                    {preview ? (
                      <img src={preview.file_url} alt={item.title} />
                    ) : (
                      <div className="overview-card-empty">
                        <strong>空图片项</strong>
                        <span>导入底图或直接 AI 生图</span>
                      </div>
                    )}
                  </button>

                  <div className="overview-card-copy">
                    <div className="overview-card-head">
                      <div>
                        <span className="eyebrow">排序 #{item.sort_order}</span>
                        <h3>{item.title}</h3>
                      </div>
                      <div className="card-pill-row card-pill-actions">
                        <button
                          className="ghost-button small"
                          disabled={index === 0}
                          onClick={() => void moveItem(item.id, -1)}
                        >
                          上移
                        </button>
                        <button
                          className="ghost-button small"
                          disabled={index === items.length - 1}
                          onClick={() => void moveItem(item.id, 1)}
                        >
                          下移
                        </button>
                        {item.current_final_version ? <span className="status-pill status-succeeded">定稿</span> : null}
                        {item.running_job ? <span className="status-pill status-running">任务中</span> : null}
                        {!item.current_final_version && !item.running_job ? (
                          <span className="status-pill">草稿</span>
                        ) : null}
                      </div>
                    </div>

                    <p className="overview-card-subtitle">
                      {preview?.prompt_summary || (preview ? preview.file_name : '这张图还没有版本。')}
                    </p>

                    <div className="overview-card-meta">
                      <span>{new Date(item.updated_at).toLocaleString('zh-CN')}</span>
                    </div>

                    <div className="overview-card-actions">
                      <button className="ghost-button small" onClick={() => navigate(`/items/${item.id}`)}>
                        进入编辑
                      </button>
                      <button
                        className="ghost-button small"
                        disabled={hasVersion}
                        title={hasVersion ? '该图片项已有版本；如需导入另一张底图，请新建图片项。' : undefined}
                        onClick={() => fileInputRefs.current[item.id]?.click()}
                      >
                        导入底图
                      </button>
                      <button
                        className="ghost-button small"
                        disabled={!preview || duplicateMutation.isPending}
                        onClick={() => handleDuplicate(item)}
                      >
                        复制起点
                      </button>
                      <button className="ghost-button small danger" onClick={() => handleDelete(item.id)}>
                        删除
                      </button>
                    </div>

                    <input
                      ref={(node) => {
                        fileInputRefs.current[item.id] = node
                      }}
                      hidden
                      type="file"
                      accept="image/*"
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        const file = event.target.files?.[0]
                        if (file) {
                          void handleUpload(item.id, file)
                        }
                        event.target.value = ''
                      }}
                    />
                  </div>
                </article>
              )
            })}
          </section>
        </div>
      </section>
    </div>
  )
}
